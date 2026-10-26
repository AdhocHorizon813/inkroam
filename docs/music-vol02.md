# Paper Hours, Vol. 2 · 2026-10-26

## 发布接入更新

用户已批准提交部署，第二版三首已接入内置播放器。仅MP3、CREDITS.txt及SAMPLE-LICENSE.txt加入 `public/audio/lofi-vol02/`；初版、FLAC、原采样及ZIP保留本地。六曲共存，Vol.1旧ID/地址不变，仍严格按需加载。第二版署名在管理列表可查看。按要求不运行本地测试/构建，发布状态以部署流程实际结果为准。下方“未接入/未提交”描述为制作时的历史状态。

## Revision 2：根据实际试听反馈重编（当前版本）

用户试听初版后反馈旋律与和声不协调或不喜欢，并授权自主选择修订方向。新版单独输出至 `tmp/inkroam-lofi-vol02-r2/`，工程包 `tmp/inkroam_lofi_vol02_r2.zip`，初版及其源码包完整保留。当前scripts/music/vol02源码、manifest和technical-checks对应第二版；下方初版参数作为历史记录保留。

- 三首重写为稳定三和弦与重复问答主题，减少旋律跳跃与高音装饰，取消半音低音连接。
- 第一首76 BPM、157.579秒；第二首80 BPM、150秒；第三首62 BPM、145.355秒。各48小节，保留独立中段与尾声。
- 初版铺底持续1.5小节会跨到下一和弦；这是谱面可确认的重叠，不能未经听审认定为全部不协调的唯一原因。第二版按每小节和声编排铺底，直接音源在和声变更前平滑释放，混响缩短；取消旋律回声。相同和弦间允许自然延续。
- 第二首主旋律从高亮木质短音改为较柔和电钢琴。降低伴奏与铺底，减少鼓点装饰，第一首和第三首保留采样钢琴。
- 全量解码、峰值、时长、淡出与MIDI检查通过，801/879/405对音符；新增和弦内音及和声边界检查，作为本次简化编曲的限定，不主张所有好音乐都必须如此。
- 三个钢琴样本（C3/C4/A4）的基频邻域FFT估计接近对应标准音高，未发现八度映射错误；这是局部数值检查，不是全音源调音验收。
- 未进行主观听审，不声称“已经好听”或“已经消除全部冲突”。仍未接入网站曲库、未提交部署。

## 本轮交付

用户要求为Inkroam制作新的几首lofi，允许查找其它工具。已制作三首完整器乐，无人声，延续阅读背景音乐用途；未更改Vol.1、播放器代码或线上曲库，未提交部署。音频与工程包目前保存在本机被Git忽略的tmp中，不是已发布资源。

| 曲目 | 时长 | 调性 / 拍号 / 速度 | MP3实测响度 | 真峰值 |
| --- | --- | --- | --- | --- |
| 午后的空白 / A Blank Afternoon | 2:34 | D大调 / 4/4 / 78 BPM | −21.26 LUFS | −2.76 dBTP |
| 沿河慢行 / Along the River | 2:23 | A小调 / 4/4 / 84 BPM | −21.26 LUFS | −7.42 dBTP |
| 灯还留着 / A Light Left On | 2:25 | 降E大调 / 3/4 / 62 BPM | −21.27 LUFS | −5.90 dBTP |

总长442.19秒。每首48小节：4引子、8主题、8变化、8中段、4间奏、8回归、8尾声，另留6秒尾音空间。第三首以四分音符计62 BPM，不是附点四分音符。旋律与和声显式写入谱面；随机种子只影响微时差、力度与合成噪声，不随机抽取旋律音高。

第一首使用柔和钢琴与松弛鼓点；第二首使用电钢琴和木质短音，切分更明显；第三首为三拍钢琴与稀疏打击乐。采用统一较低响度，保留钢琴瞬态；不是无缝循环文件，不声称达到商业母带或已经通过主观试听。

## 实际工具与来源

- `D:/anaconda3/python.exe`，NumPy 2.3.5 / SciPy 1.16.3：音符编排、采样重采样、合成、混响、混音。
- `D:/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe`：音频解码、MP3/FLAC编码、响度与真峰值测量。
- 第1和3首使用 Alexander Holm 的 **Salamander Grand Piano v3** 软力度采样。来源为 [sfzinstruments仓库](https://github.com/sfzinstruments/SalamanderGrandPiano)，固定提交 `3382bf9496bba2486f5ab0de55a264d1dfc38404`。采样按[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)署名，FLAC/SFZ重新映射为kinwie。选用12个v4力度层文件，按Git blob SHA1验证；清单位于 `scripts/music/vol02/samples.json`。
- 采样经过移调、包络、滤波、声像与混响处理。没有实现完整SFZ音源的踏板、共鸣及多力度系统。其他乐器由代码合成；第2首全部为合成音色。没有使用第三方歌曲循环或环境录音。
- 调研过 [FluidSynth](https://www.fluidsynth.org/wiki/UserManual/) 与 [Stable Audio 3.0](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models)，实际成品没有使用两者，不需要API密钥、付费账户或下载模型权重。

公开发布音频时应保留包内 `CREDITS.md` 的作者、来源、许可及处理说明；不能声称全部声音都是从零合成，也不主张采样的排他所有权。曲谱由AI辅助编写，未执行全球旋律相似性检索。

## 文件

- `tmp/inkroam-lofi-vol02/audio/`：三首192 kbps MP3。
- `tmp/inkroam-lofi-vol02/masters/`：24-bit / 44.1kHz立体声FLAC。
- `tmp/inkroam-lofi-vol02/previews/`：各35秒试听节选。
- `tmp/inkroam-lofi-vol02/scores/`：7轨MIDI（含指挥轨）及JSON事件工程。MIDI与音频采用同一音符事件；GM音色只近似，不含实际采样和混响。
- `tmp/inkroam-lofi-vol02/listen.html`：独立试听页，使用原生音频控件，preload=none，同一时间仅一首播放。
- `tmp/inkroam_lofi_vol02.zip`：约68MB，包含上述成品、曲谱、源码、采样及许可；不含外部程序二进制。
- `scripts/music/vol02/`：源工程。保存manifest与technical-checks供以后核对，实际检查不靠文档声称。

仓库内重渲染（采样已下载时跳过第一步）：

```powershell
& D:/anaconda3/python.exe scripts/music/vol02/fetch_samples.py
& D:/anaconda3/python.exe scripts/music/vol02/render.py --ffmpeg D:/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
& D:/anaconda3/python.exe scripts/music/vol02/package.py --ffmpeg D:/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
```

导出后每首即写manifest，避免中断后丢失完成记录。浮点原始混音不预先裁成16-bit；再以固定增益调整响度，保留峰值余量。源码支持单曲 `--track 1/2/3`。

## 验证及接手边界

实际完成：三首MP3全量解码，双声道数值有限、峰值低于满刻度、时长匹配、主体不静音、声道正相关、结尾低电平；MIDI读取核对1021/1189/436对note-on/off，均匹配对应谱面事件；MP3的SHA256记录在manifest。压缩包完成后另做CRC校验。

未完成：耳机/扬声器主观听感审听、不同音量下乐器平衡验收、浏览器移动端试听。本轮技术测量不能代替这些听感判断。

下一步先让用户听成品。可直接通过现有播放器导入MP3；若要成为内置Vol.2，应另行更新专辑/曲目路径与元数据设计，保留按需加载和老曲目ID，并把采样署名一起发布。不要只把文件复制进public后就自动上线。
