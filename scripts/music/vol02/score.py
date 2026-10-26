"""Paper Hours Vol. 2, revision 2: simpler harmony and singable repeated phrases.

Quarter-note beat units in both meters. MIDI C4 = 60. The revision-1 score and
rendered files remain in tmp/inkroam-lofi-vol02 and its existing ZIP.
"""
import numpy as np

PC = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,
      'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}


def midi(note):
    return note if isinstance(note,int) else (int(note[-1])+1)*12+PC[note[:-1]]


def chord(name,root,notes):
    return {'name':name,'root':midi(root),'notes':[midi(n) for n in notes.split()]}


CHORDS = {
    'D':chord('D','D2','D3 F#3 A3'),
    'Bm':chord('Bm','B1','D3 F#3 B3'),
    'G':chord('G','G1','D3 G3 B3'),
    'A':chord('A','A1','E3 A3 C#4'),
    'Em':chord('Em','E2','E3 G3 B3'),
    'Am':chord('Am','A1','E3 A3 C4'),
    'F':chord('F','F2','F3 A3 C4'),
    'C':chord('C','C2','E3 G3 C4'),
    'Gnatural':chord('G','G1','D3 G3 B3'),
    'Dm':chord('Dm','D2','F3 A3 D4'),
    'Emnatural':chord('Em','E2','E3 G3 B3'),
    'Eb':chord('Eb','Eb2','G3 Bb3 Eb4'),
    'Cm':chord('Cm','C2','G3 C4 Eb4'),
    'Ab':chord('Ab','Ab1','Ab3 C4 Eb4'),
    'Bb':chord('Bb','Bb1','F3 Bb3 D4'),
    'Fm':chord('Fm','F2','Ab3 C4 F4'),
}

# The first four bars establish a question/answer; bars five to eight repeat
# that contour and change its ending. No algorithmically selected melody notes.
TRACKS = [
    dict(id='01_a_blank_afternoon',title='午后的空白',english='A Blank Afternoon',
         bpm=76,meter=4,key='D major',seed=26201,style='afternoon',
         mood='柔和钢琴 · 简单的晴天旋律',
         A=['D','Bm','G','A','D','Bm','Em','A'],
         B=['G','D','Em','A','G','Bm','A','D'],final='D',
         melody=[[(.5,'F#4',.85),(1.75,'A4',1.6)],
                 [(.5,'F#4',.85),(1.75,'D4',1.6)],
                 [(.5,'G4',.85),(1.75,'B4',.7),(2.75,'G4',.7)],
                 [(.5,'A4',.85),(1.75,'E4',1.6)],
                 [(.5,'F#4',.85),(1.75,'A4',1.6)],
                 [(.5,'F#4',.85),(1.75,'D4',1.6)],
                 [(.5,'G4',.85),(1.75,'B4',.7),(2.75,'G4',.7)],
                 [(.5,'E4',.85),(1.75,'C#4',1.6)]],
         bridge=[[(.5,'B4',1),(2,'G4',1.2)],[(.5,'A4',1),(2,'F#4',1.2)],
                 [(.5,'G4',1),(2,'E4',1.2)],[(.5,'E4',2.7)],
                 [(.5,'G4',.85),(1.75,'B4',1.6)],[(.5,'F#4',.85),(1.75,'D4',1.6)],
                 [(.5,'E4',1),(2,'C#4',1.2)],[(.5,'D4',2.7)]]),
    dict(id='02_along_the_river',title='沿河慢行',english='Along the River',
         bpm=80,meter=4,key='A minor',seed=26202,style='river',
         mood='温暖电钢琴 · 稳定律动',
         A=['Am','F','C','Gnatural','Am','F','Dm','Emnatural'],
         B=['F','C','Dm','Am','F','Dm','Emnatural','Am'],final='Am',
         melody=[[(.5,'E4',.65),(1.5,'A4',.8),(2.75,'C5',.75)],
                 [(.5,'C5',.9),(2,'A4',1.3)],
                 [(.5,'G4',.65),(1.5,'E4',.8),(2.75,'G4',.75)],
                 [(.5,'B4',.9),(2,'G4',1.3)],
                 [(.5,'E4',.65),(1.5,'A4',.8),(2.75,'C5',.75)],
                 [(.5,'C5',.9),(2,'A4',1.3)],
                 [(.5,'A4',.65),(1.5,'F4',.8),(2.75,'D4',.75)],
                 [(.5,'G4',.9),(2,'E4',1.3)]],
         bridge=[[(.5,'A4',1),(2,'C5',1.3)],[(.5,'G4',1),(2,'E4',1.3)],
                 [(.5,'F4',1),(2,'A4',1.3)],[(.5,'E4',2.7)],
                 [(.5,'C5',1),(2,'A4',1.3)],[(.5,'A4',1),(2,'F4',1.3)],
                 [(.5,'G4',1),(2,'E4',1.3)],[(.5,'A4',2.7)]]),
    dict(id='03_a_light_left_on',title='灯还留着',english='A Light Left On',
         bpm=62,meter=3,key='Eb major',seed=26203,style='night',
         mood='三拍钢琴 · 安静的短句',
         A=['Eb','Cm','Ab','Bb','Eb','Cm','Fm','Bb'],
         B=['Ab','Eb','Fm','Cm','Ab','Fm','Bb','Eb'],final='Eb',
         melody=[[(.25,'G4',.9),(1.5,'Bb4',1)],[(.25,'G4',.9),(1.5,'Eb4',1)],
                 [(.25,'Eb4',.9),(1.5,'Ab4',1)],[(.25,'F4',2.1)],
                 [(.25,'G4',.9),(1.5,'Bb4',1)],[(.25,'G4',.9),(1.5,'Eb4',1)],
                 [(.25,'F4',.9),(1.5,'Ab4',1)],[(.25,'F4',.9),(1.5,'D4',1)]],
         bridge=[[(.25,'Ab4',.9),(1.5,'C5',1)],[(.25,'Bb4',.9),(1.5,'G4',1)],
                 [(.25,'Ab4',.9),(1.5,'F4',1)],[(.25,'G4',2.1)],
                 [(.25,'Eb4',.9),(1.5,'Ab4',1)],[(.25,'F4',2.1)],
                 [(.25,'F4',.9),(1.5,'D4',1)],[(.25,'Eb4',2.1)]]),
]
SECTIONS=[(0,4,'Intro'),(4,12,'A'),(12,20,'A variation'),(20,28,'B'),
          (28,32,'Interlude'),(32,40,'Return'),(40,48,'Coda')]


def arrange(cfg):
    rng=np.random.default_rng(cfg['seed'])
    meter=cfg['meter']
    harmony=cfg['A'][:4]+cfg['A']*2+cfg['B']+cfg['B'][4:]+cfg['A']+cfg['B'][:6]+[cfg['final']]*2
    events=[]

    def add(lane,at,note,length,vel,pan=0,bar=0):
        onset=max(bar*meter,at+rng.uniform(-.006,.006))
        boundary=(bar+1)*meter if lane!='drums' and bar<47 and harmony[bar]!=harmony[bar+1] else None
        if boundary is not None:
            length=min(length,max(.05,boundary-onset-.2*cfg['bpm']/60))
        events.append(dict(lane=lane,beat=round(onset,5),bar=bar,note=midi(note),
                           length=round(length,5),velocity=round(float(vel*rng.uniform(.97,1.03)),5),pan=pan,
                           harmonicBoundary=boundary))

    for bar,token in enumerate(harmony):
        c=CHORDS[token]
        at=bar*meter
        intro,quiet,coda=bar<4,28<=bar<32,bar>=40
        final=bar>=46
        drive=.65 if intro else .65 if quiet else .78 if coda else 1
        if cfg['style']=='night':
            for k,note in enumerate(c['notes']):
                add('keys',at+k*.45,note,1.7-k*.25,.38*drive,(k-1)*.14,bar)
        else:
            strikes=[(.02,2.3,.40),(2.6,.85,.26)]
            if cfg['style']=='river':
                strikes=[(.08,1.8,.42),(2.1,1.2,.31)]
            if intro or quiet or final:
                strikes=[(.02,2.7,.37)]
            for beat,length,vel in strikes:
                for k,note in enumerate(c['notes']):
                    add('keys',at+beat+k*.025,note,length,vel*drive,(k-1)*.13,bar)
        if bar>=2:
            add('bass',at,c['root'],meter*.59,.48*drive,bar=bar)
            if not (intro or quiet or final) and cfg['style']!='night':
                add('bass',at+2.55,c['root'],.72,.27*drive,bar=bar)
        # No old harmony held 1.5 bars across a new chord. The renderer also
        # fades the direct instrument before the next harmonic boundary.
        for k,note in enumerate([c['root']+24,c['root']+31]):
            add('air',at+.12,note,meter-.85,.10*drive,(k-.5)*.5,bar)
        if 4<=bar<28 or 32<=bar<46:
            index=(bar-20)%8 if 20<=bar<28 else (bar-4)%8 if bar<20 else (bar-32)%8
            phrase=cfg['bridge'][index] if 20<=bar<28 or coda else cfg['melody'][index]
            if coda:
                phrase=cfg['bridge'][(bar-40)%8][:1]
            for beat,note,length in phrase:
                add('melody',at+beat,note,length,(.66 if 12<=bar<20 else .60)*drive,-.05,bar)
        elif final and bar==46:
            add('melody',at+.25,{'afternoon':'D4','river':'A4','night':'Eb4'}[cfg['style']],meter*1.5,.42,-.05,bar)
        drums=4<=bar<44 and not quiet
        if drums and cfg['style']=='night':
            if bar%2==0:
                add('drums',at,36,.2,.20,bar=bar)
            add('drums',at+1.08,38,.18,.16,-.15,bar)
        elif drums:
            add('drums',at,36,.25,.61*drive,bar=bar)
            add('drums',at+2.55,36,.22,.34*drive,bar=bar)
            for beat in [1.035,3.035]:
                add('drums',at+beat,38,.15,.32*drive,-.14,bar)
            # Sparse, steady eighth notes; no decorative drum fills.
            for k in ([0,1,3,4,5,7] if cfg['style']=='river' else [0,2,4,6]):
                add('drums',at+k*.5+(.055 if k%2 else .008),42,.09,(.18 if k%2 else .23)*drive,.22,bar)
    events.sort(key=lambda e:(e['beat'],e['lane'],e['note']))
    return events,harmony
