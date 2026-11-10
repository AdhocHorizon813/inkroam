"""Original Paper Hours Vol. 3 scores. No reference audio/MIDI is imported.

All pitches and phrase rhythms are authored here. Randomness in the renderer
only affects timbre; this score is deterministic. Beat units are quarter notes.
"""

PC = {'C': 0, 'C#': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}


def midi(name):
    return name if isinstance(name, int) else (int(name[-1]) + 1) * 12 + PC[name[:-1]]


def chord(name, root, notes):
    return dict(name=name, root=midi(root), notes=[midi(n) for n in notes.split()])


CHORDS = {
    'D9': chord('Dmaj9', 'D2', 'F#3 A3 C#4 E4'),
    'Fm7': chord('F#m7', 'F#2', 'E3 A3 C#4 F#4'),
    'Bm9': chord('Bm9', 'B1', 'F#3 A3 C#4 D4'),
    'G9': chord('Gmaj9', 'G2', 'F#3 A3 B3 D4'),
    'Em9': chord('Em9', 'E2', 'G3 B3 D4 F#4'),
    'A13': chord('A13', 'A1', 'G3 B3 C#4 F#4'),
    'D6': chord('D6/9', 'D2', 'F#3 A3 B3 E4'),
    'Gm9': chord('Gm(add9)', 'G2', 'G3 Bb3 D4 A4'),
    'Bb7': chord('Bbmaj7', 'Bb1', 'A3 Bb3 D4 F4'),
    'Eb7': chord('Ebmaj7', 'Eb2', 'G3 Bb3 D4 Eb4'),
    'Cm9': chord('Cm9', 'C2', 'G3 Bb3 D4 Eb4'),
    'Dsus': chord('Dsus4', 'D2', 'G3 A3 D4'),
    'Ddom': chord('D', 'D2', 'F#3 A3 D4'),
    'F6': chord('F6', 'F2', 'A3 C4 D4 F4'),
    'Am9': chord('Amaj9', 'A1', 'G#3 B3 C#4 E4'.replace('G#', 'Ab')),
    'Csm7': chord('C#m7', 'C#2', 'Ab3 B3 C#4 E4'),
    'Fsm9': chord('F#m9', 'F#2', 'A3 C#4 E4 Ab4'),
    'E6': chord('E6/9', 'E2', 'Ab3 B3 C#4 F#4'),
}

# One bar per entry. Breaths are intentional; neither a random walk nor an
# endless arpeggio is used as the lead melody.
TRACKS = [
    dict(id='01_windows_in_orbit', title='舷窗之外', english='Windows in Orbit',
         bpm=84, meter=4, bars=48, key='D major', style='orbit', seed=311,
         A=['D9','Fm7','Bm9','G9','D9','Fm7','Em9','A13'],
         B=['G9','D9','Em9','A13','G9','Bm9','Em9','A13'], final='D6',
         melody=[[(.5,'A4',.65),(1.5,'F#4',.4),(2.25,'E4',1.2)],
                 [(.25,'E4',.65),(1.25,'C#4',.9),(2.75,'F#4',.7)],
                 [(.5,'F#4',1.3),(2.25,'D4',.55),(3,'C#4',.55)],
                 [(.5,'B3',.65),(1.5,'D4',.6),(2.5,'A4',1)],
                 [(.5,'A4',.65),(1.5,'F#4',.4),(2.25,'E4',1.2)],
                 [(.25,'E4',.65),(1.25,'C#4',.9),(2.75,'A4',.7)],
                 [(.5,'G4',.9),(1.75,'F#4',.65),(2.75,'E4',.65)],
                 [(.5,'C#4',.75),(1.75,'B3',.75),(3,'A3',.65)]],
         bridge=[[(.5,'B4',1),(2,'A4',.7)],[(.5,'F#4',1.8)],
                 [(.5,'G4',.65),(1.5,'B4',1.2)],[(.5,'A4',1),(2,'F#4',1)],
                 [(.5,'D5',1),(2,'B4',.65)],[(.5,'A4',.65),(1.5,'F#4',1.1)],
                 [(.5,'G4',.65),(1.5,'F#4',.65),(2.5,'E4',.65)],[(.5,'C#4',2.6)]]),
    dict(id='02_the_last_ferry', title='末班渡船', english='The Last Ferry',
         bpm=92, meter=4, bars=48, key='G minor', style='harbor', seed=312,
         A=['Gm9','Gm9','Eb7','Bb7','Cm9','Gm9','Dsus','Ddom'],
         B=['Eb7','F6','Bb7','Gm9','Cm9','Eb7','Dsus','Ddom'], final='Gm9',
         melody=[[(.25,'D4',1.2),(2,'A4',1.3)],[(.5,'G4',1),(2,'D4',1.5)],
                 [(.25,'G4',.8),(1.5,'F4',.45),(2.25,'Eb4',1.2)],[(.5,'D4',2.5)],
                 [(.25,'Eb4',1),(1.75,'G4',.75),(3,'D4',.7)],[(.5,'Bb3',.7),(1.75,'D4',1.5)],
                 [(.5,'A3',1.3),(2.25,'G4',1.1)],[(.5,'F#4',1.4),(2.5,'D4',1)]],
         bridge=[[(.25,'Bb4',1.2),(2,'G4',1.3)],[(.5,'A4',1),(2,'F4',1.3)],
                 [(.25,'F4',.8),(1.5,'D4',1.6)],[(.5,'G4',2.5)],
                 [(.25,'G4',.85),(1.5,'Eb4',.6),(2.5,'D4',.7)],[(.5,'Bb3',1),(2,'Eb4',1.4)],
                 [(.5,'G4',1.2),(2.25,'A4',1.2)],[(.5,'F#4',2.8)]]),
    dict(id='03_afterimage_at_dusk', title='日落后的余像', english='Afterimage at Dusk',
         bpm=90, meter=4, bars=48, key='A major / F# minor', style='afterimage', seed=313,
         A=['D9','Am9','Fsm9','E6','D9','Csm7','Bm9','E6'],
         B=['Bm9','Fsm9','D9','E6','Bm9','Csm7','D9','E6'], final='Am9',
         melody=[[(1,'E5',1),(2.75,'C#5',.9)],[(.5,'B4',1),(2,'Ab4',1.5)],
                 [(1,'A4',.8),(2.5,'C#5',1)],[(.5,'B4',2.5)],
                 [(1,'E5',1),(2.75,'F#5',.9)],[(.5,'E5',1),(2,'C#5',1.5)],
                 [(1,'D5',.8),(2.5,'C#5',1)],[(.5,'B4',1),(2,'Ab4',1.5)]],
         bridge=[[(.5,'F#4',1.2),(2,'A4',1.3)],[(1,'Ab4',.8),(2.5,'F#4',1)],
                 [(.5,'A4',1.2),(2,'C#5',1.2)],[(.5,'B4',2.6)],
                 [(.5,'D5',1.2),(2,'F#5',1.2)],[(1,'E5',.8),(2.5,'C#5',1)],
                 [(.5,'A4',1.2),(2,'F#4',1.2)],[(.5,'Ab4',2.6)]]),
]

SECTIONS = [(0,4,'Intro'), (4,12,'Theme'), (12,20,'Theme variation'),
            (20,28,'Middle'), (28,32,'Interlude'), (32,40,'Return'), (40,48,'Coda')]


def arrange(cfg):
    names = cfg['A'][:4] + cfg['A'] * 2 + cfg['B'] + cfg['B'][4:] + cfg['A'] + cfg['A'][:6] + [cfg['final']] * 2
    events = []
    style = cfg['style']

    def put(lane, bar, at, note, length, velocity, pan=0):
        # Direct notes release before a different next-bar harmony. Reverb can
        # continue naturally; the source does not stack unrelated chords.
        limit = (bar + 1) * 4
        same = bar + 1 < 48 and names[bar+1] == names[bar]
        boundary = (bar + 2) * 4 if same else limit
        beat = bar * 4 + at
        length = min(length, boundary - beat - .045)
        if length > 0:
            events.append(dict(lane=lane,beat=beat,note=midi(note),length=length,
                               velocity=velocity,pan=pan,boundary=boundary))

    for bar, name in enumerate(names):
        c = CHORDS[name]
        notes, root = c['notes'], c['root']
        intro, middle, interlude, outro = bar < 4, 20 <= bar < 28, 28 <= bar < 32, bar >= 40
        full = not intro and not interlude and bar < 44
        level = .76 if intro or interlude else (.83 if outro else 1)
        # The pad is a quiet sustained depth layer, not the lead.
        for j,n in enumerate(notes):
            put('pad',bar,0,n,3.72,.30 * level,(-.4,-.12,.14,.4)[j % 4])
        if style == 'orbit':
            for at,vel,dur in [(0,.48,1.1),(1.7,.35,.8),(3.15,.38,.65)]:
                for j,n in enumerate(notes):
                    put('keys',bar,at+j*.012,n,dur,vel*level,-.18)
            if bar >= 2 and bar < 46:
                for at,n,dur,v in [(0,root,.8,.8),(1.6,root+12,.4,.5),(2.5,root,.75,.65),(3.5,root+7,.35,.45)]:
                    put('bass',bar,at,n,dur,v*level)
            if full and bar % 4 == 3:
                put('arp',bar,3,notes[2]+12,.35,.20,.38)
        elif style == 'harbor':
            # Picked chord fragments, not a strummed wall. Alternating registers
            # leave the middle open for the authored melody.
            for k,index in enumerate([0,2,1,3,2,1]):
                put('guitar',bar,k*.5+.04,notes[index % len(notes)],.82,.42*level, -.34 if k%2 else .22)
            if bar >= 4 and bar < 46:
                for k in range(8):
                    put('bass',bar,k*.5,root + (7 if k==6 else 12 if k==7 and bar%2 else 0),.38,.58*(1 if k%2==0 else .72)*level)
        else:
            # A different rhythm and eight-bar progression from the reference.
            for at,dur,vel in [(0,.85,.55),(1.5,.65,.44),(2.5,1.05,.48)]:
                for j,n in enumerate(notes):
                    put('keys',bar,at,n,dur,vel*level,(-.25,-.08,.08,.25)[j%4])
            if bar >= 2 and bar < 46:
                for at,dur,v in [(0,.83,.8),(1,.65,.6),(2.5,.8,.72),(3.5,.38,.48)]:
                    put('bass',bar,at,root,dur,v*level)
            if full and bar >= 12:
                for k,index in enumerate([1,2,3,2]):
                    put('arp',bar,k+.5,notes[index%len(notes)]+12,.32,.18,.36 if k%2 else -.36)

        if not intro and not interlude:
            phrase = cfg['bridge'][bar-20] if middle else cfg['melody'][(bar-4)%8]
            if bar >= 46:
                phrase = [(.5, {'orbit':'D4','harbor':'G4','afterimage':'A4'}[style],2.8)] if bar==46 else []
            for at,n,length in phrase:
                vel = (.59 if style=='orbit' else .62 if style=='harbor' else .35) * level
                put('lead',bar,at,n,length,vel, .06)
        elif bar == 30:
            put('lead',bar,1,notes[2]+12,1.4,.32,.12)

        if full or (intro and bar>=2) or (outro and bar<46):
            drum_level = (.50 if style=='harbor' else .72) * level
            kicks = [0,2.5] if style=='orbit' else [0,2] if style=='harbor' else [0,1.75,2.5]
            for at in kicks:
                put('drums',bar,at,36,.25,drum_level)
            if not intro:
                for at in [1,3]:
                    put('drums',bar,at+.014,38,.22,drum_level*.68,.06)
            for k in range(8):
                swing = .065 if style=='orbit' and k%2 else 0
                put('drums',bar,k*.5+swing,42,.09,drum_level*(.24 if k%2==0 else .15),.23)
            if full and bar%8==3:
                put('drums',bar,3.72,38,.15,drum_level*.22,-.1)

    return sorted(events,key=lambda e:e['beat']),[CHORDS[n] for n in names]
