"""Package original rendered tracks using Python standard library and ffmpeg."""
import argparse, array, hashlib, html, json, math, re, struct, subprocess, zipfile
from pathlib import Path

LANES = ['keys','guitar','pad','lead','bass','arp','drums']

def vlq(n):
    n=int(n); out=[n&127]
    while n>>7:
        n>>=7; out.insert(0,(n&127)|128)
    return bytes(out)

def chunk(events):
    out=bytearray(); previous=0
    for tick,priority,data in sorted(events):
        out.extend(vlq(tick-previous)); out.extend(data); previous=tick
    out.extend(b'\x00\xff\x2f\x00')
    return b'MTrk'+struct.pack('>I',len(out))+out

def midi(score,path):
    cfg=score['track']; bpm=float(cfg['bpm']); end=float(cfg['bars'])*float(cfg.get('meter',4))
    assert math.isfinite(bpm) and 20<=bpm<=300 and math.isfinite(end) and end>0
    tracks=[chunk([(0,0,b'\xff\x51\x03'+round(60000000/bpm).to_bytes(3,'big')),(0,1,b'\xff\x58\x04\x04\x02\x18\x08')])]
    lanes={lane:[] for lane in LANES}
    for e in score['events']:
        lane=e['lane']; note=e['note']; beat=float(e['beat']); length=float(e['length']); velocity=float(e['velocity']); pan=float(e.get('pan',0)); boundary=float(e.get('boundary',end))
        assert lane in lanes and isinstance(note,int) and 0<=note<=127, 'Invalid lane/note'
        assert all(math.isfinite(v) for v in [beat,length,velocity,pan,boundary]), 'Nonfinite event'
        assert 0<=beat<end and length>0 and 0<=velocity<=1 and -1<=pan<=1 and beat<boundary<=end, 'Event out of range'
        channel=9 if lane=='drums' else LANES.index(lane); start=round(beat*480); stop=max(start+1,round(min(beat+length,boundary,end)*480))
        lanes[lane].extend([(start,1,bytes([0xB0|channel,10,round((pan+1)*63.5)])),(start,2,bytes([0x90|channel,note,max(1,round(velocity*127))])),(stop,0,bytes([0x80|channel,note,0]))])
    for i,lane in enumerate(LANES):
        label=lane.encode(); events=[(0,-2,b'\xff\x03'+vlq(len(label))+label)]
        if i<6: events.append((0,-1,bytes([0xC0|i,[4,24,89,80,33,10][i]])))
        tracks.append(chunk(events+lanes[lane]))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(tracks),480)+b''.join(tracks))
    return len(score['events'])

def inspect_audio(ffmpeg,path,expected):
    proc=subprocess.Popen([str(ffmpeg),'-nostdin','-v','error','-i',str(path),'-ar','44100','-ac','2','-f','f32le','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    count=0; peak=0.; finite=True; tail=array.array('f')
    while True:
        raw=proc.stdout.read(65536)
        if not raw: break
        values=array.array('f'); values.frombytes(raw)
        finite=finite and all(math.isfinite(v) for v in values); peak=max(peak,max(map(abs,values),default=0)); count+=len(values)
        tail.extend(values)
        if len(tail)>22050: del tail[:-22050]
    error=proc.stderr.read().decode(errors='replace'); assert proc.wait()==0,error
    duration=count/88200; tail_rms=math.sqrt(sum(v*v for v in tail)/max(len(tail),1))
    assert finite and count and 1e-5<peak<1.,f'Nonfinite, silent, empty, or clipped audio: {path} peak={peak}'
    assert abs(duration-expected)<2.,f'Duration mismatch: {path}: {duration} vs {expected}'
    run=subprocess.run([str(ffmpeg),'-nostdin','-hide_banner','-i',str(path),'-af','loudnorm=print_format=json','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace')
    assert run.returncode==0,run.stderr[-1000:]
    matches=re.findall(r'\{\s*"input_i".*?\}',run.stderr,re.S); assert matches,'No loudnorm results'
    loud=json.loads(matches[-1])
    digest=hashlib.sha256()
    with path.open('rb') as audio_file:
        for block in iter(lambda:audio_file.read(1024*1024),b''): digest.update(block)
    return dict(sha256=digest.hexdigest(),durationSeconds=round(duration,4),decodedFinite=finite,samplePeak=round(peak,6),decodedClipping=False,tailQuarterSecondRmsDbfs=round(20*math.log10(max(tail_rms,1e-12)),2),tailBelowMinus50Dbfs=tail_rms<10**(-50/20),integratedLufs=float(loud['input_i']),truePeakDbtp=float(loud['input_tp']),loudnessRangeLu=float(loud['input_lra']))

def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--out',required=True,type=Path); parser.add_argument('--ffmpeg',required=True,type=Path); args=parser.parse_args()
    root=args.out.resolve(); manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8')); checks=[]; cards=[]; (root/'midi').mkdir(exist_ok=True); esc=html.escape
    for t in manifest['tracks']:
        score=json.loads((root/t['score']).read_text(encoding='utf-8')); midi_path='midi/'+t['id']+'.mid'; count=midi(score,root/midi_path)
        checks.append(dict(id=t['id'],midiEvents=count,audio=inspect_audio(args.ffmpeg,root/t['audio'],float(t['durationSeconds'])),master=inspect_audio(args.ffmpeg,root/t['master'],float(t['durationSeconds'])),preview=inspect_audio(args.ffmpeg,root/t['preview'],45)))
        links=' · '.join(f'<a href="{esc(t[key],quote=True)}">{label}</a>' for key,label in [('audio','MP3'),('preview','45 秒试听'),('master','FLAC'),('score','乐谱 JSON')])
        title=esc(t['title'],quote=True)
        cards.append(f'<section><h2>{title}</h2><p>{esc(t.get("english",""))} · {t["bpm"]} BPM · {esc(t["key"])}</p><audio controls preload="none" aria-label="播放 {title}" src="{esc(t["audio"],quote=True)}"></audio><p>{links} · <a href="{midi_path}">MIDI</a></p></section>')
    (root/'technical-checks.json').write_text(json.dumps(dict(method='ffmpeg decoded PCM and loudnorm; no human audition or perceptual quality certification',tracks=checks),ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    (root/'CREDITS.txt').write_text('Paper Hours Vol. 3\nAI-generated original compositions and code-synthesized instruments.\nUser-provided reference tracks influenced general musical direction only; no reference audio or melodic events are included.\nThe guitar is synthesized, not a live recording. No third-party samples are used.\nMIDI playback differs from the rendered synthesis. Technical measurements are not human audition or a quality guarantee.\n',encoding='utf-8')
    page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paper Hours Vol. 3</title><style>body{margin:0;background:#121820;color:#e9e4da;font:16px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:48px 22px}h1{font-size:2.5rem;line-height:1.15}h2{margin-bottom:0}section{padding:22px 0;border-top:1px solid #3b4552}p{color:#c2c6cb}a{color:#b8d8ed;text-underline-offset:4px}a:focus-visible{outline:2px solid white;outline-offset:4px}audio{width:100%;margin-top:10px}footer{margin-top:32px;font-size:.9rem}</style><main><h1>Paper Hours Vol. 3</h1><p>原创合成音乐 · 选择播放，慢慢听。</p>'''+''.join(cards)+'''<footer><a href="CREDITS.txt">制作说明</a> · <a href="technical-checks.json">技术测量</a><p>AI 生成的原创作曲与代码合成乐器；吉他为合成音色。未经人工试听评价。</p></footer></main><script>document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause()})},true)</script></html>'''
    (root/'playlist.html').write_text(page,encoding='utf-8'); archive=root/'paper-hours-vol03.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for name in ['manifest.json','technical-checks.json','CREDITS.txt','playlist.html']: z.write(root/name,name)
        for directory in ['audio','masters','scores','previews','midi']:
            for path in sorted((root/directory).rglob('*')):
                if path.is_file(): z.write(path,path.relative_to(root).as_posix())
        for path in sorted(Path(__file__).resolve().parent.glob('*.py')): z.write(path,'scripts/music/vol03/'+path.name)
    print(json.dumps(dict(tracks=len(checks),archive=str(archive),technicalChecks=str(root/'technical-checks.json')),ensure_ascii=False))

if __name__=='__main__': main()
