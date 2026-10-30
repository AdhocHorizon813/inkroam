# 滑动指示器 · AndroidLiquidGlass 路线

## 本轮目标与基线

用户指定以 Kyant0/AndroidLiquidGlass 为参考，尽可能还原交互和光学观感，不再以 liquidglass.dev 的展示效果为基准。起点 `c64364a` 已合并其它 AI 的滚动锚定、原位滑条、退出保留与休眠修复，本轮保留这些实现。

参考版本固定为 `65ab177e90e5c1d8c62e70cf7755841982da65f6`：

- [LiquidBottomTabs](https://github.com/Kyant0/AndroidLiquidGlass/blob/65ab177e90e5c1d8c62e70cf7755841982da65f6/app/src/commonMain/kotlin/com/kyant/backdrop/catalog/components/LiquidBottomTabs.kt)
- [DampedDragAnimation](https://github.com/Kyant0/AndroidLiquidGlass/blob/65ab177e90e5c1d8c62e70cf7755841982da65f6/app/src/commonMain/kotlin/com/kyant/backdrop/catalog/utils/DampedDragAnimation.kt)
- [Shaders](https://github.com/Kyant0/AndroidLiquidGlass/blob/65ab177e90e5c1d8c62e70cf7755841982da65f6/backdrop/src/commonMain/kotlin/com/kyant/backdrop/internal/Shaders.kt)

## 已实现

1. 按下时膨起比例 `78/56`；横纵轴使用独立弹簧。位置刚度 1000、临界阻尼；膨起刚度 250、阻尼比分别 .6/.7，转换成现有单位质量弹簧系数。速度同时改变横纵向形变。
2. 松手先靠近目标，误差进入中心行程的 2.5%（至少 1 CSS px）才回落。点击切换也触发抬起、位移、回落。拖动中不随候选按钮的宽度突变，放下后调整到目标尺寸。
3. 指示器采用独立 `circular` 位移模型：`1 - sqrt(1 - (1 - inset / height)^2)`；轮廓法线使用放大的梯度半径，按压进度控制折射范围与强度。参考 56 单位高控件的 10/14 参数按实际控件高度缩放。
4. 边缘光使用法线与光方向点积的绝对值。亮度随按压进度调节 `rimOpacity`，不为单纯透明度变化重建贴图。无左上角渐变覆盖层。保留明暗模式已有的白色/背景染色差别。
5. 静止时轻微选中底色；按压时底色减弱，外阴影和内阴影增加。只作用于实验指示器，不影响面板、正文卡片、原有材质与音乐滑条。
6. 全局和分项精度新增 0.25×，包含持久化规范化；不改作者精调的默认值。AA 仍乘在指定采样倍率上，0.25× + 2× AA 得到 0.5×（未触及预算限制时）。

## 实现状态

这是源码实现，尚未运行本地测试、构建或浏览器视觉验收，不能标为像素级还原完成。参考实现把背景与标签记录层合并采样，当前版本仍使用已有网页背景滤镜路径，未移植其标签合成层和七采样色散；这两项是后续完整还原尚未完成的工作。不能用单纯增加高光替代它们。

原图形引擎保留默认 `snell` 分支，仅指示器显式使用新模型。回归脚本已补 0.25×、按压光学参数和膨起目标检查，未执行。用户自行提交，未提交推送。
