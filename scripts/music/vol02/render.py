"""Render Paper Hours Vol. 2. Python 3.10+, NumPy, SciPy and FFmpeg.

Uses a small, attributed Salamander piano sample selection, NOT the full SFZ
instrument/pedal/resonance model. Other voices are synthesized here. No model
weights, paid services, plugin installs or browser runtime dependencies.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile
from score import CHORDS, SECTIONS, TRACKS, arrange, midi

SR = 44100
PPQ = 960
ROOT = Path(__file__).resolve().parents[3]
LANES = ['keys','bass','melody','answer','air','drums']
CHANNELS = [0,1,2,3,4,9]


def ffmpeg(*args, capture=False):
    p = subprocess.run([FFMPEG,'-hide_banner','-nostdin','-y',*map(str,args)],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return p.stdout if capture else p.stderr.decode('utf-8', errors='replace')


def lowpass(x, hz):
    return signal.sosfilt(signal.butter(2,hz,fs=SR,output='sos'),x,axis=0).astype(np.float32)


class Piano:
    def __init__(self, folder):
        self.samples = {}
        for path in sorted(folder.glob('*v4.flac')):
            raw=ffmpeg('-v','error','-i',path,'-f','f32le','-ac','2','-ar',SR,'pipe:1',capture=True)
            audio=np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
            # Remove only leading sample silence, retaining the hammer attack.
            onset=np.flatnonzero(np.max(np.abs(audio),axis=1)>.003*np.max(np.abs(audio)))
            if len(onset):
                audio=audio[max(0,int(onset[0]) - round(.003*SR)):]
            self.samples[midi(path.stem.split('v')[0])]=lowpass(audio,6500)
        if len(self.samples)!=12:
            raise ValueError('Run fetch_samples.py first; all 12 verified piano samples are needed.')

    def note(self, pitch, duration, velocity, night=False):
        root=min(self.samples,key=lambda n:abs(n-pitch))
        sample=self.samples[root]
        release=.45 if night else .35
        count=round((duration+release)*SR)
        ratio=2**((pitch-root)/12)
        # Piano mapping is at most two semitones; polyphase interpolation avoids
        # sample-rate-conversion aliasing, unlike nearest-neighbor resampling.
        up=10000
        down=round(up*ratio)
        g=math.gcd(up,down)
        needed=min(len(sample),math.ceil(count*ratio)+128)
        x=signal.resample_poly(sample[:needed],up//g,down//g,axis=0).astype(np.float32)
        x=x[:count]
        if len(x)<count:
            x=np.pad(x,((0,count-len(x)),(0,0)))
        t=np.arange(count)/SR
        gate=np.ones(count)
        rel=np.clip((t-duration)/release,0,1)
        gate*=.5+.5*np.cos(np.pi*rel)
        gate[:88]*=np.linspace(0,1,88)
        x*=gate[:,None]*velocity*1.8
        return lowpass(x,3200 if night else 4400)


def synth(pitch, duration, velocity, kind, rng):
    release={'ep':.4,'bass':.18,'mallet':.35,'air':.4}[kind]
    t=np.arange(round((duration+release)*SR))/SR
    f=440*2**((pitch-69)/12)
    phase=2*np.pi*f*t+.025*np.sin(2*np.pi*.51*t)
    gate=(.5+.5*np.cos(np.pi*np.clip((t-duration)/release,0,1)))
    if kind=='ep':
        x=np.sin(phase+(.35+.65*velocity)*np.exp(-3.6*t)*np.sin(phase*2))
        x+=.12*np.sin(phase*3.001)*np.exp(-5*t)
        x*=.16*(1-np.exp(-180*t))*np.exp(-.72*t)
    elif kind=='bass':
        x=np.sin(phase)+.22*np.sin(phase*2)+.065*np.sin(phase*3)
        x*=.24*(1-np.exp(-110*t))*np.exp(-.68*t)
    elif kind=='mallet':
        x=np.sin(phase)+.24*np.sin(phase*3.98)*np.exp(-5*t)
        x*=.1*(1-np.exp(-210*t))*np.exp(-2*t)
    else:
        x=np.sin(phase)+.22*np.sin(phase*1.0017)+.08*np.sin(phase*2)
        x*=.085*(1-np.exp(-1.7*t))*np.exp(-.13*t)
    return (x*gate*velocity).astype(np.float32)


def drum(note, velocity, rng):
    t=np.arange(round({36:.42,38:.24,42:.12}[note]*SR))/SR
    noise=rng.normal(size=len(t)).astype(np.float32)
    if note==36:
        x=np.sin(2*np.pi*(48*t+70*(1-np.exp(-t*40))/40))
        x*=.42*(1-np.exp(-1500*t))*np.exp(-18*t)
        x+=lowpass(noise,1400)*.018*np.exp(-t*160)
    elif note==38:
        # Soft rim/body plus brush; no bright clap or piercing snare.
        x=(np.sin(2*np.pi*187*t)+.32*np.sin(2*np.pi*373*t))*.12*np.exp(-t*60)
        brush=signal.sosfilt(signal.butter(2,[600,5200],btype='bandpass',fs=SR,output='sos'),noise)
        x+=brush*.16*np.exp(-25*t)
        x*=1-np.exp(-1500*t)
    else:
        x=signal.sosfilt(signal.butter(2,[3400,8700],btype='bandpass',fs=SR,output='sos'),noise)
        x*=.1*(1-np.exp(-1900*t))*np.exp(-t*65)
    return (x*velocity).astype(np.float32)


def add(bus, x, at, pan):
    n=min(len(x),len(bus)-at)
    if n<=0:
        return
    if x.ndim==1:
        gains=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])
        bus[at:at+n]+=x[:n,None]*gains
    else:
        # Narrow the sampled piano's stereo image and apply gentle balance.
        mid=x[:n].mean(axis=1)
        side=(x[:n,0]-x[:n,1])*.28
        bus[at:at+n,0]+=(mid+side)*min(1,1-pan)
        bus[at:at+n,1]+=(mid-side)*min(1,1+pan)


def room(x, seed, wet, decay):
    rng=np.random.default_rng(seed)
    t=np.arange(round(decay*SR))/SR
    for ch in range(2):
        ir=lowpass(rng.normal(size=len(t)).astype(np.float32),3900)
        ir*=np.exp(-6.8*t/decay)*np.clip((t-.022)/.025,0,1)
        ir/=max(1e-9,np.sqrt(np.sum(ir**2)))
        tail=signal.fftconvolve(x[:,ch],ir,mode='full')[:len(x)].astype(np.float32)
        x[:,ch]+=tail*wet
    return x


def render(cfg, events, piano):
    spb=60/cfg['bpm']
    frames=round((48*cfg['meter']*spb+6)*SR)
    mix=np.zeros((frames,2),np.float32)
    for li,lane in enumerate(LANES):
        bus=np.zeros_like(mix)
        rng=np.random.default_rng(cfg['seed']+li)
        for e in events:
            if e['lane']!=lane:
                continue
            duration=e['length']*spb
            if lane=='drums':
                x=drum(e['note'],e['velocity'],rng)
            elif (lane in ('keys','melody') and cfg['style']!='river'):
                x=piano.note(e['note'],duration,e['velocity'],cfg['style']=='night')
            else:
                kind={'keys':'ep','melody':'ep','answer':'mallet','bass':'bass','air':'air'}[lane]
                x=synth(e['note'],duration,e['velocity'],kind,rng)
            boundary=e.get('harmonicBoundary')
            if boundary is not None:
                limit=max(1,round((boundary-e['beat'])*spb*SR))
                if len(x)>limit:
                    x=x[:limit].copy()
                fade=min(round(.1*SR),len(x))
                shape=(.5+.5*np.cos(np.linspace(0,np.pi,fade))).astype(np.float32)
                x[-fade:]*=shape[:,None] if x.ndim==2 else shape
            add(bus,x,round(e['beat']*spb*SR),e['pan'])
        if lane in ('keys','melody','answer','air'):
            bus=room(bus,cfg['seed']+li,.10 if lane=='keys' else .14,1.35 if cfg['style']=='night' else .95)
        if lane=='air':
            bus*=.35
        elif lane=='keys':
            bus*=.80
        mix+=bus
        del bus
        print(f"  rendered {lane}",flush=True)
    mix=signal.sosfilt(signal.butter(2,32,btype='highpass',fs=SR,output='sos'),mix,axis=0).astype(np.float32)
    mix=lowpass(mix,11000)
    mix=np.tanh(mix*.8)/.8
    attack=round(.08*SR)
    mix[:attack]*=np.linspace(0,1,attack)[:,None]
    fade=round(6*SR)
    mix[-fade:]*=(.5+.5*np.cos(np.linspace(0,np.pi,fade)))[:,None]
    if not np.isfinite(mix).all():
        raise ValueError('Non-finite render')
    return mix


def vlq(n):
    data=[int(n)&127]
    while n>>7:
        n>>=7
        data.insert(0,(n&127)|128)
    return bytes(data)


def meta(kind, text):
    b=text.encode('utf-8')
    return bytes([255,kind])+vlq(len(b))+b


def chunk(messages, end):
    data=bytearray()
    last=0
    for tick,order,msg in sorted(messages,key=lambda x:(x[0],x[1])):
        data+=vlq(tick-last)+msg
        last=tick
    data+=vlq(max(0,end-last))+b'\xff\x2f\x00'
    return b'MTrk'+struct.pack('>I',len(data))+data


def export_score(out,cfg,events,harmony):
    tempo=round(60000000/cfg['bpm'])
    conductor=[(0,0,meta(3,cfg['english'])),(0,1,b'\xff\x51\x03'+tempo.to_bytes(3,'big')),
               (0,2,bytes([255,88,4,cfg['meter'],2,24,8]))]
    for start,end,name in SECTIONS:
        conductor.append((start*cfg['meter']*PPQ,3,meta(6,name)))
    for i,name in enumerate(harmony):
        conductor.append((i*cfg['meter']*PPQ,4,meta(1,CHORDS[name]['name'])))
    end=48*cfg['meter']*PPQ
    chunks=[chunk(conductor,end)]
    programs=[4 if cfg['style']=='river' else 0,32,4 if cfg['style']=='river' else 0,11,89,None]
    for lane,ch,prog in zip(LANES,CHANNELS,programs):
        messages=[(0,0,meta(3,lane))]
        if prog is not None:
            messages.append((0,1,bytes([192+ch,prog])))
        for e in events:
            if e['lane']!=lane:
                continue
            start=round(e['beat']*PPQ)
            stop=round((e['beat']+e['length'])*PPQ)
            messages.extend([(start,3,bytes([144+ch,e['note'],max(1,min(127,round(e['velocity']*100)))])),
                             (stop,2,bytes([128+ch,e['note'],0]))])
        chunks.append(chunk(messages,end))
    (out/(cfg['id']+'.mid')).write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(chunks),PPQ)+b''.join(chunks))
    doc={'configuration':cfg,'sections':SECTIONS,'chords':[CHORDS[x] for x in harmony],
         'beatUnit':'quarter note','midiMiddleC':60,'events':events,
         'midiNote':'GM programs approximate the timbres; MIDI does not embed sampled piano or mix effects.'}
    (out/(cfg['id']+'.json')).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def measure(path):
    log=ffmpeg('-i',path,'-af','loudnorm=I=-18:TP=-2:LRA=9:print_format=json','-f','null','-')
    return json.loads(log[log.rfind('{'):log.rfind('}')+1])


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ffmpeg',default=os.environ.get('FFMPEG') or shutil.which('ffmpeg'))
    p.add_argument('--out',type=Path,default=ROOT/'tmp'/'inkroam-lofi-vol02-r2')
    p.add_argument('--samples',type=Path,default=ROOT/'tmp'/'inkroam-vol02-samples')
    p.add_argument('--track',type=int,choices=[1,2,3])
    args=p.parse_args()
    if not args.ffmpeg:
        p.error('Provide --ffmpeg or set FFMPEG')
    FFMPEG=args.ffmpeg
    for sub in ['audio','masters','scores','previews']:
        (args.out/sub).mkdir(parents=True,exist_ok=True)
    piano=Piano(args.samples)
    manifest=[]
    for index,cfg in enumerate(TRACKS,1):
        if args.track and args.track!=index:
            continue
        print(f"Rendering {cfg['id']}",flush=True)
        events,harmony=arrange(cfg)
        export_score(args.out/'scores',cfg,events,harmony)
        x=render(cfg,events,piano)
        duration=len(x)/SR
        with tempfile.TemporaryDirectory(prefix='vol02-',dir=args.out) as td:
            raw=Path(td)/'raw.wav'
            mastered=Path(td)/'master.wav'
            # Float raw retains headroom; never clip to int16 before mastering.
            wavfile.write(raw,SR,x)
            del x
            stats=measure(raw)
            # Quiet album-level target, keeping piano transients intact instead
            # of flattening the first track merely to match a louder neighbor.
            gain=min(-21-float(stats['input_i']),-2.2-float(stats['input_tp']))
            ffmpeg('-v','error','-i',raw,'-af',f'volume={gain:.8f}dB','-c:a','pcm_s24le',mastered)
            tags=['-metadata',f"title={cfg['title']} / {cfg['english']}",'-metadata','artist=Inkroam',
                  '-metadata','album=Paper Hours, Vol. 2','-metadata',f'track={index}/3',
                  '-metadata','date=2026','-metadata','genre=Lo-fi',
                  '-metadata',('comment=Revision 2. Synthesized instruments; see CREDITS.md.' if cfg['style']=='river' else
                               'comment=Revision 2. Piano samples: Alexander Holm, Salamander Grand Piano v3, CC BY 3.0. See CREDITS.md.')]
            mp3=args.out/'audio'/(cfg['id']+'.mp3')
            flac=args.out/'masters'/(cfg['id']+'.flac')
            ffmpeg('-v','error','-i',mastered,*tags,'-c:a','libmp3lame','-b:a','192k',mp3)
            ffmpeg('-v','error','-i',mastered,*tags,'-c:a','flac',flac)
            ffmpeg('-v','error','-ss',4*cfg['meter']*60/cfg['bpm'],'-i',mastered,'-t','35',
                   '-af','afade=t=in:d=0.5,afade=t=out:st=32:d=3',*tags,
                   '-c:a','libmp3lame','-b:a','192k',args.out/'previews'/(cfg['id']+'.preview.mp3'))
            measured=measure(mp3)
            item={k:cfg[k] for k in ['id','title','english','bpm','meter','key','mood','seed']}
            item.update(durationSeconds=round(duration,3),sampleRate=SR,channels=2,
                        integratedLufs=float(measured['input_i']),truePeakDbtp=float(measured['input_tp']),
                        loudnessRange=float(measured['input_lra']),noteEvents=len(events),
                        audio='audio/'+mp3.name,master='masters/'+flac.name,
                        sha256=hashlib.sha256(mp3.read_bytes()).hexdigest(),bytes=mp3.stat().st_size)
            manifest.append(item)
            print(json.dumps(item,ensure_ascii=False),flush=True)
        # Checkpoint after EACH finished track so interruption loses no metadata.
        target=args.out/'manifest.json'
        previous=json.loads(target.read_text(encoding='utf-8'))['tracks'] if target.exists() else []
        ids={x['id'] for x in manifest}
        tracks=sorted([x for x in previous if x['id'] not in ids]+manifest,key=lambda x:x['id'])
        target.write_text(json.dumps({'album':'Inkroam — Paper Hours, Vol. 2','version':2,'masteringTargetLufs':-21,
                                     'renderMethod':'authored MIDI/event score, sampled piano and synthesized instruments',
                                     'listeningStatus':'technical checks only; listener review pending',
                                     'tracks':tracks},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Finished.',flush=True)
