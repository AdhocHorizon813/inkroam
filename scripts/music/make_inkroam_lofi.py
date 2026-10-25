#!/usr/bin/env python3
"""Inkroam — Paper Hours, Vol. 1, arrangement revision 2 (2026-10-25).

python -m pip install -r requirements.txt
python scripts/music/make_inkroam_lofi.py --out tmp/lofi-v2 --full-only
Requires ffmpeg on PATH for MP3, Ogg/Vorbis and FLAC exports.
All notes, instruments, percussion and ambience are synthesized; no samples.
Score JSON and type-1 multitrack MIDI are emitted from the SAME note events
used by the renderer. MIDI programs are approximations of these custom voices.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave

import numpy as np
from scipy import signal

SR = 44100
PPQ = 960
PITCHES = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
           'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
           'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
LANES = ['keys', 'bass', 'lead', 'pad', 'drums']
PROGRAMS = [4, 32, 11, 89, None]
CHANNELS = [0, 1, 2, 3, 9]

# The original ZIP remains the v1 reference. These are composed phrases, not
# another random pitch generator. Each bridge answers that track's A motif in
# its own register; long rests are intentional for background reading.
BRIDGES = {
    'rhodes': [
        [(.5,'G5',.7),(2,'E5',.65),(3,'C5',.7)],
        [(1,'B4',.8),(2.5,'F#5',.65)],
        [(.5,'E5',.7),(2,'D5',1.2)],
        [(1,'B4',.65),(2.5,'A4',.75)],
        [(0,'G4',.8),(1.5,'B4',.6),(3,'D5',.7)],
        [(.5,'C#5',.7),(2,'Bb4',.7)],
        [(1,'A4',.8),(2.5,'E5',.7)],
        [(.5,'D5',.7),(2,'B4',1.0)],
    ],
    'nylon': [
        [(0,'D5',.8),(1.5,'C5',.7),(3,'A4',.6)],
        [(.5,'G4',.7),(2,'Bb4',.8)],
        [(0,'C5',.7),(2.5,'B4',.9)],
        [(1,'A4',.7),(2.5,'F#4',.9)],
        [(.5,'G4',.75),(2,'Bb4',.65),(3,'D5',.6)],
        [(1,'E5',.8),(2.5,'D5',.7)],
        [(0,'C5',1.1),(2,'A4',.8)],
        [(.5,'G4',.7),(2,'E4',1.0)],
    ],
    'felt': [
        [(1,'Ab4',1.2),(3,'G4',.65)],
        [(.5,'F4',1.3),(2.5,'D4',.9)],
        [(0,'G4',1.4),(2.5,'F4',.8)],
        [(1,'Eb4',1.8)],
        [(.5,'C5',1.1),(2.5,'Ab4',1.0)],
        [(1,'B4',.8),(2.5,'Ab4',.8)],
        [(0,'G4',1.2),(2,'Eb4',1.0)],
        [(1,'D4',1.4)],
    ],
}
RESPONSES = {
    'rhodes': {1: [(1,'E5',.75),(2.5,'C5',.65)], 5: [(.5,'E5',.8),(2,'C#5',.7),(3,'Bb4',.6)]},
    'nylon': {1: [(.5,'D5',.7),(2,'C5',.7),(3,'A4',.65)], 5: [(0,'E4',.8),(1.5,'G4',.65),(3,'D4',.75)]},
    'felt': {1: [(0,'Eb5',1.1),(2.5,'C5',1.0)], 5: [(1,'G4',1.2),(3,'Eb4',.7)]},
}


def midi(note):
    if isinstance(note, int):
        return note
    return (int(note[-1]) + 1) * 12 + PITCHES[note[:-1]]


def chord(name, root, *notes):
    return {'name': name, 'root': midi(root), 'voicing': [midi(x) for x in notes]}


C = {
    'C9': chord('Cmaj9', 'C2', 'E3', 'B3', 'D4', 'G4'),
    'Am9': chord('Am9', 'A1', 'G3', 'B3', 'C4', 'E4'),
    'Dm9': chord('Dm9', 'D2', 'F3', 'C4', 'E4', 'A4'),
    'G13': chord('G13', 'G1', 'F3', 'B3', 'E4', 'A4'),
    'Em9': chord('Em9', 'E2', 'G3', 'B3', 'D4', 'F#4'),
    'A7': chord('A7(b9)', 'A1', 'G3', 'Bb3', 'C#4', 'E4'),
    'F9': chord('Fmaj9', 'F2', 'A3', 'C4', 'E4', 'G4'),
    'Bb9': chord('Bbmaj9', 'Bb1', 'A3', 'C4', 'D4', 'F4'),
    'Gm9': chord('Gm9', 'G1', 'F3', 'A3', 'Bb3', 'D4'),
    'C13': chord('C13', 'C2', 'Bb3', 'D4', 'E4', 'A4'),
    'D9': chord('D9', 'D2', 'F#3', 'C4', 'E4', 'A4'),
    'Ehalf': chord('Em7(b5)', 'E2', 'G3', 'Bb3', 'D4', 'G4'),
    'Ab9': chord('Abmaj9', 'Ab1', 'G3', 'Bb3', 'C4', 'Eb4'),
    'Db9': chord('Dbmaj9', 'Db2', 'F3', 'Ab3', 'C4', 'Eb4'),
    'Cm9': chord('Cm9', 'C2', 'Eb3', 'Bb3', 'D4', 'G4'),
    'Fm9': chord('Fm9', 'F1', 'Ab3', 'C4', 'Eb4', 'G4'),
    'Bb13': chord('Bb13', 'Bb1', 'Ab3', 'C4', 'D4', 'G4'),
    'Eb9': chord('Ebmaj9', 'Eb2', 'G3', 'Bb3', 'D4', 'F4'),
    'G7': chord('G7(b9)', 'G1', 'F3', 'Ab3', 'B3', 'D4'),
}

# Hand-written motifs: beat offset, pitch, beat length. Silence is intentional.
TRACKS = [
    dict(id='01_rain_on_the_margin', title='雨窗演算', english='Rain on the Margin',
         bpm=76, key='C major', seed=10017, voice='rhodes', swing=.095,
         mood='雨天 · 电钢琴 · 松弛的切分',
         A=['C9','Am9','Dm9','G13','C9','A7','Dm9','G13'],
         B=['F9','Em9','Dm9','G13','C9','A7','Dm9','G13'],
         motifs=[[(.5,'E5',.55),(1.5,'G5',.65),(2.75,'D5',.7)],
                 [(.5,'B4',.65),(1.75,'C5',.5),(2.5,'E5',.8)],
                 [(0,'A4',.8),(1.5,'C5',.5),(2.5,'E5',.7),(3.5,'D5',.4)],
                 [(.75,'B4',.75),(2,'A4',.7),(3,'G4',.65)],
                 [(0,'G5',1.0),(1.75,'E5',.6),(3,'D5',.65)],
                 [(.5,'C#5',.65),(1.5,'E5',.75),(3,'Bb4',.6)],
                 [(.5,'A4',.6),(1.5,'C5',.65),(2.75,'E5',.65)],
                 [(.5,'D5',.8),(2,'B4',.6),(3,'G4',.6)]]),
    dict(id='02_lamplight_and_paper', title='纸页微光', english='Lamplight & Paper',
         bpm=70, key='F major', seed=20423, voice='nylon', swing=.07,
         mood='暖灯 · 木质拨弦 · 轻巧的鼓刷',
         A=['F9','Bb9','Am9','D9','Gm9','C13','F9','C13'],
         B=['Bb9','Ehalf','Am9','D9','Gm9','C13','F9','C13'],
         motifs=[[(0,'A4',.6),(1,'C5',.5),(2.5,'G4',1)],
                 [(.5,'F4',.75),(1.75,'D5',.65),(3,'C5',.6)],
                 [(.5,'E5',.7),(2,'C5',.65),(3,'B4',.6)],
                 [(.5,'A4',.55),(1.5,'F#4',.6),(2.75,'E4',.6)],
                 [(0,'D5',1),(1.75,'Bb4',.65),(3,'A4',.6)],
                 [(.5,'G4',.65),(1.75,'E4',.7),(3,'D4',.6)],
                 [(0,'C5',.7),(1.5,'A4',.75),(2.75,'G4',.7)],
                 [(.5,'E4',.7),(2,'G4',.7),(3,'Bb4',.65)]]),
    dict(id='03_a_lemma_after_midnight', title='凌晨的引理', english='A Lemma After Midnight',
         bpm=66, key='C minor', seed=30915, voice='felt', swing=.11,
         mood='深夜 · 毛毡钢琴 · 稀疏的低频',
         A=['Cm9','Ab9','Fm9','G7','Cm9','Eb9','Ab9','G7'],
         B=['Fm9','Bb13','Eb9','Ab9','Fm9','G7','Cm9','G7'],
         motifs=[[(.5,'G4',1),(2,'Bb4',.7),(3.25,'D5',.45)],
                 [(0,'C5',1.2),(2,'Bb4',.7),(3,'G4',.6)],
                 [(.75,'Ab4',.85),(2.25,'G4',.8)],
                 [(.5,'F4',.75),(2,'B4',.8),(3.25,'Ab4',.45)],
                 [(0,'G4',.9),(1.5,'Eb5',.75),(3,'D5',.7)],
                 [(.5,'Bb4',.8),(2,'G4',.85)],
                 [(.5,'Eb5',.85),(2,'C5',.8),(3.25,'Bb4',.45)],
                 [(.5,'Ab4',.7),(1.75,'F4',.7),(3,'B4',.6)]])
]


def arrange(cfg):
    """40 bars: 4 intro + 8 A + 8 A' + 8 B + 8 A'' + 4 outro.
    The dedicated loop is the 32-bar middle, with circular effects tails.
    """
    rng = np.random.default_rng(cfg['seed'])
    events = []

    def add(lane, beat, note, length, velocity, pan=0):
        events.append(dict(lane=lane, beat=round(float(beat),6), note=midi(note),
                           length=round(float(length),6), velocity=round(float(velocity),5),
                           pan=round(float(pan),4)))

    harmony = cfg['A'][:4] + cfg['A']*2 + cfg['B'] + cfg['A'] + cfg['A'][:4]
    for bar, token in enumerate(harmony):
        c = C[token]
        base = bar*4
        intro = bar < 4
        outro = bar >= 36
        bridge = 20 <= bar < 28
        drive = .55 if intro else (.68 if outro else (.82 if bridge else 1))

        # Soft rolls and syncopated comping, with consistent voice-leading.
        hits = [(0,2.25,.65),(2.65,1.15,.42)]
        if cfg['voice'] == 'nylon':
            hits = [(0,1.6,.62),(1.5,1.0,.40),(2.8,1.05,.48)]
        if cfg['voice'] == 'felt':
            hits = [(0,3.05,.64)] + ([(2.75,.9,.32)] if bar%2 else [])
        for beat, length, vel in hits:
            for n, note in enumerate(c['voicing']):
                add('keys', base+beat+n*.027+rng.uniform(.001,.012), note,
                    length, vel*drive*rng.uniform(.92,1.05), (n-1.5)*.16)

        # Counterline/arpeggio only in selected phrases; keep room for reading.
        if bar in range(12,20) or bar in range(28,36):
            for k, b in enumerate([.75,2.25,3.5]):
                note = c['voicing'][(bar+k)%4]+12
                add('keys',base+b,note,.45,.20*drive, .28 if k%2 else -.28)

        if not (intro and bar<2):
            root = c['root']
            next_root = C[harmony[(bar+1)%len(harmony)]]['root']
            add('bass',base+.01,root,1.45,.8*drive)
            add('bass',base+2.04,root+12 if bar%4==2 else root,1.1,.62*drive)
            if bar%2 and not outro:
                approach = next_root + (1 if next_root<root else -1)
                add('bass',base+3.5+cfg['swing'],approach,.38,.37*drive)

        if bar>=4 and bar<36:
            motif_index=(bar-4)%8
            motif=cfg['motifs'][motif_index]
            # A' has two actual melodic replies, not only added accompaniment.
            if 12 <= bar < 20:
                motif = RESPONSES[cfg['voice']].get(motif_index, motif)
            # Individual eight-bar phrases replace the shared +12 chord recipe.
            if bridge:
                motif=BRIDGES[cfg['voice']][bar-20]
            if 28 <= bar < 36 and motif_index in (2,6):
                motif=motif[:-1]  # quieter return, without losing the theme
            if bar in (11,19,27,35):
                motif=motif[:2]  # breath at the end of each eight-bar phrase
            for b, note, length in motif:
                if bar in (6,14,30) and b<1:  # a small recurring pause
                    continue
                add('lead',base+b+(cfg['swing'] if b%1==.5 else 0)+rng.uniform(.005,.02),
                    note,length,.46*drive*rng.uniform(.9,1.08),-.08)

        # Low-velocity sustained upper voices, with slow attack.
        if bar%2==0 and not outro:
            for note in c['voicing'][1:3]:
                add('pad',base+.06,note,5.7,.12 if intro else .16,.4)

        if intro and bar<2 or outro and bar>=38:
            continue
        sparse = cfg['voice']=='felt' or bridge
        kicks=[(0,.82),(2.5+cfg['swing'],.58)]
        if cfg['voice']=='felt' and bar%2==0:
            kicks=kicks[:1]
        if bar%4 in (1,3) and not sparse:
            kicks.append((1.75,.35))
        if bar%4==3 and cfg['voice']!='felt':
            kicks.append((3.5+cfg['swing'],.44))
        for b,v in kicks:
            add('drums',base+b,36,.24,v*drive)
        for b in (1,3):
            add('drums',base+b+.032+rng.uniform(-.006,.006),38,.16,.65*drive,-.08)
        if bar%4 in (2,3) and not intro:
            add('drums',base+2.75,38,.10,.17*drive,-.13)
        for k in range(8):
            if sparse and k in (2,6) or cfg['voice']=='felt' and k in (3,7):
                continue
            b=k*.5+(cfg['swing'] if k%2 else 0)+rng.uniform(-.006,.006)
            add('drums',base+max(.002,b),42,.065,(.30 if k%2 else .40)*drive*rng.uniform(.8,1.1),.24)
        if bar%8==7:
            add('drums',base+3.5+cfg['swing'],46,.22,.25*drive,.18)
    return sorted(events,key=lambda e:(e['beat'],e['lane'],e['note'])), harmony


def lowpass(x, hz, order=2):
    return signal.sosfilt(signal.butter(order,hz,fs=SR,output='sos'),x,axis=0).astype(np.float32)


def bandpass(x, lo, hi):
    return signal.sosfilt(signal.butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),x).astype(np.float32)


def voice(note, seconds, velocity, kind, rng):
    release={'rhodes':.60,'nylon':.38,'felt':.65,'bass':.12,'bell':.8,'pad':.65}[kind]
    t=np.arange(int((seconds+release)*SR),dtype=np.float64)/SR
    f=440*2**((note-69)/12)
    # Subtle pitch drift, already continuous from a zero phase for each note.
    phase=2*np.pi*f*t + .0012*f*np.sin(2*np.pi*.63*t)
    gate=np.where(t<seconds,1,np.exp(-(t-seconds)*8/release))
    if kind=='rhodes':
        mod=(.40+.9*velocity)*np.exp(-t*3.8)
        x=np.sin(phase+mod*np.sin(phase*2.001))
        x+=.17*np.sin(phase*3.003)*np.exp(-t*4.5)
        env=(1-np.exp(-t*160))*np.exp(-t*.82)*gate
        x=x*env*.23
    elif kind=='nylon':
        x=np.zeros_like(t)
        for k in range(1,10):
            pick=np.sin(k*np.pi*.29)
            x+=pick/k**1.35*np.sin(phase*k*(1+.000035*k*k))*np.exp(-t*(1.1+.67*k))
        x*= (1-np.exp(-t*250))*gate*.36
    elif kind=='felt':
        x=np.zeros_like(t)
        for k in range(1,8):
            x+=np.sin(phase*k*(1+.00004*k*k))/k**1.8*np.exp(-t*(.75+k*.32))
        x*= (1-np.exp(-t*140))*gate*.29
        x+=lowpass(rng.normal(size=len(t)).astype(np.float32),1600)*np.exp(-t*75)*.006
    elif kind=='bass':
        x=(np.sin(phase)+.26*np.sin(phase*2)+.08*np.sin(phase*3))
        x*=(1-np.exp(-t*100))*np.exp(-t*1.1)*gate*.40
    elif kind=='bell':
        x=np.sin(phase+.55*np.exp(-t*4)*np.sin(phase*2))
        x+=(.13*np.sin(phase*3))*np.exp(-t*3)
        x*=(1-np.exp(-t*140))*np.exp(-t*1.9)*gate*.18
    else:
        x=np.sin(phase)+.16*np.sin(phase*2.002)+.12*np.sin(phase*.999)
        env=(1-np.exp(-t*2.5))*np.exp(-t*.12)*gate
        x*=env*.12
    return (x*velocity).astype(np.float32)


def drum(note, velocity, rng):
    seconds={36:.38,38:.19,42:.07,46:.30}[note]
    t=np.arange(round(SR*seconds))/SR
    noise=rng.normal(size=len(t)).astype(np.float32)
    if note==36:
        phase=2*np.pi*(46*t+83*(1-np.exp(-t*38))/38)
        x=np.sin(phase)*(1-np.exp(-t*1500))*np.exp(-t*17)*.68
        x+=lowpass(noise,1700)*np.exp(-t*200)*.055
    elif note==38:
        x=(np.sin(2*np.pi*184*t)+.36*np.sin(2*np.pi*331*t))*np.exp(-t*37)*.17
        x+=bandpass(noise,850,6100)*np.exp(-t*31)*.25
        x*=1-np.exp(-t*2200)
    else:
        env=np.exp(-t*(83 if note==42 else 19))
        x=bandpass(noise,3800,11000)*env*(.12 if note==42 else .10)
        x*=1-np.exp(-t*3200)
    return (x*velocity).astype(np.float32)


def pan_add(bus, x, at, pan):
    at=max(0,at)
    count=min(len(x),len(bus)-at)
    if count<=0:
        return
    angle=(pan+1)*np.pi/4
    bus[at:at+count,0]+=x[:count]*np.cos(angle)
    bus[at:at+count,1]+=x[:count]*np.sin(angle)


def space(x, beat):
    wet=np.zeros_like(x)
    for seconds, gain, reverse in [(.071,.16,True),(.113,.13,False),(.179,.11,True),
                                   (.263,.085,False),(.397,.06,True),(.619,.04,False),
                                   (beat*.75,.10,True),(beat*1.5,.047,False)]:
        d=round(seconds*SR)
        if d<len(x):
            src=x[:-d,::-1] if reverse else x[:-d]
            wet[d:]+=src*gain
    return x+lowpass(wet,3400)


def render(cfg, events, start_beat, beats, loop=False):
    spb=60/cfg['bpm']
    length=round(beats*spb*SR)
    # Render three copies and keep the middle for a true periodic effects state.
    copies=3 if loop else 1
    tail=0 if loop else 3*SR
    total=length*copies+tail
    rng=np.random.default_rng(cfg['seed']+700)
    buses={lane:np.zeros((total,2),dtype=np.float32) for lane in LANES}
    selected=[e for e in events if start_beat<=e['beat']<start_beat+beats]
    kicks=[]
    for cp in range(copies):
        # Identical note noise on each cycle is necessary for periodic loops.
        nrng=np.random.default_rng(cfg['seed']+900)
        for e in selected:
            seconds=e['length']*spb
            relative=(e['beat']-start_beat)*spb
            at=round(relative*SR)+cp*length
            lane=e['lane']
            if lane=='drums':
                x=drum(e['note'],e['velocity'],nrng)
                if e['note']==36:
                    kicks.append(at)
            else:
                kind={'keys':cfg['voice'],'bass':'bass','lead':('bell' if cfg['voice']=='rhodes' else cfg['voice']),'pad':'pad'}[lane]
                x=voice(e['note'],seconds,e['velocity'],kind,nrng)
            pan_add(buses[lane],x,at,e['pan'])
    duck=np.ones(total,dtype=np.float32)
    t=np.arange(round(.32*SR))/SR
    for at in kicks:
        count=min(len(t),total-at)
        duck[at:at+count]*=1-.16*np.exp(-t[:count]*11)
    music=space(lowpass(buses['keys'],4700)+buses['lead']*.78,spb)
    music+=space(lowpass(buses['pad'],1800),spb)*.6
    music*=duck[:,None]
    mix=music+buses['bass']*.8+lowpass(buses['drums'],10500)
    del buses
    # Quiet continuous tape air. On the loop it is periodic as well.
    air=lowpass(rng.normal(size=(length,2)).astype(np.float32),4700)*.00034
    for cp in range(copies):
        mix[cp*length:(cp+1)*length]+=air
    mix=np.tanh(mix*1.12)/1.12
    mix=signal.sosfilt(signal.butter(2,28,btype='highpass',fs=SR,output='sos'),mix,axis=0).astype(np.float32)
    if loop:
        mix=mix[length:2*length].copy()
    else:
        fadein=round(.10*SR)
        fadeout=round(7.0*SR)
        mix[:fadein]*=np.linspace(0,1,fadein)[:,None]
        mix[-fadeout:]*=np.linspace(1,0,fadeout)[:,None]**1.5
    return mix


def write_wav(path, x):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes())


def run_ffmpeg(*args):
    p=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],capture_output=True,text=True)
    if p.returncode:
        raise RuntimeError(p.stderr)


def vlq(n):
    n=int(n)
    out=[n&127]
    while n>>7:
        n>>=7
        out.insert(0,(n&127)|128)
    return bytes(out)


def midi_track(messages, end_tick):
    result=bytearray()
    last=0
    for tick,priority,msg in sorted(messages,key=lambda m:(m[0],m[1])):
        result.extend(vlq(tick-last)+msg)
        last=tick
    result.extend(vlq(max(0,end_tick-last))+b'\xff\x2f\x00')
    return b'MTrk'+struct.pack('>I',len(result))+result


def meta_text(kind,text):
    b=text.encode('utf-8')
    return bytes([255,kind])+vlq(len(b))+b


def export_score(folder,cfg,events,harmony):
    duration_tick=40*4*PPQ
    tempo=round(60000000/cfg['bpm'])
    conductor=[(0,0,meta_text(3,cfg['english'])),(0,1,b'\xff\x51\x03'+tempo.to_bytes(3,'big')),
               (0,2,b'\xff\x58\x04\x04\x02\x18\x08')]
    for bar,token in enumerate(harmony):
        conductor.append((bar*4*PPQ,3,meta_text(6,C[token]['name'])))
    for bar,name in [(0,'Intro'),(4,'A'),(12,"A variation"),(20,'B'),(28,'A return'),(36,'Outro')]:
        conductor.append((bar*4*PPQ,4,meta_text(1,name)))
    chunks=[midi_track(conductor,duration_tick)]
    for lane,ch,program in zip(LANES,CHANNELS,PROGRAMS):
        messages=[(0,0,meta_text(3,lane))]
        if program is not None:
            if lane=='keys':
                program={'rhodes':4,'nylon':24,'felt':0}[cfg['voice']]
            elif lane=='lead':
                program={'rhodes':11,'nylon':24,'felt':0}[cfg['voice']]
            messages.append((0,1,bytes([0xC0+ch,program])))
        for e in events:
            if e['lane']!=lane:
                continue
            on=round(e['beat']*PPQ)
            off=round((e['beat']+e['length'])*PPQ)
            vel=max(1,min(127,round(e['velocity']*110)))
            messages.extend([(on,3,bytes([0x90+ch,e['note'],vel])),(off,2,bytes([0x80+ch,e['note'],0]))])
        chunks.append(midi_track(messages,max(duration_tick,max((x[0] for x in messages),default=0))))
    (folder/(cfg['id']+'.mid')).write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(chunks),PPQ)+b''.join(chunks))
    doc={'format':'inkroam-note-events-v1','bpm':cfg['bpm'],'time_signature':[4,4],
         'title':cfg['title'],'key':cfg['key'],'midi_middle_C':60,
         'units':{'beat':'quarter note','length':'quarter note','velocity':'linear synthesis amplitude',
                  'pan':'-1 left, +1 right'},
         'chords':[dict(bar=i+1,**C[c]) for i,c in enumerate(harmony)],'events':events}
    (folder/(cfg['id']+'.json')).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def loudness(path):
    p=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json',
                       '-f','null','-'],capture_output=True,text=True,check=True)
    return json.loads(p.stderr[p.stderr.rfind('{'):p.stderr.rfind('}')+1])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[2]/'tmp'/'lofi-v2')
    parser.add_argument('--track',default='all',choices=['all','1','2','3'])
    parser.add_argument('--full-only',action='store_true',help='Skip unused loop masters; the site plays complete MP3 tracks.')
    args=parser.parse_args()
    root=args.out.resolve()
    for sub in ['audio','scores','web','masters']:
        (root/sub).mkdir(parents=True,exist_ok=True)
    if not shutil.which('ffmpeg'):
        raise SystemExit('Install ffmpeg first: it is required for mastering and web exports.')
    manifest=[]
    for index,cfg in enumerate(TRACKS,1):
        if args.track!='all' and args.track!=str(index):
            continue
        print(f"Composing {cfg['id']} ({cfg['bpm']} BPM)",flush=True)
        events,harmony=arrange(cfg)
        export_score(root/'scores',cfg,events,harmony)
        with tempfile.TemporaryDirectory(prefix='inkroam-render-') as temp:
            raw=Path(temp)/'raw.wav'
            mastered=Path(temp)/'master.wav'
            loopraw=Path(temp)/'loop.wav'
            x=render(cfg,events,0,160)
            write_wav(raw,x)
            del x
            measured=loudness(raw)
            # One constant gain preserves dynamics and, on the loop, the seam.
            gain_db=min(-18-float(measured['input_i']),-1.8-float(measured['input_tp']))
            run_ffmpeg('-i',raw,'-af',f'volume={gain_db:.6f}dB','-ar',SR,'-c:a','pcm_s16le',mastered)
            tags=['-metadata',f"title={cfg['title']} / {cfg['english']}",'-metadata','artist=Inkroam',
                  '-metadata','album=Paper Hours, Vol. 1','-metadata',f'track={index}',
                  '-metadata',f'comment=Procedural original; source and MIDI included; {cfg["bpm"]} BPM']
            run_ffmpeg('-i',mastered,*tags,'-c:a','libmp3lame','-b:a','160k',root/'audio'/(cfg['id']+'.mp3'))
            run_ffmpeg('-i',mastered,*tags,'-c:a','flac',root/'masters'/(cfg['id']+'.flac'))
            if not args.full_only:
                print('Rendering periodic 32-bar loop',flush=True)
                loop=render(cfg,events,16,128,loop=True)
                loop*=10**(gain_db/20)
                write_wav(loopraw,loop)
                seam=float(np.max(np.abs(loop[0]-loop[-1])))
                peak=float(np.max(np.abs(loop)))
                del loop
                run_ffmpeg('-i',loopraw,*tags,'-c:a','libvorbis','-q:a','4',root/'web'/(cfg['id']+'.loop.ogg'))
                run_ffmpeg('-i',loopraw,*tags,'-c:a','flac',root/'masters'/(cfg['id']+'.loop.flac'))
            master_stats=loudness(mastered)
            item={k:cfg[k] for k in ['id','title','english','bpm','key','mood','seed']}
            item.update(durationSeconds=round(160*60/cfg['bpm']+3,3),
                        loopDurationSeconds=round(round(128*60/cfg['bpm']*SR)/SR,6),
                        loopFrames=round(128*60/cfg['bpm']*SR),sampleRate=SR,channels=2,
                        listeningFile='audio/'+cfg['id']+'.mp3',
                        midiFile='scores/'+cfg['id']+'.mid',eventsFile='scores/'+cfg['id']+'.json',
                        integratedLufs=float(master_stats['input_i']),truePeakDbtp=float(master_stats['input_tp']),
                        noteEvents=len(events),
                        structure='4 intro / 8 A / 8 A variation / 8 B / 8 A return / 4 outro')
            if not args.full_only:
                item.update(loopFile='web/'+cfg['id']+'.loop.ogg',loopPeak=round(peak,6),loopBoundaryStep=round(seam,6))
            manifest.append(item)
            print(json.dumps(item,ensure_ascii=False),flush=True)
    existing=root/'manifest.json'
    if args.track!='all' and existing.exists():
        old=json.loads(existing.read_text(encoding='utf-8'))
        ids={x['id'] for x in manifest}
        manifest=sorted([x for x in old['tracks'] if x['id'] not in ids]+manifest,key=lambda x:x['id'])
    existing.write_text(json.dumps({'album':'Inkroam — Paper Hours, Vol. 1','version':2,
                                    'masteringTargetLufs':-18,'tracks':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Finished.',flush=True)


if __name__=='__main__':
    main()
