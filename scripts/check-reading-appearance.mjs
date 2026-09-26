import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const panel = readFileSync('app/components/AppearancePanel.vue', 'utf8')
const source = panel.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const template = panel.match(/<template>([\s\S]*)<\/template>/)[1]
const css = readFileSync('app/assets/css/main.css', 'utf8')

/* 背景氛围的顺序与名称是产品决定，不是实现细节：改动顺序或改名都必须先改这里。 */
const ORDER = ['flat', 'theme', 'aurora', 'art', 'dusk', 'custom']
/* 起点锚在 legend 之后：面板里别处也出现过「背景氛围」四个字（说明行），legend 自己也不是卡片名。 */
const atmosphere = template.match(/<legend class="setting-label">背景氛围<\/legend>([\s\S]*?)<input ref="fileInput"/)[1]
assert.deepEqual(
  [...template.matchAll(/class="background-swatch background-swatch--([a-z]+)"/g)].map(match => match[1]),
  ORDER,
  'Six background cards, in order',
)
assert.deepEqual(
  [...atmosphere.matchAll(/>\s*([\u4e00-\u9fa5]{4})\s*<\//g)].map(match => match[1]),
  ['静谧纯色', '主题纯色', '极光渐变', '暮色都市', '夕空町市'],
  'Names in order',
)
/* 高亮比的是解析后的画布：跟随状态下亮色应当停在夕空町市上。 */
assert.deepEqual(
  [...atmosphere.matchAll(/active: resolvedBackground === '([a-z]+)'/g)].map(match => match[1]),
  ORDER,
  'Every card highlights the resolved canvas',
)
assert.deepEqual(
  [...atmosphere.matchAll(/selectBackground\('([a-z]+)'\)/g)].map(match => match[1]),
  ORDER.slice(0, 5),
  'The five fixed cards write exactly one preference each',
)
/* 自定义图片这块的命名与上传链路本期不动：仍然是文件名原样标签。 */
assert(atmosphere.includes('@click="openFilePicker"'))
assert(atmosphere.includes("customBackgroundName || (customBackgroundPreview ? '已上传图片' : '上传图片')"))
assert(!/state\.background === '/.test(template), 'Cards must not compare the raw preference')
const bootBlock = source.slice(source.indexOf('onMounted(() =>'), source.indexOf('onUnmounted('))
assert(
  bootBlock.indexOf('systemPrefersDark.value =') < bootBlock.indexOf('applyAppearance()'),
  'The system theme is read before the first applyAppearance',
)

/* 夕空町市必须随包发布：只留在 gitignore 的 tmp 里，部署出去就是一张空底图。 */
const png = readFileSync(new URL('../public/images/yuzoramachi.png', import.meta.url))
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
assert(css.includes("url('/images/yuzoramachi.png')"), 'Dusk canvas and its swatch use the shipped image')
assert(css.includes(":root[data-visual='modern'][data-background='dusk'] .ambient-image {"), 'Dusk swaps the ambient image')
assert(css.includes('.background-swatch--theme'), 'Theme colour card previews the accent colour')
assert(css.includes(":root[data-visual='modern'][data-background='theme'] .ambient-backdrop {"), 'Theme canvas paints the accent colour')
assert(css.includes('background: var(--modern-accent);'), 'Theme canvas is the accent colour itself')
/* 主题纯色不给深浅各写一套比例，否则画布颜色会和面板上那支色块对不上。 */
assert(!css.includes("[data-color-mode='light'][data-background='theme']"), 'Theme canvas keeps one colour in both appearances')
/* 夕空町市缩略图是原图，不在缩略图上叠自己的色偏。 */
assert(css.includes(".background-swatch--dusk { background-image: url('/images/yuzoramachi.png'); }"))
/* 两种纯色画布都没有图层：组件几何、底图隐藏、玻璃取消都要把 theme 与 flat 并在一起，
   否则以后补规则时很容易只写 flat，让主题纯色退回成「有图层的画布」。 */
assert(css.includes(":is([data-background='flat'], [data-background='theme']) .ambient-aurora { display: none; }"))
assert(!css.includes(":root[data-visual='modern'][data-background='flat'] .hero"), 'Card geometry is shared with theme')
assert(!css.includes(":root[data-visual='modern'][data-background='flat'] .ambient-image"), 'Layer hiding is shared with theme')
assert(!css.includes("[data-background]:not([data-background='flat'])"), 'Glass opt-out covers both flat canvases')

/* 脚本重跑一遍真实逻辑：默认画布怎么解析、旧存储怎么迁移、手选之后还跟不跟随。 */
const compiled = ts.transpile(
  source.replace("import { supportsEmbeddedPdf } from '~/utils/pdf-embed'", '').replaceAll('import.meta.client', 'true'),
  { target: ts.ScriptTarget.ES2022 },
)

function mount(saved, { systemDark = false, defer = false } = {}) {
  const root = {
    dataset: {},
    style: { setProperty: (key, value) => { root.style[key] = value }, removeProperty: key => { delete root.style[key] } },
    classList: { add: () => {}, remove: () => {} },
  }
  const shared = {}
  const mounted = []
  const watchers = []
  /* matchMedia 的 stub 必须可变：onMounted 读一次真实值，之后「系统明暗变化」走 change 事件，
     这里直接改 matches 再调 onSystemThemeChange()，就能复现切换浏览器深浅色的那条路径。 */
  const media = { matches: systemDark, addEventListener: () => {}, removeEventListener: () => {} }
  let stored = null
  const context = vm.createContext({
    supportsEmbeddedPdf: () => false,
    ref: value => ({ value }), reactive: value => value,
    computed: compute => ({ get value() { return compute() } }),
    useState: (key, init) => shared[key] ||= { value: init() },
    onMounted: callback => mounted.push(callback), onUnmounted: () => {},
    watch: (target, callback) => watchers.push([target, callback]),
    document: { documentElement: root },
    window: { matchMedia: () => media },
    localStorage: {
      getItem: key => (key === 'paper-trail-appearance-v5' && saved ? JSON.stringify(saved) : null),
      setItem: (_key, value) => { stored = JSON.parse(value) },
      removeItem: () => {},
    },
  })
  vm.runInContext(`${compiled}\nglobalThis.exposed = { state, systemPrefersDark, resolvedBackground, resetAppearance, commitManagedDefaults, requestDefaultSettings, confirmDefaultSettings, closeDefaultSettingsConfirm, onSystemThemeChange }`, context)
  const exposed = context.exposed
  const boot = () => mounted.forEach(callback => callback())
  if (!defer) boot()
  return {
    state: exposed.state,
    dataset: root.dataset,
    resolved: () => exposed.resolvedBackground.value,
    boot,
    systemDark: dark => { exposed.systemPrefersDark.value = dark },
    /* 模拟「切换浏览器深浅色」：先改 matchMedia 给的答案，再走一次组件里的 change 处理。 */
    flipSystemAppearance: dark => { media.matches = dark; exposed.onSystemThemeChange() },
    request: enabled => exposed.requestDefaultSettings(enabled),
    confirm: () => exposed.confirmDefaultSettings(),
    cancel: () => exposed.closeDefaultSettingsConfirm(),
    reset: () => exposed.resetAppearance(),
    /* watcher 只负责把状态写回 data-* 与 localStorage，这里手动推进一次。 */
    save: () => {
      watchers.find(([target]) => target === exposed.state)[1](exposed.state, exposed.state)
      return stored
    },
  }
}

/* 深色系统下的首帧：SSR 拿不到系统明暗，只能按浅色算；客户端首帧也必须先按浅色算，
   否则 hydration 时 Vue 不会回改面板的 active 属性，深色用户会一直看到「夕空町市」被高亮，
   而画布已经是暮色都市——这正是这次修掉的那个 bug。 */
const cold = mount(null, { systemDark: true, defer: true })
assert.equal(mount(null).state.backgroundTint, true, 'New visitors blend by default')
assert.equal(mount({ accent: '#123456' }).state.backgroundTint, true, 'Old preferences preserve blending')
assert.equal(mount({ backgroundTint: 'invalid' }).state.backgroundTint, true)
const tintOff = mount({ backgroundTint: false, accent: '#123456', defaultSettings: true })
assert.equal(tintOff.dataset.backgroundTint, 'off')
assert.equal(tintOff.state.accent, '#123456', 'Disabling background blend does not change the accent')
assert.equal(tintOff.save().backgroundTint, false, 'Preference persists')
tintOff.flipSystemAppearance(true)
assert.equal(tintOff.state.backgroundTint, false, 'Changing appearance does not reset the independent choice')
tintOff.reset()
assert.equal(tintOff.state.backgroundTint, true, 'Reset restores blending')
assert(css.includes(":root[data-background-tint='off'] { --background-tint: transparent; }"))
assert(template.includes('主题色混合背景'))
const imageTint = css.match(/:root\[data-visual='modern'\]\[data-color-mode='light'\]:is\(\[data-background='art'\], \[data-background='dusk'\], \[data-background='custom'\]\) \.ambient-backdrop \{([^}]+)\}/)?.[1]
assert(imageTint?.includes('var(--background-tint) 12%') && imageTint.includes('var(--background-tint) 6%'), 'Only light image backgrounds use reduced tint')
for (const [, selector, declaration] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (selector.includes('.ambient-') && !selector.includes("[data-background='theme']")) {
    assert(!declaration.includes('var(--modern-accent)'), 'Ambient tint must use the independent channel')
  }
}
assert.equal(cold.resolved(), 'dusk', 'First client paint matches the server render')
cold.boot()
assert.equal(cold.resolved(), 'art', 'The real system theme takes over right after mount')
assert.equal(cold.dataset.background, 'art', 'The canvas is right on the first mounted frame')

const fresh = mount()
assert.equal(fresh.state.background, 'auto')
assert.equal(fresh.state.backgroundPicked, false)
assert.equal(fresh.dataset.background, 'dusk', 'A light visitor lands on 夕空町市')
fresh.systemDark(true)
assert.equal(fresh.resolved(), 'art', 'The same visitor switches to dark and gets 暮色都市')
fresh.save()
assert.equal(fresh.dataset.background, 'art', 'The resolved canvas is what reaches CSS')

/* 浅色下系统切到深色时是「换画布」，所以必须真的写进 data-background，而不是只换 class。 */
fresh.systemDark(false)
fresh.save()
assert.equal(fresh.dataset.background, 'dusk')

/* 手选一项之后就不再跟随：显式选择要被记住。 */
fresh.state.background = 'theme'
fresh.state.backgroundPicked = true
const saved = fresh.save()
assert.equal(saved.background, 'theme')
assert.equal(saved.backgroundPicked, true)
assert.equal(fresh.dataset.background, 'theme')
fresh.systemDark(true)
fresh.save()
assert.equal(fresh.dataset.background, 'theme', 'A picked canvas stops following the system')
assert.equal(fresh.state.background, 'theme', 'A picked canvas is never rewritten')

/* 旧存储里 art 正是当时的默认值，等于「没选过」：迁移到跟随，浅色就换成新图。 */
const legacy = mount({ background: 'art', accent: '#b96068' })
assert.equal(legacy.state.background, 'auto')
assert.equal(legacy.dataset.background, 'dusk')
/* 带上标记的 art 是用户自己点的暮色都市，必须原样保留。 */
assert.equal(mount({ background: 'art', backgroundPicked: true }).state.background, 'art')
assert.equal(mount({ background: 'dusk' }).state.background, 'dusk')
assert.equal(mount({ background: 'paper' }).state.background, 'auto')

fresh.reset()
assert.equal(fresh.state.background, 'auto')
assert.equal(fresh.state.backgroundPicked, false)
fresh.save()
assert.equal(fresh.dataset.background, 'art')

/* 出厂默认随明暗分两套：浅色那一套是用户在面板上逐条定过的
   （四组材质都用液态玻璃，模糊 14 / 5 / 4 / 0 px，遮罩 40%），深色沿用云母与 12 / 10 / 12 / 4。 */
const LIGHT_DEFAULTS = {
  navMaterial: 'liquid', contentMaterial: 'liquid', dropdownMaterial: 'liquid', backgroundMaterial: 'liquid',
  navBlur: 14, contentBlur: 5, dropdownBlur: 4, backgroundBlur: 0, backgroundOverlay: 40,
}
const DARK_DEFAULTS = {
  navMaterial: 'mica', contentMaterial: 'mica', dropdownMaterial: 'mica', backgroundMaterial: 'mica',
  navBlur: 12, contentBlur: 10, dropdownBlur: 12, backgroundBlur: 4, backgroundOverlay: 40,
}
const readDefaults = (probe) => Object.fromEntries(Object.keys(LIGHT_DEFAULTS).map(key => [key, probe.state[key]]))

const newcomer = mount()
assert.equal(newcomer.state.defaultSettings, true, 'A new visitor starts with the defaults enabled')
assert.deepEqual(readDefaults(newcomer), LIGHT_DEFAULTS, 'A light first visit lands on the light defaults')
const darkFresh = mount(null, { systemDark: true })
assert.equal(darkFresh.state.defaultSettings, true)
assert.deepEqual(readDefaults(darkFresh), DARK_DEFAULTS, 'A dark first visit lands on the dark defaults')

/* 启用态：系统明暗一换，受管项整批换成另一套，画布回到「跟随」。 */
const follower = mount({ defaultSettings: true, background: 'flat', navBlur: 44 })
assert.deepEqual(readDefaults(follower), LIGHT_DEFAULTS, 'Enabling takes the managed values back to the defaults')
assert.equal(follower.state.background, 'auto', '…and the canvas back to following')
assert.equal(follower.state.backgroundPicked, false)
follower.flipSystemAppearance(true)
assert.deepEqual(readDefaults(follower), DARK_DEFAULTS, 'With the defaults on, the OS appearance picks the set')
assert.equal(follower.dataset.background, 'art')
follower.flipSystemAppearance(false)
assert.deepEqual(readDefaults(follower), LIGHT_DEFAULTS)

/* 用户报的毛病就在这里：非默认设置下切系统深浅色，值一个都不该被换掉。 */
const manual = {
  navMaterial: 'acrylic', navBlur: 30, contentMaterial: 'mica', contentBlur: 22, dropdownMaterial: 'acrylic',
  dropdownBlur: 18, backgroundMaterial: 'mica', backgroundBlur: 26, backgroundOverlay: 66,
}
const tuned = mount({ ...manual, background: 'aurora' })
assert.equal(tuned.state.defaultSettings, false, 'Stored preferences without the switch count as manual')
assert.deepEqual(readDefaults(tuned), manual)
tuned.flipSystemAppearance(true)
assert.deepEqual(readDefaults(tuned), manual, 'Flipping the OS appearance never rewrites manual settings')
assert.equal(tuned.state.background, 'aurora')
assert.equal(tuned.dataset.background, 'aurora')
tuned.flipSystemAppearance(false)
assert.deepEqual(readDefaults(tuned), manual)

/* 新老隔离：老访客「从没设置过」的键（旧版本里根本没有这一项）保持 v5 时代的值，
   不把新默认塞给他；他设过的项原样保留，开关也不会被自动打开。 */
const upgraded = mount({ navBlur: 30, accent: '#b96068' })
assert.equal(upgraded.state.defaultSettings, false, 'A stored preference is never treated as a default')
assert.equal(upgraded.state.navBlur, 30, 'A stored value survives the upgrade')
assert.equal(upgraded.state.accent, '#b96068')
assert.equal(upgraded.state.navMaterial, 'mica', 'A missing key keeps the material it used to show')
assert.equal(upgraded.state.contentBlur, 10, 'A missing key keeps the blur it used to show')
assert.equal(upgraded.state.dropdownBlur, 12)
assert.equal(upgraded.state.backgroundBlur, 4)

/* 二次确认：弹窗一开一关不动状态，确认之后才落。 */
const asked = mount()
asked.request(false)
assert.equal(asked.state.defaultSettings, true, 'Opening the confirm does not move the switch')
asked.cancel()
assert.equal(asked.state.defaultSettings, true, 'Cancelling keeps the switch where it was')
asked.request(false)
asked.confirm()
assert.equal(asked.state.defaultSettings, false)
assert.deepEqual(readDefaults(asked), LIGHT_DEFAULTS, 'Disabling keeps the values it already had')
const enabling = mount({ ...manual })
enabling.request(true)
enabling.confirm()
assert.equal(enabling.state.defaultSettings, true, 'Confirming the enable writes the switch')
assert.deepEqual(readDefaults(enabling), LIGHT_DEFAULTS, '…and takes the managed values back to the defaults')

/* 存储里写过的项必须原样留下，边界值 0 / 48 也不例外。 */
const kept = mount({ navMaterial: 'acrylic', contentBlur: 0, dropdownBlur: 48, backgroundBlur: 33, backgroundOverlay: 0 })
assert.equal(kept.state.navMaterial, 'acrylic')
assert.equal(kept.state.contentBlur, 0)
assert.equal(kept.state.dropdownBlur, 48)
assert.equal(kept.state.backgroundBlur, 33)
assert.equal(kept.state.backgroundOverlay, 0)

/* 坏值修回 v5 时代的值：老访客的观感不该因为修一个坏值而变成新默认。 */
assert.equal(mount({ dropdownMaterial: 'paper', dropdownBlur: 'x' }).state.dropdownMaterial, 'mica')
assert.equal(mount({ dropdownBlur: 'x' }).state.dropdownBlur, 12)

/* 恢复默认按当前明暗走：深色机器上恢复出来的是深色那一套。 */
const darkReset = mount(null, { systemDark: true })
darkReset.reset()
assert.deepEqual(readDefaults(darkReset), DARK_DEFAULTS, 'Reset restores the defaults of the current appearance')
assert.equal(darkReset.state.defaultSettings, true, 'Reset also turns the switch back on')

/* 模板契约：开关在外观模式上方，受管项跟着它禁用，氛围色与它无关，纸媒下开关自己也被禁用。 */
assert(template.indexOf('视觉风格') < template.indexOf('默认设置'), 'The switch follows the visual style')
assert(template.indexOf('默认设置') < template.indexOf('外观模式'), 'The switch sits above the appearance mode')
assert.equal(
  [...template.matchAll(/<fieldset class="setting-group" :disabled="managedDisabled">/g)].length,
  5,
  'Four material groups and the canvas follow the switch',
)
assert.equal(
  [...template.matchAll(/<div class="setting-group" :aria-disabled="managedDisabled">/g)].length,
  5,
  'The four sliders and the overlay follow the switch',
)
assert(
  /<fieldset class="setting-group" :disabled="state\.visual === 'classic'">\s*<legend class="setting-label">默认设置<\/legend>/.test(template),
  'The switch itself only disables with the paper look',
)
assert(
  /<fieldset class="setting-group accent-setting" :disabled="state\.visual === 'classic'">/.test(template),
  'The accent colour stays manual',
)
assert(template.includes('<dialog') && template.includes('class="appearance-confirm"'), 'Switching asks for confirmation')
assert(css.includes('.appearance-confirm::backdrop'), 'The confirm dialog brings its own scrim')
assert.match(css, /\.appearance-confirm__actions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'Dialog actions have equal widths')
assert(template.includes('aria-describedby="appearance-confirm-description"'))
assert(template.includes('class="appearance-confirm__cancel" autofocus'), 'Cancel is the safe initial focus')
assert(source.includes('dialogDefaultSettings.value = enabled'), 'Exit keeps the same action text')
assert(css.includes('overlay 160ms allow-discrete'), 'Native dialog exit retains top-layer animation')
assert(css.includes('@starting-style'), 'Opening has a defined starting state')
assert(css.includes('prefers-reduced-transparency'), 'Opaque material fallback is available')
console.log('PASS: atmosphere order, dusk asset, default canvas, legacy migration, manual override, per-appearance defaults and the default-settings switch.')
