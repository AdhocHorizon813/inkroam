"""Verify the rendered deliverables and package an editable, attributed album."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil
import struct
import subprocess
import zipfile

import numpy as np

ROOT=Path(__file__).resolve().parents[3]


def midi_events(path):
    data=path.read_bytes()
    assert data[:4]==b'MThd' and struct.unpack('>HHH',data[8:14])==(1,7,960)
    pos=14
    on=off=0
    while pos<len(data):
        assert data[pos:pos+4]==b'MTrk'
        size=int.from_bytes(data[pos+4:pos+8],'big')
        end=pos+8+size
        pos+=8
        def vlq():
            nonlocal pos
            n=0
            while True:
                b=data[pos]; pos+=1; n=(n<<7)|(b&127)
                if b<128:
                    return n
        while pos<end:
            vlq()
            status=data[pos]; pos+=1
            if status==255:
                pos+=1
                count=vlq(); pos+=count
            elif status&240 in (128,144):
                on+=status&240==144
                off+=status&240==128
                pos+=2
            elif status&240==192:
                pos+=1
            else:
                raise ValueError(f'Unexpected MIDI event {status}')
        assert pos==end
    assert on==off
    return on


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ffmpeg',required=True)
    p.add_argument('--out',type=Path,default=ROOT/'tmp'/'inkroam-lofi-vol02-r2')
    args=p.parse_args()
    out=args.out
    manifest=json.loads((out/'manifest.json').read_text(encoding='utf-8'))
    assert len(manifest['tracks'])==3
    report=[]
    for track in manifest['tracks']:
        path=out/track['audio']
        raw=subprocess.run([args.ffmpeg,'-v','error','-i',str(path),'-f','f32le','-ac','2','-ar','44100','pipe:1'],capture_output=True,check=True).stdout
        audio=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
        score=json.loads((out/'scores'/(track['id']+'.json')).read_text(encoding='utf-8'))
        assert np.isfinite(audio).all() and np.max(np.abs(audio))<1
        assert abs(len(audio)/44100-track['durationSeconds'])<.1
        assert all(0<=e['note']<=127 and e['length']>0 and e['beat']>=0 for e in score['events'])
        assert midi_events(out/'scores'/(track['id']+'.mid'))==len(score['events'])
        assert len(score['chords'])==48
        # A deliberate constraint of this revision, not a general rule that
        # consonance or chord membership is sufficient for good music.
        for e in score['events']:
            if e['lane']=='drums':
                continue
            harmony=score['chords'][e['bar']]
            pcs={n%12 for n in harmony['notes']} | {harmony['root']%12}
            assert e['note']%12 in pcs, (track['id'],e,harmony)
            if e.get('harmonicBoundary') is not None:
                assert e['beat']+e['length'] <= e['harmonicBoundary']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==track['sha256']
        assert track['truePeakDbtp'] < -1.5
        # The middle, not the fade-out, must contain audible signal.
        middle=audio[20*44100:-10*44100]
        rms=float(np.sqrt(np.mean(middle**2)))
        assert rms>.004
        correlation=float(np.corrcoef(middle[::40,0],middle[::40,1])[0,1])
        assert correlation>0
        ending=float(np.sqrt(np.mean(audio[-4410:]**2)))
        assert ending<.002
        report.append(dict(id=track['id'],decodedSeconds=round(len(audio)/44100,4),
                           decodedSamplePeakDb=round(float(20*np.log10(np.max(np.abs(audio)))),2),
                           middleRmsDb=round(20*np.log10(rms),2),stereoCorrelation=round(correlation,4),
                           last100msRms=ending,midiNotePairs=len(score['events']),
                           harmonicMembership='pass',directNoteBoundary='pass',result='pass'))
    (out/'technical-checks.json').write_text(json.dumps({'checks':report,'notChecked':'Subjective listening on speakers/headphones; not a perceptual quality score.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    source=out/'scripts'/'music'/'vol02'
    source.mkdir(parents=True,exist_ok=True)
    for name in ['score.py','render.py','fetch_samples.py','samples.json','package.py','requirements.txt']:
        shutil.copy2(Path(__file__).with_name(name),source/name)
    samples=out/'samples'
    samples.mkdir(exist_ok=True)
    for file in (ROOT/'tmp'/'inkroam-vol02-samples').iterdir():
        if file.suffix.lower() in ('.flac','.txt'):
            shutil.copy2(file,samples/file.name)
    credits='''# Credits / 采样署名

曲谱、旋律、和声编排及渲染代码：为 Inkroam 制作，AI 辅助编写，2026-10-26。
没有引用既有歌曲旋律或整段音乐循环；这不是对全世界旋律库的独创性检索结论。

第1、3首的钢琴音色采用 **Salamander Grand Piano v3 — Alexander Holm** 的软力度采样；FLAC/SFZ仓库由 kinwie 重新映射。
来源：https://github.com/sfzinstruments/SalamanderGrandPiano
固定版本：3382bf9496bba2486f5ab0de55a264d1dfc38404
许可：Creative Commons Attribution 3.0 Unported（CC BY 3.0）
许可链接：https://creativecommons.org/licenses/by/3.0/
许可全文随包保存于 samples/LICENSE.txt。
本工程只选取12个v4力度层样本，进行少量移调、包络、滤波、声像与混响处理；没有完整实现其SFZ、踏板与共鸣系统。
第2首使用代码合成的电钢琴、木质短音、低音、铺底与打击乐，没有使用钢琴采样。
其它鼓、低音和铺底亦由代码合成，无第三方鼓循环、环境录音或人声。

若发布音频或再次分发工程，请同时保留上述采样作者、来源、许可和处理说明。
这不是采样作者对 Inkroam 的背书，也不主张第三方采样的排他所有权。
'''
    (out/'CREDITS.md').write_text(credits,encoding='utf-8')
    lines=['# Inkroam — Paper Hours, Vol. 2 · Revision 2','',
           '三首无歌词的阅读音乐：午后、夜行、留灯。完整编曲，不是神经音乐模型输出。',
           'AI辅助写作曲谱与合成器，真实钢琴采样配合合成音色。主观听感待你试听。','',
           '根据初版实际试听反馈重编：三和弦、重复问答主题、减少高音装饰，低音不再使用半音连接。铺底和其它直接音源在换和弦前释放，混响缩短；保留初版文件供对比。', '',
           '| 曲目 | 时长 | 节奏 | 成品响度 |','| --- | --- | --- | --- |']
    cards=[]
    for i,t in enumerate(manifest['tracks'],1):
        sec=round(t['durationSeconds']); duration=f'{sec//60}:{sec%60:02d}'
        lines.append(f"| {t['title']} / {t['english']} | {duration} | {t['bpm']} BPM · {t['meter']}/4 | {t['integratedLufs']} LUFS |")
        cards.append(f'''<article><span class="number">0{i} / {t['bpm']} BPM · {t['meter']}/4 · {duration}</span>
<h2>{html.escape(t['title'])}</h2><p class="english">{html.escape(t['english'])}</p>
<p>{html.escape(t['mood'])}</p><audio controls preload="none" src="{html.escape(t['audio'])}"></audio>
<a href="{html.escape(t['master'])}" download>无损 FLAC</a> <a href="scores/{t['id']}.mid" download>MIDI</a></article>''')
    lines+=['','## 文件与使用','',
            '- `listen.html`：解压后打开，直接试听三首；不会自动播放。',
            '- `audio/`：192 kbps MP3，可使用 Inkroam 现有“导入音乐”功能试听。',
            '- `masters/`：24-bit / 44.1 kHz 立体声 FLAC 母带。',
            '- `previews/`：各35秒试听节选（不是完整歌曲）。',
            '- `scores/`：分轨 MIDI 与全部音符/和弦/段落的 JSON 事件工程。MIDI音色为通用近似，不嵌入混音和采样。',
            '- `samples/`：已核验的12个钢琴采样与原许可；`CREDITS.md`包含应保留的署名。',
            '- `scripts/music/vol02/`：可重渲染源码；依赖列在 requirements.txt，FFmpeg另行安装。',
            '- `technical-checks.json`：实际解码、时长、峰值、有限数值、结尾、MIDI事件配对检查。',
            '', '## 从本目录重渲染','', '```powershell',
            'python scripts/music/vol02/render.py --ffmpeg "C:/path/to/ffmpeg.exe" --samples samples --out rerender',
            '```','',
            '整体采用固定增益控制响度并保留钢琴动态，目标约 −21 LUFS；不是无缝循环音频。三首均有引子、中段变化和结束。',
            '网站播放器、曲库及Vol.1未修改；本包用于先试听再决定是否上线。',
            '', '## 工具调研','',
            '- FluidSynth：https://www.fluidsynth.org/wiki/UserManual/ （调研过；本成品没有使用它渲染）',
            '- Stable Audio：https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models （调研过；未下载权重或调用付费API）',
            '- 实际路线：NumPy/SciPy编排与采样/合成，FFmpeg编码与响度测量。','']
    (out/'README.md').write_text('\n'.join(lines),encoding='utf-8')
    page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paper Hours · Vol. 2</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2efe8;color:#31342f;font:16px/1.7 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:70px 28px}
.eyebrow,.number{font-size:12px;letter-spacing:.15em;color:#7e685a}h1{font:400 clamp(38px,7vw,76px)/1.15 Georgia,serif;margin:18px 0}header>p{max-width:38em;color:#6c7069}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:36px;margin-top:65px}
article{min-width:0;border-top:1px solid #b9b4a7;padding-top:24px}h2{font-size:25px;font-weight:500;margin:22px 0 0}.english{font:italic 17px Georgia,serif;color:#80786a;margin-top:4px}article>p{color:#74786e;font-size:14px}audio{width:100%;margin:20px 0;display:block}a{color:#6e6559;font-size:13px;margin-right:16px;text-underline-offset:5px}footer{margin-top:70px;color:#838779;font-size:12px} @media(max-width:760px){section{grid-template-columns:1fr;gap:40px}main{padding:36px 24px}}
</style><main><header><span class="eyebrow">INKROAM / LISTENING EDITION</span><h1>Paper Hours, Vol. 2</h1><p>午后的空白，沿河的慢行，还有一盏留着的灯。<br>三首阅读音乐 · 无人声 · 完整试听</p></header><section>'''+''.join(cards)+'''</section><footer>曲谱与编曲由 AI 辅助创作。钢琴采样：Alexander Holm · Salamander Grand Piano v3 · CC BY 3.0。<br><a href="CREDITS.md">完整署名</a><a href="README.md">工程说明</a></footer></main>
<script>document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(b!==a)b.pause()})))</script></html>'''
    (out/'listen.html').write_text(page,encoding='utf-8')
    archive=out.parent/'inkroam_lofi_vol02_r2.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=4) as z:
        for path in sorted(out.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                z.write(path,Path(out.name)/path.relative_to(out))
    print(json.dumps({'checks':report,'zip':str(archive),'zipBytes':archive.stat().st_size},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
