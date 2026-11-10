# Paper Hours Vol. 3 — 制作断点（2026-11-10）

## 最新状态：用户未认可初版，暂停并交接

用户反馈“还是不如hoyomix啊”，随后要求交给后续6.2 Astra并写断点。停止继续生成，三首保留为本地试听草稿，尚未批准入库或发布。用户没有逐首指定不足；关于旋律吸引力、机械感、合成拨弦真实感的判断是本轮助手的反思，不是已经听审验证的根因。技术检查通过不能替代音乐审美。

建议后续先集中打磨一首的30–45秒主题，考虑更好的音源或音乐生成/音频理解工具；不要仅靠加混响修补，也不要未经反馈再批量制作三首。此建议尚未实施。保留初版和工程，改版另存。完整原文件路径与接手注意事项见 `docs/work-checkpoint.md` 顶部2026-11-10最新交接。

用户提供三首本地参考，要求制作类似气质的原创音乐，允许将普通分析/整理工作交给6.1 Sol/Terra节省额度。当前目标是本地可试听作品，不自动接入曲库，不提交部署，不修改播放器/UI。参考原音频保持只读，不进入交付包、不截取为采样、不移植原曲旋律或现成MIDI。

## 参考与证据

- HOYO-MiX《太空漫步 Space Walk》，用户本地115.54秒版本。
- 《贝洛沃迪港（夜晚①）》用户本地142.80秒V2版本，按用户说明署HOYO-MiX；文件名“赤羽曜”是上传者线索，不当作作曲者。没有可靠细致的官方乐曲分析，不能把别的夜晚编号或版本当成同一首。
- HOME《Resonance》，用户本地212.92秒版本。

子代理已生成 `tmp/inkroam-vol03-analysis/analyze.py`、`measurements.json`、`report.md`。30–75秒片段的节拍周期存在半拍/倍拍歧义：Space Walk约81/162、港口约96/63、Resonance约86/172；不能称精确BPM识别。港口片段相对侧声道能量更高，Resonance低频更突出、峰均比更低。这是信号测量，未进行主观听审；当前工具没有已确认可用的音乐听审入口。

按用户追加要求搜索赏析：

- [Syntorial自行制作的Resonance音色复现](https://www.syntorial.com/preset-recipe/home-resonance-chords/)：作为其复现方法的第一手材料，参考滤波包络与声部控制，不作为原作者工程参数证明。
- [Synth Ctrl自行制作的Serum拆解](https://synthctrl.com/blogs/blog/home-resonance-breakdown)：参考失谐、滤波、合唱与延迟的制作思路，不照搬旋律或其预设文件。
- [社区转述HOME说明](https://www.reddit.com/r/synthwaveproducers/comments/gtqi80/how_home_made_the_song_resonance_explained_by/)：存在多层Mini V与包络变化的转述，未独立确认原始通信，不作官方确认。
- [港口夜晚1收录视频](https://www.bilibili.com/video/BV1Mtxm6SEH3/?p=11)：仅辅助定位版本，非专业赏析。搜索出现电吉他/后朋克的听众描述，是第二首创作方向的线索，不足以确定原曲全部配器。

不使用搜到的其它《太空漫步》同名歌曲分析，不使用原神琴谱改编的乐器列表推断原配器。此次资料不足以宣称已经完整听懂三首。

## 创作方向

1. 轻盈的电钢琴与太空律动：七/九和弦、短句问答、柔和低音，避免随机旋律。
2. 港口夜色：清音拨弦合成、合唱效果、稀疏旋律与持续低音脉搏；不直接沿用Vol.2的钢琴夜曲配方。
3. 温暖复古电子：包络变化的合成器和弦、稳定鼓机、少量旋律与空间层次。独立写和声与节奏。

计划保留完整MP3、45秒节选、MIDI/JSON谱面、渲染源码与技术测量。先完成本地作品供用户判断，不以数值合格替代“好听”。无需网站构建或浏览器测试。

## 本轮已完成：本地试听初版

三首完整编曲均已渲染，48小节，4/4。固定主题与中段逐音写入谱面；音高不随机。段落为4小节引子、8主题、8变化、8中段、4间奏、8回归、8尾声，另留7秒尾音。不使用三首参考的音频切片、原谱或音源采样，全部为代码合成；第二首拨弦是合成音色，不宣称真实吉他录音。

| 曲目 | 方向 | 速度 / 调性 | 时长 | MP3 LUFS / 真峰值 |
| --- | --- | --- | --- | --- |
| 舷窗之外 / Windows in Orbit | 电钢琴、松弛切分、七九和弦与短句问答 | 84 BPM / D大调 | 2:24.14 | −18 / −3.83 dBTP |
| 末班渡船 / The Last Ferry | 清音拨弦合成、合唱、八分音符低音脉搏 | 92 BPM / G小调 | 2:12.22 | −20 / −6.54 dBTP |
| 日落后的余像 / Afterimage at Dusk | 复古合成器和弦、温和滤波包络、鼓机与少量旋律 | 90 BPM / A大调与升F小调色彩 | 2:15.00 | −18 / −5.12 dBTP |

本次是有完整段落的试听初版，不是已经由用户确认的最终Vol.3。第二首没有把“后朋克”简单理解为高强度失真；使用独立和声与旋律保留夜晚的空间。第三首没有复刻Resonance的四小节和声与标志性节奏。合成器使用限制谐波数量的轻微失谐振荡、随时间变化的频谱包络；伴奏与主旋律分层，鼓点让铺底略微回避。结束和弦前限制直接音源尾音，混响自然延续。

交付目录：`tmp/inkroam-lofi-vol03/`（Git忽略的本地文件）：

- `playlist.html`：独立试听页，原生播放器、默认不加载音频，同时只播放一首。
- `audio/`：三首256 kbps MP3；`previews/`：各45秒192 kbps节选，有淡入淡出。
- `masters/`：44.1 kHz立体声FLAC母版。
- `scores/`：JSON事件谱面；`midi/`：同源事件导出的8轨MIDI（指挥轨+7乐器轨）。通用MIDI音色不等于渲染音色，轨内逐音声像也不能完整重现合成混音。
- `manifest.json`、`technical-checks.json`：时长、响度、真峰值、解码检查与各音频SHA256。
- `CREDITS.txt`：AI生成原创谱曲、代码合成与无参考曲采样说明。
- `paper-hours-vol03.zip`：59,689,060 bytes，22项，音频/谱面/源码/说明齐全；ZIP CRC检查通过。

源码：`scripts/music/vol03/composition.py`、`render.py`、`package.py`。依赖沿用本机Python、NumPy、SciPy、FFmpeg，无新网站依赖。重渲染与打包：

```powershell
& D:/anaconda3/python.exe scripts/music/vol03/render.py --ffmpeg D:/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
& D:/anaconda3/python.exe scripts/music/vol03/package.py --out tmp/inkroam-lofi-vol03 --ffmpeg D:/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
```

renderer也支持`--track 1/2/3`和自定义`--out`。ZIP不含Python/FFmpeg本体，换电脑需自行配置路径。完整音频、母版和节选均已解码检查，未发现非有限值、空音频或削波；完整曲末尾安静，节选尾部淡出但不强求最后250ms全为静音。MIDI分别1541/1368/1650事件。没有主观听审，没有声称达到商业录音质量或已经令用户满意。未运行网站测试/构建/浏览器，未接入内置列表，未提交推送。

下一步：用户直接打开试听页或将MP3导入现有播放器。按实际听感调整最重要的一首/一段，再决定是否进入内置曲库；避免未经反馈继续生成一整批曲目。参考分析的临时文件无需进入public。
