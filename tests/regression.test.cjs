const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const test = require('node:test')
const ts = require('typescript')

function load(file, imports, globals = {}) {
    const exports = {}
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText
    vm.runInNewContext(source, { exports, require: name => imports[name] || require(name), Math, JSON, Error, DOMException, encodeURIComponent, ...globals })
    return exports
}

function booth(permissionDenied = false) {
    const hooks = [], timers = new Map()
    let cursor = 0, pending = [], tree, timerId = 0, captures = 0, stops = 0
    const video = { readyState: 2, videoWidth: 1280, videoHeight: 720, play: async () => {}, srcObject: null }
    const track = { readyState: 'live', addEventListener() {}, removeEventListener() {}, stop() { stops++; this.readyState = 'ended' } }
    const react = {
        useState(value) { const i = cursor++; hooks[i] ??= { value }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next }] },
        useRef(value) { const i = cursor++; return hooks[i] ??= { current: value } },
        useEffect(fn, deps) {
            const i = cursor++, old = hooks[i]
            if (!old || deps.some((value, j) => value !== old.deps[j])) {
                hooks[i] = { deps, cleanup: old?.cleanup }
                pending.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = fn() })
            }
        },
    }
    const jsx = (type, props) => { if (type === 'video') props.ref.current = video; return { type, props } }
    const Component = load('src/Components/CameraBooth.tsx', {
        react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': {}, './CameraBooth.css': {},
        './FleuraLogo': { __esModule: true, default: 'Logo' },
        './CompletedStripModal': { __esModule: true, default: 'CompletedModal' },
        './PrintPreview': { __esModule: true, default: 'PrintPreview' },
        './StripDesigner': { __esModule: true, default: 'StripDesigner' },
        './PhotoStrip': { __esModule: true, default: 'PhotoStrip' },
        './StripCustomization': { __esModule: true, default: 'Customization' },
        './SaveStripButton': { __esModule: true, default: 'SaveButton' },
        '../lib/native': { isAndroidApp: () => false },
        '../lib/photoStrip': { PHOTO_COUNT: 4, generatePhotoStrip: async () => 'strip.png' },
    }, {
        navigator: { mediaDevices: { getUserMedia: async () => {
            if (permissionDenied) throw new DOMException('Denied', 'NotAllowedError')
            track.readyState = 'live'
            return { getTracks: () => [track], getVideoTracks: () => [track] }
        } } },
        window: { addEventListener() {}, removeEventListener() {}, setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id), confirm: () => true },
        document: { createElement: () => ({ getContext: () => ({ translate() {}, scale() {}, drawImage() {} }), toDataURL: () => `photo-${++captures}` }) },
    }).default
    function render() { cursor = 0; tree = Component({ onClose() {} }); const callbacks = pending; pending = []; callbacks.forEach(fn => fn()) }
    function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)] }
    const all = () => nodes(tree)
    const button = label => all().find(node => node.type === 'button' && [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === label))
    const tick = delay => { const item = [...timers].find(([, timer]) => timer.delay === delay); assert.ok(item, `Expected timer ${delay}`); timers.delete(item[0]); item[1].fn(); render() }
    return { render, all, button, tick, timers, video, count: () => captures, stops: () => stops, unmount: () => hooks.forEach(hook => hook?.cleanup?.()) }
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('Android Back listener is removed once when registration finishes after unmount', async () => {
    const effects = []
    let finishRegistration, removals = 0
    const hook = load('src/hooks/useAndroidBack.ts', {
        react: { useRef: current => ({ current }), useEffect: fn => effects.push(fn) },
        '@capacitor/app': { App: { addListener: () => new Promise(resolve => { finishRegistration = resolve }) } },
        '../lib/native': { isAndroidApp: () => true },
    })
    hook.useAndroidBack(() => {})
    effects[0]()
    const cleanup = effects[1]()
    cleanup()
    finishRegistration({ remove: async () => { removals++ } })
    await flush()
    assert.equal(removals, 1)
})

test('Android saves the original PNG through MediaStore bridge; web keeps download', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    let platform = 'android', saved, clicked = false, removed = false
    const link = { click() { clicked = true }, remove() { removed = true } }
    const native = load('src/lib/native.ts', {
        '@capacitor/core': {
            Capacitor: { getPlatform: () => platform },
            registerPlugin: name => {
                assert.equal(name, 'SnapBerryNative')
                return { saveImage: async options => { saved = options.dataUrl; return { uri: 'content://saved' } } }
            },
        },
    }, { document: { createElement: () => link, body: { append() {} } } })
    assert.match(await native.saveStrip(png), /Saved to Gallery/)
    assert.equal(saved, png); assert.equal(clicked, false)
    platform = 'web'
    await native.saveStrip(png)
    assert.equal(link.href, png); assert.equal(link.download, 'snapberry-photo-strip.png')
    assert.equal(clicked, true); assert.equal(removed, true)
})

test('production Android configuration bundles local assets with no development server', () => {
    const config = fs.readFileSync('capacitor.config.ts', 'utf8')
    assert.match(config, /webDir:\s*'dist'/)
    assert.doesNotMatch(config, /server\s*:/)
    assert.doesNotMatch(fs.readFileSync('dist/index.html', 'utf8'), /(?:src|href)=["']https?:\/\//)
    const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
    assert.match(manifest, /android.permission.CAMERA/)
    assert.match(manifest, /BLUETOOTH_CONNECT/)
    assert.doesNotMatch(manifest, /BLUETOOTH_SCAN|WRITE_EXTERNAL_STORAGE/)
})

test('four captures, duplicate-click guard, completed modal, print/back and retry', async () => {
    const app = booth(); app.render(); await flush()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    const start = app.button('Start Capture'); start.props.onClick(); start.props.onClick(); app.render()
    assert.equal([...app.timers.values()].filter(timer => timer.delay === 1000).length, 1)
    for (let i = 0; i < 12; i++) app.tick(1000)
    assert.equal(app.count(), 4); assert.equal(app.stops(), 1)
    assert.equal([...app.timers.values()].filter(timer => timer.delay === 1000).length, 0)
    app.tick(0); await flush(); app.render()
    let modal = app.all().find(node => node.type === 'CompletedModal')
    assert.deepEqual([...modal.props.photos], ['photo-1', 'photo-2', 'photo-3', 'photo-4'])
    assert.equal(modal.props.ready, true)
    assert.equal(app.all().some(node => node.props?.['aria-label'] === 'Photo strip preview'), false)
    modal.props.onPrint(); app.render()
    app.all().find(node => node.type === 'PrintPreview').props.onBack(); app.render()
    modal = app.all().find(node => node.type === 'CompletedModal'); assert.equal(modal.props.photos.length, 4)
    assert.equal(modal.props.onNext, undefined)
    assert.equal(modal.props.onOptionsChange, undefined)
    app.all().find(node => node.type === 'CompletedModal').props.onPrint(); app.render()
    app.all().find(node => node.type === 'PrintPreview').props.onBack(); app.render()
    modal = app.all().find(node => node.type === 'CompletedModal')
    assert.equal(modal.props.photos.length, 4)
    assert.equal(modal.props.options.caption, '')
    assert.equal(modal.props.options.frameColor, 'White')
    modal.props.onRetry(); app.render(); app.tick(0); await flush(); app.render()
    assert.equal(app.all().find(node => node.type === 'CompletedModal').props.ready, true)
    app.unmount(); assert.equal(app.timers.size, 0)
})

test('cancel capture clears partial photos and timers while keeping the camera ready for restart', async () => {
    const app = booth(); app.render(); await flush()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    app.button('Start Capture').props.onClick(); app.render()
    for (let i = 0; i < 3; i++) app.tick(1000)
    assert.equal(app.count(), 1)
    app.button('Cancel Capture').props.onClick(); app.render()
    assert.equal([...app.timers.values()].filter(timer => timer.delay === 1000).length, 0)
    assert.equal(app.stops(), 0)
    assert.ok(app.video.srcObject)
    assert.equal(app.button('Start Capture').props.disabled, false)
    assert.equal(app.button('Cancel Capture'), undefined)
    app.button('Start Capture').props.onClick(); app.render()
    for (let i = 0; i < 12; i++) app.tick(1000)
    app.tick(0); await flush(); app.render()
    assert.deepEqual([...app.all().find(node => node.type === 'CompletedModal').props.photos], ['photo-2', 'photo-3', 'photo-4', 'photo-5'])
    app.unmount()
})

test('permission denial has a friendly error and a retry button', async () => {
    const app = booth(true); app.render(); await flush(); app.render()
    assert.ok(app.all().find(node => node.props?.role === 'alert').props.children.includes('permission was denied'))
    assert.ok(app.button('Retry camera')); app.unmount(); assert.equal(app.timers.size, 0)
})

test('leaving during countdown clears its timer and stops the camera', async () => {
    const app = booth(); app.render(); await flush()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    app.button('Start Capture').props.onClick(); app.render(); app.unmount()
    assert.equal(app.timers.size, 0); assert.equal(app.stops(), 1); assert.equal(app.video.srcObject, null)
})

test('YHK raster uses documented 384-dot framing and MSB-first bits; transparent pixels remain white', () => {
    const raster = load('src/lib/yhkRaster.ts', { './fleuraQr': {}, './photoStrip': {} }, { Uint8Array, Uint8ClampedArray, Float32Array })
    const pixels = new Uint8ClampedArray(384 * 2 * 4).fill(255)
    for (const x of [0, 7, 8]) pixels.set([0, 0, 0, 255], x * 4)
    pixels.set([0, 0, 0, 0], 9 * 4)
    const job = raster.encodeYhkRaster(pixels, 2)
    assert.deepEqual([...job.slice(0, 10)], [27, 64, 29, 118, 48, 0, 48, 0, 2, 0])
    assert.equal(job[10], 0b10000001); assert.equal(job[11], 0b10000000)
    assert.equal(job.length, 16 + 48 * 2)
    assert.deepEqual([...job.slice(-6)], [27, 100, 4, 10, 10, 10])
    assert.equal(job.slice(58, 106).every(byte => byte === 0), true)
    assert.throws(() => raster.encodeYhkRaster(pixels, 1), /Invalid/)
    assert.throws(() => raster.encodeYhkRaster(pixels, 5001), /Invalid/)
})

test('native Bluetooth requires matched services and a confirmed physical test before full strips', () => {
    const plugin = fs.readFileSync('android/app/src/main/java/com/fleura/snapberry/SnapBerryBluetoothPlugin.java', 'utf8')
    assert.match(plugin, /!test && !confirmed/)
    assert.match(plugin, /!ready \|\| !testSent/)
    assert.match(plugin, /getService\(SERVICE\)/)
    assert.match(plugin, /PROPERTY_WRITE_NO_RESPONSE/)
    assert.match(plugin, /TRANSPORT_LE/)
    assert.match(plugin, /Thread\.sleep\(40\)/)
    assert.doesNotMatch(plugin, /24:00:10:00:1D:08/)
})

test('QR payload is exact; thermal keeps QR black/white and scales both paper sizes', () => {
    const qr = load('src/lib/fleuraQr.ts', {})
    const symbol = require('qrcode').create(qr.FLEURA_FACEBOOK_URL, { errorCorrectionLevel: 'M' })
    const payload = symbol.segments.map(segment => typeof segment.data === 'string' ? segment.data : Buffer.from(segment.data).toString()).join('')
    assert.equal(payload, 'https://www.facebook.com/profile.php?id=61570602811270')
    const print = load('src/lib/thermalPrint.ts', { './photoStrip': { STRIP_LAYOUT: { width: 1200, printMarginMm: 4 }, stripHeight: () => 4610 } })
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255])
    print.thermalPixels(pixels)
    assert.deepEqual([...pixels.slice(0, 8)], [0, 0, 0, 255, 255, 255, 255, 255])
    assert.equal(pixels[8], pixels[9]); assert.equal(pixels[9], pixels[10])
    for (const width of [57, 58, 80]) {
        const size = print.printDimensions(width), margin = width === 57 ? 4.5 : 4
        assert.equal(size.width, width - 2 * margin)
        assert.equal((size.height - 2 * margin) / size.width, 4610 / 1200)
    }
})

test('two-photo strip and print height use actual layout proportions', () => {
    const strip = load('src/lib/photoStrip.ts', { './fleuraQr': {}, './stripDesign': load('src/lib/stripDesign.ts', {}) })
    const thermal = load('src/lib/thermalPrint.ts', { './photoStrip': strip })
    const two = strip.stripHeight(strip.STRIP_LAYOUT, 2)
    const four = strip.stripHeight(strip.STRIP_LAYOUT, 4)
    assert.equal(four - two, 2 * (strip.STRIP_LAYOUT.photoHeight + strip.STRIP_LAYOUT.gap))
    assert.ok(Math.abs(thermal.printDimensions(57, two / 1200).height - (48 * two / 1200 + 9)) < 0.000001)
})


test('design can be edited before capture, survives capture and print/back', async () => {
    const app = booth(); app.render(); await flush()
    app.button('Design Strip').props.onClick(); app.render()
    const editor = app.all().find(node => node.type === 'StripDesigner')
    const design = [{ id: 'title', kind: 'text', value: 'Sweet memories', font: 'Elegant', size: 64, x: 50, y: 50 }]
    editor.props.onChange({ ...editor.props.options, design }); app.render()
    app.all().find(node => node.type === 'StripDesigner').props.onDone(); app.render()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    app.button('Start Capture').props.onClick(); app.render()
    assert.equal(app.button('Design Strip').props.disabled, true)
    for (let i = 0; i < 12; i++) app.tick(1000)
    app.tick(0); await flush(); app.render()
    let modal = app.all().find(node => node.type === 'CompletedModal')
    assert.equal(modal.props.options.design[0].value, 'Sweet memories')
    modal.props.onPrint(); app.render()
    app.all().find(node => node.type === 'PrintPreview').props.onBack(); app.render()
    modal = app.all().find(node => node.type === 'CompletedModal')
    assert.equal(modal.props.options.design[0].font, 'Elegant')
    app.unmount()
})

test('design drawing clips items to the decoration area and restores canvas state', async () => {
    const design = load('src/lib/stripDesign.ts', {})
    const calls = []
    const context = { save() { calls.push('save') }, beginPath() {}, rect(...args) { calls.push(args) }, clip() { calls.push('clip') }, translate(...args) { calls.push(['translate', ...args]) }, rotate(value) { calls.push(['rotate', value]) }, restore() { calls.push('restore') }, fillText(...args) { calls.push(args) } }
    await design.drawDesign(context, [{ id: 'a', kind: 'text', value: 'Hello', font: 'Elegant', size: 64, x: 50, y: 50 }], 1200, 3390)
    assert.deepEqual(calls[1], [60, 3390, 1080, 480])
    assert.deepEqual(calls[4], ['translate', 600, 3630])
    assert.deepEqual(calls[5], ['rotate', 0])
    assert.deepEqual(calls[6], ['Hello', 0, 20.48, 192])
    assert.equal(calls.at(-1), 'restore')
    assert.equal(context.font, '64px Georgia, serif')
})

test('touch dragging uses preview dimensions and stays inside the design area', () => {
    const { dragPosition } = load('src/lib/designPosition.ts', {})
    const moved = dragPosition({ x: 50, y: 50 }, 40, -20, 400, 200)
    assert.equal(moved.x, 60); assert.equal(moved.y, 40)
    const edge = dragPosition({ x: 50, y: 50 }, -900, 900, 400, 200)
    assert.equal(edge.x, 10); assert.equal(edge.y, 90)
})


test('rotated editor elements remain fully inside bounds and image proportions stay intact', () => {
    const { constrainDesign, designBounds } = load('src/lib/stripDesign.ts', {})
    for (const rotation of [0, 45, 90, 180, 270]) {
        const item = constrainDesign({ id: 'a', kind: 'image', value: '', font: 'Simple', size: 180, x: -50, y: 120, rotation, aspectRatio: 2 }, 1080, 3810)
        const bounds = designBounds(item), angle = rotation * Math.PI / 180
        const halfWidth = (Math.abs(Math.cos(angle)) * bounds.width + Math.abs(Math.sin(angle)) * bounds.height) / 2
        const halfHeight = (Math.abs(Math.sin(angle)) * bounds.width + Math.abs(Math.cos(angle)) * bounds.height) / 2
        assert.ok(item.x / 100 * 1080 - halfWidth >= -1e-6)
        assert.ok(item.y / 100 * 3810 + halfHeight <= 3810 + 1e-6)
        assert.equal(bounds.width / bounds.height, 2)
    }
})
