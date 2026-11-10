"""Render original Vol. 3: Python + NumPy + SciPy + FFmpeg, no song samples.

python render.py --ffmpeg D:/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
The guitar-like voices are modal synthesis, not a live guitar or sampled one.
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from composition import TRACKS, arrange

SR = 44100
LANES = ['keys','guitar','pad','lead','bass','arp','drums']
ROOT = Path(__file__).resolve().parents[3]


def lowpass(x, hz):
    return signal.sosfilt(signal.butter(2,hz,fs=SR,output='sos'),x,axis=0).astype(np.float32)


def gate(t,duration,attack,release):
    return (1-np.exp(-t/max(.001,attack))) * (.5+.5*np.cos(np.pi*np.clip((t-duration)/release,0,1)))


def voice(note,duration,kind,velocity,seed,brightness=1):
    release = {'pad':.34,'brass':.22,'pluck':.4,'ep':.3,'lead':.32,'bass':.12,'arp':.2}[kind]
    t = np.arange(round((duration+release)*SR),dtype=np.float64)/SR
    f = 440*2**((note-69)/12)
    phase = 2*np.pi*f*t
    rng = np.random.default_rng(seed)
    if kind == 'ep':
        x = np.sin(phase + .8*velocity*np.exp(-t*4)*np.sin(phase*2))
        x += .11*np.sin(phase*3.001)*np.exp(-t*3.8)
        x *= .17*np.exp(-.85*t)*gate(t,duration,.007,release)
    elif kind == 'pluck':
        x = np.zeros(len(t))
        # Harmonic modal decay and pickup/plectrum-position notches.
        for h in range(1,min(24,int(12000/f))+1):
            amp = np.sin(np.pi*h*.23)*np.cos(np.pi*h*.12)/(h**1.15)
            x += amp*np.sin(phase*h)*np.exp(-t*(.85+.13*h**1.35))
        x *= .25*gate(t,duration,.003,release)
    elif kind in ('pad','brass'):
        x = np.zeros((len(t),2))
        cutoff = ((700+1250*np.exp(-t*2.8)) if kind=='brass' else (1000+320*np.sin(t*.8))) * brightness
        # Explicit band-limited partials with a changing low-pass envelope.
        # Two slightly detuned voices, rather than white noise blurred by reverb.
        for ch,cents in enumerate([-3.6,3.6]):
            p = phase*2**(cents/1200) + .012*np.sin(2*np.pi*.33*t+ch)
            for h in range(1,min(22,int(14000/f))+1):
                amp = (1/h)/np.sqrt(1+(f*h/cutoff)**6)
                x[:,ch] += np.sin(p*h+(.17*h if ch else 0))*amp
        env = gate(t,duration,.18 if kind=='pad' else .025,release)
        if kind=='brass': env *= .6+.4*np.exp(-t*1.6)
        x *= env[:,None]*(.075 if kind=='pad' else .12)
    elif kind == 'bass':
        x = np.sin(phase)+.28*np.sin(phase*2)*np.exp(-t*3)+.1*np.sin(phase*3)*np.exp(-t*5)
        x *= .30*gate(t,duration,.006,release)*np.exp(-t*.4)
    elif kind == 'arp':
        x = np.sin(phase)+.22*np.sin(phase*2)*np.exp(-t*8)+.06*np.sin(phase*4)
        x *= .14*gate(t,duration,.004,release)*np.exp(-t*3.8)
    else:
        p = phase+.08*(1-np.exp(-t*2))*np.sin(2*np.pi*4.6*t)
        x = np.sin(p)+.14*np.sin(p*3)+.035*np.sin(p*5)
        x *= .13*gate(t,duration,.028,release)*np.exp(-t*.32)
    return (x*velocity).astype(np.float32)


def drum(note,velocity,rng):
    t=np.arange(round((.45 if note==36 else .24 if note==38 else .11)*SR))/SR
    noise=rng.normal(size=len(t))
    if note==36:
        phase=2*np.pi*(48*t+76*(1-np.exp(-t*40))/40)
        x=.55*np.sin(phase)*np.exp(-t*15)+lowpass(noise,1600)*.018*np.exp(-t*100)
    elif note==38:
        n=signal.sosfilt(signal.butter(2,[850,6500],btype='bandpass',fs=SR,output='sos'),noise)
        x=.16*np.sin(2*np.pi*183*t)*np.exp(-t*30)+.18*n*np.exp(-t*23)
    else:
        n=signal.sosfilt(signal.butter(2,[4200,10000],btype='bandpass',fs=SR,output='sos'),noise)
        x=n*.12*np.exp(-t*65)
    return (x*(1-np.exp(-t*1500))*velocity).astype(np.float32)


def add(bus,x,at,pan):
    size=min(len(x),len(bus)-at)
    if size<=0: return
    if x.ndim==1:
        gains=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])
        bus[at:at+size] += x[:size,None]*gains
    else:
        bus[at:at+size] += x[:size]*np.array([min(1,1-pan),min(1,1+pan)])


def chorus(x,amount=.23):
    # Subtle variable delay; retain correlated dry center for mono compatibility.
    index=np.arange(len(x),dtype=np.float64)
    mono=x.mean(axis=1)
    result=x.copy()
    for ch in range(2):
        delay=SR*(.014+.0028*np.sin(2*np.pi*.31*index/SR+ch*1.8))
        wet=np.interp(index-delay,index,mono,left=0,right=0)
        result[:,ch]=x[:,ch]*(1-amount)+wet*amount
    return result


def ambience(x,seed,wet,decay):
    rng=np.random.default_rng(seed)
    t=np.arange(round(decay*SR))/SR
    for ch in range(2):
        ir=lowpass(rng.normal(size=len(t)),3200)
        ir *= np.exp(-6.5*t/decay)*np.clip((t-.028)/.035,0,1)
        ir /= max(1e-9,np.sqrt(np.sum(ir**2)))
        x[:,ch] += signal.fftconvolve(x[:,ch],ir,mode='full')[:len(x)]*wet
    return x


def render(cfg,events):
    spb=60/cfg['bpm']
    frames=round((cfg['bars']*4*spb+7)*SR)
    mix=np.zeros((frames,2),np.float32)
    style=cfg['style']
    kicks=[e['beat']*spb for e in events if e['lane']=='drums' and e['note']==36]
    duck=np.ones(frames,dtype=np.float32)
    for start in kicks:
        at=round(start*SR); n=min(round(.38*SR),frames-at)
        t=np.arange(n)/SR
        duck[at:at+n] *= 1-(.16 if style=='afterimage' else .06)*np.exp(-t/ .13)*np.minimum(1,t/.006)
    for li,lane in enumerate(LANES):
        bus=np.zeros_like(mix)
        lane_events=[e for e in events if e['lane']==lane]
        if not lane_events: continue
        rng=np.random.default_rng(cfg['seed']+li)
        for e in lane_events:
            duration=e['length']*spb
            if lane=='drums':
                x=drum(e['note'],e['velocity'],rng)
            else:
                kind={'keys':'brass' if style=='afterimage' else 'ep',
                      'guitar':'pluck','pad':'pad','lead':'pluck' if style=='harbor' else 'ep' if style=='orbit' else 'lead',
                      'bass':'bass','arp':'arp'}[lane]
                # Slow timbral development across sections, not random pitch.
                brightness=.85+.25*np.sin(np.pi*min(1,e['beat']/192))
                x=voice(e['note'],duration,kind,e['velocity'],cfg['seed']+li,brightness)
            if lane!='drums':
                n=max(1,round((e['boundary']-e['beat'])*spb*SR))
                x=x[:n]
                fade=min(len(x),round(.045*SR))
                ramp=(.5+.5*np.cos(np.linspace(0,np.pi,fade))).astype(np.float32)
                x[-fade:] *= ramp[:,None] if x.ndim==2 else ramp
            add(bus,x,round(e['beat']*spb*SR),e['pan'])
        if lane in ('guitar','keys'):
            bus=chorus(bus,.30 if style=='harbor' else .16)
        if lane not in ('drums','bass'):
            if lane=='lead' and style!='orbit':
                dry=bus.copy()
                for d,g in [(spb*.75,.14),(spb*1.5,.055)]:
                    shift=round(d*SR)
                    bus[shift:] += dry[:-shift,::-1]*g
                del dry
            bus=ambience(bus,cfg['seed']+li,.12 if lane=='lead' else .095,1.6 if style=='harbor' else 1.15)
            bus*=duck[:,None]
        if lane=='pad': bus*=.40 if style=='harbor' else .55
        if lane=='guitar': bus*=.82
        if lane=='lead' and style=='harbor': bus*=1.28
        mix+=bus
        print(f"{cfg['id']}: {lane} ({len(lane_events)} notes)",flush=True)
    mix=signal.sosfilt(signal.butter(2,30,btype='highpass',fs=SR,output='sos'),mix,axis=0).astype(np.float32)
    mix=lowpass(mix,10800)
    mix=np.tanh(mix*.65)/.65
    fade=round(7*SR)
    mix[:round(.10*SR)]*=np.linspace(0,1,round(.10*SR))[:,None]
    mix[-fade:]*=(.5+.5*np.cos(np.linspace(0,np.pi,fade)))[:,None]
    if not np.isfinite(mix).all(): raise ValueError('Non-finite audio')
    return mix


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ffmpeg',required=True)
    p.add_argument('--out',type=Path,default=ROOT/'tmp'/'inkroam-lofi-vol03')
    p.add_argument('--track',type=int,choices=[1,2,3])
    args=p.parse_args(); out=args.out
    for name in ['audio','masters','scores','previews']: (out/name).mkdir(parents=True,exist_ok=True)
    manifest_path=out/'manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'album':'Paper Hours Vol. 3','tracks':[]}
    def ff(*a):
        return subprocess.run([args.ffmpeg,'-hide_banner','-nostdin','-y',*map(str,a)],capture_output=True,check=True)
    for i,cfg in enumerate(TRACKS,1):
        if args.track and args.track!=i: continue
        events,chords=arrange(cfg)
        ident=cfg['id']
        (out/'scores'/f'{ident}.json').write_text(json.dumps({'track':cfg,'events':events,'chords':chords},ensure_ascii=False,indent=2),encoding='utf-8')
        x=render(cfg,events)
        raw=out/'masters'/f'{ident}.raw.wav'
        wavfile.write(raw,SR,x)
        duration=len(x)/SR
        peak=float(np.max(np.abs(x))); del x
        target=-20 if cfg['style']=='harbor' else -18
        result=ff('-i',raw,'-af',f'loudnorm=I={target}:TP=-2:LRA=11:print_format=json','-f','null','NUL')
        txt=result.stderr.decode('utf-8',errors='replace')
        metrics=json.loads(txt[txt.rfind('{'):txt.rfind('}')+1])
        # Fixed gain: retain dynamics instead of flattening the music to target.
        gain=min(target-float(metrics['input_i']),-2.3-float(metrics['input_tp']))
        master=out/'masters'/f'{ident}.flac'; mp3=out/'audio'/f'{ident}.mp3'
        ff('-i',raw,'-af',f'volume={gain:.5f}dB','-c:a','flac','-sample_fmt','s32',master)
        ff('-i',master,'-c:a','libmp3lame','-b:a','256k','-metadata',f'title={cfg["title"]}','-metadata','album=Paper Hours Vol. 3','-metadata','artist=Inkroam - AI-generated original',mp3)
        ff('-ss',4*4*60/cfg['bpm'],'-i',master,'-t',45,'-af','afade=t=in:d=0.4,afade=t=out:st=42:d=3','-c:a','libmp3lame','-b:a','192k',out/'previews'/f'{ident}.mp3')
        raw.unlink()
        track={k:cfg[k] for k in ['id','title','english','bpm','meter','bars','key']}
        track.update(durationSeconds=duration,audio=f'audio/{ident}.mp3',master=f'masters/{ident}.flac',preview=f'previews/{ident}.mp3',score=f'scores/{ident}.json',rawPeak=peak,gainDb=gain)
        manifest['tracks']=[t for t in manifest['tracks'] if t['id']!=ident]+[track]
        manifest['tracks'].sort(key=lambda t:t['id'])
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        print(f'EXPORTED {ident}: {duration:.2f}s, gain {gain:.2f} dB',flush=True)


if __name__=='__main__': main()
