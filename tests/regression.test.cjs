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

function booth(permissionDenied = false, props = {}, android = false) {
    const hooks = [], timers = new Map(), exports = [], listeners = new Map(), draws = []
    const orientationListeners = new Map(), viewportListeners = new Map()
    const viewport = { matches: false, addEventListener: (name, fn) => viewportListeners.set(name, fn), removeEventListener: name => viewportListeners.delete(name) }
    let cursor = 0, pending = [], tree, timerId = 0, captures = 0, stops = 0, shutters = 0
    const video = { readyState: 2, videoWidth: 1280, videoHeight: 720, play: async () => {}, srcObject: null,
        getBoundingClientRect: () => ({ width: 1280, height: 720 }) }
    const track = { readyState: 'live', addEventListener() {}, removeEventListener() {}, stop() { stops++; this.readyState = 'ended' } }
    const shutterSound = { prepare() {}, beep() {}, play() { shutters++ }, stop() {} }
    const react = {
        useCallback: fn => fn,
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
        './ExitSessionDialog': { __esModule: true, default: 'ExitSessionDialog' },
        './PrintPreview': { __esModule: true, default: 'PrintPreview' },
        './StripDesigner': { __esModule: true, default: 'StripDesigner' },
        './PhotoStrip': { __esModule: true, default: 'PhotoStrip' },
        './StripCustomization': { __esModule: true, default: 'Customization' },
        './SaveStripButton': { __esModule: true, default: 'SaveButton' },
        '../hooks/useShutterSound': { useShutterSound: () => shutterSound },
        '../lib/native': { isAndroidApp: () => android, SnapBerryNative: { prepareCamera: async () => {} } },
        '../lib/photoStrip': {
            ...load('src/lib/photoStrip.ts', { './fleuraQr': {}, './stripDesign': {} }),
            generatePhotoStrip: async (photos, options, layout) => { exports.push({ photos, options, layout }); return 'strip.png' },
            generateWebsiteClassicSheet: async (photos, options) => { exports.push({ photos, options, classic: true }); return 'strip.png' },
        },
    }, {
        navigator: { mediaDevices: { getUserMedia: async () => {
            if (permissionDenied) throw new DOMException('Denied', 'NotAllowedError')
            track.readyState = 'live'
            return { getTracks: () => [track], getVideoTracks: () => [track] }
        } } },
        window: { matchMedia: () => viewport, screen: { orientation: { addEventListener: (name, fn) => orientationListeners.set(name, fn), removeEventListener: name => orientationListeners.delete(name) } }, addEventListener(name, fn) { listeners.set(name, fn) }, removeEventListener(name) { listeners.delete(name) }, setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id), confirm: () => { throw new Error('Unexpected browser confirmation') } },
        document: { createElement: () => ({ getContext: () => ({ translate(...args) { draws.push(['translate', ...args]) }, scale(...args) { draws.push(['scale', ...args]) }, drawImage(...args) { draws.push(['draw', ...args.slice(1)]) } }), toDataURL: () => `photo-${++captures}` }) },
    }).default
    function render() { cursor = 0; tree = Component({ onClose() {}, ...props }); const callbacks = pending; pending = []; callbacks.forEach(fn => fn()) }
    function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)] }
    const all = () => nodes(tree)
    const button = label => all().find(node => node.type === 'button' && ([node.props.children].flat().some(child => typeof child === 'string' && child.trim() === label) || (label === 'Start' && /^Start \d-photo capture$/.test(node.props['aria-label'] || ''))))
    const tick = delay => { const item = [...timers].find(([, timer]) => timer.delay === delay); assert.ok(item, `Expected timer ${delay}`); timers.delete(item[0]); item[1].fn(); render() }
    return { render, all, button, tick, timers, video, exports, draws,
        rotate(landscape, event = 'screen') { viewport.matches = landscape; (event === 'screen' ? orientationListeners.get('change') : event === 'media' ? viewportListeners.get('change') : listeners.get(event))(); render() },
        listenerCount: () => listeners.size + orientationListeners.size + viewportListeners.size,
        back: () => listeners.get('snapberry:back')({ preventDefault() {} }), count: () => captures, shutters: () => shutters, stops: () => stops, unmount: () => hooks.forEach(hook => hook?.cleanup?.()) }
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('capture uses the current centered preview crop and mirror on web and Android after rotation', async () => {
    for (const android of [false, true]) {
        const app = booth(false, {}, android)
        app.render(); await flush()
        app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
        app.button(android ? 'Start Capture' : 'Start').props.onClick(); app.render()
        app.video.getBoundingClientRect = () => ({ width: 400, height: 400 })
        for (let i = 0; i < 3; i++) app.tick(1000)
        assert.deepEqual(app.draws.slice(0, 3), [['translate', 720, 0], ['scale', -1, 1], ['draw', 280, 0, 720, 720, 0, 0, 720, 720]])
        app.rotate(true)
        app.video.getBoundingClientRect = () => ({ width: 800, height: 400 })
        for (let i = 0; i < 3; i++) app.tick(1000)
        assert.deepEqual(app.draws.slice(3, 6), [['translate', 1280, 0], ['scale', -1, 1], ['draw', 0, 40, 1280, 640, 0, 0, 1280, 640]])
        app.unmount()
    }
})

test('captured photo gestures reveal one delete action and delete only once', async () => {
    const app = booth(); app.render(); await flush()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    app.button('Start').props.onClick(); app.render()
    for (let i = 0; i < 6; i++) app.tick(1000)
    const slot = index => app.all().find(node => node.type === 'li' && node.props['aria-label'] === `Photo ${index}: captured`)
    let prevented = false
    slot(1).props.onContextMenu({ preventDefault() { prevented = true } })
    assert.equal(prevented, true)
    slot(1).props.onDoubleClick({ detail: 2, preventDefault() {} }); app.render()
    const remove = app.all().find(node => node.props['aria-label'] === 'Delete photo 1')
    assert.ok(remove)
    remove.props.onClick({ stopPropagation() {} }); remove.props.onClick({ stopPropagation() {} }); app.render()
    assert.equal(slot(1).props.children[0].props.src, 'photo-2')
    assert.equal(app.all().filter(node => node.type === 'li' && node.props['aria-label']?.endsWith('captured')).length, 1)
    slot(1).props.onPointerDown({ pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0, target: { closest: () => null } })
    app.tick(600)
    assert.ok(app.all().some(node => node.props['aria-label'] === 'Delete photo 1'))
    app.unmount()
})

test('rotation preserves live video, captured photos and pending countdown across camera layouts', async () => {
    for (const android of [false, true]) for (const layout of ['classic', 'postcard', 'landscape']) {
        const app = booth(false, { initialLayout: layout }, android)
        app.render(); await flush()
        if (android && layout === 'postcard') { app.button('2×2 Postcard').props.onClick(); app.render() }
        app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
        app.button(android ? 'Start Capture' : 'Start').props.onClick(); app.render()
        for (let i = 0; i < 4; i++) app.tick(1000)
        const stream = app.video.srcObject
        const timer = [...app.timers.values()].find(timer => timer.delay === 1000)
        for (const event of ['screen', 'media', 'orientationchange', 'resize']) {
            for (const landscape of [true, false]) {
                app.rotate(landscape, event)
                assert.equal(app.all()[0].props['data-orientation'], landscape ? 'landscape' : 'portrait')
                assert.equal(app.video.srcObject, stream)
                assert.equal(app.stops(), 0)
                assert.equal(app.count(), 1)
                assert.equal(app.all().filter(node => node.type === 'img')[0].props.src, 'photo-1')
                assert.equal([...app.timers.values()].find(item => item.delay === 1000), timer)
                assert.ok(app.all().some(node => node.props['aria-label'] === 'Capturing in 2 seconds'))
            }
        }
        app.tick(1000); app.tick(1000)
        assert.equal(app.count(), 2)
        app.unmount()
        assert.equal(app.listenerCount(), 0)
    }
})

function templateGallery({ management = true, failIds = [], deferDelete = false } = {}) {
    const hooks = [], timers = new Map(), deleted = [], notifications = [], selections = [], pendingDeletes = []
    const saved = new Map(['active', 'other'].map(id => [id, { id, name: id, settings: { layout: 'classic', backgroundImage: `${id}.png` } }]))
    const original = [...saved.values()]
    let cursor = 0, effects = [], tree, timerId = 0
    const jsx = (type, props) => ({ type, props })
    const Component = load('src/Components/CustomizedLayouts.tsx', {
        react: {
            useState(value) { const i = cursor++; hooks[i] ??= { value }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next }] },
            useRef(current) { const i = cursor++; return hooks[i] ??= { current } },
            useEffect(fn, deps) {
                const i = cursor++, previous = hooks[i]
                if (!previous || deps.some((value, j) => value !== previous.deps[j])) {
                    hooks[i] = { deps, cleanup: previous?.cleanup }
                    effects.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = fn() })
                }
            },
        },
        'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': {},
        './PhotoStrip': { __esModule: true, default: 'PhotoStrip' },
        './PaperSizeSelect': { __esModule: true, default: 'PaperSizeSelect' },
        './DeleteTemplateDialog': { __esModule: true, default: 'DeleteTemplateDialog' },
        '../lib/stripTemplates': {
            listTemplates: async () => [...saved.values()],
            deleteTemplate: async id => {
                deleted.push(id)
                if (deferDelete) await new Promise(resolve => pendingDeletes.push(resolve))
                if (failIds.includes(id)) throw new Error('Storage unavailable')
                saved.delete(id)
            },
        },
    }, { window: {
        setTimeout(fn, delay) { assert.equal(delay, 600); timers.set(++timerId, fn); return timerId },
        clearTimeout: id => timers.delete(id),
    } }).default
    const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
    function render() {
        cursor = 0
        tree = Component({ management, selectedId: 'active', selectedLayout: 'classic', onBack() {}, onDeleted: ids => notifications.push([...ids]), onSelect: template => selections.push(template.id) })
        const callbacks = effects; effects = []; callbacks.forEach(fn => fn())
        return nodes(tree)
    }
    const card = id => render().find(node => node.type === 'button' && node.props['aria-label'] === `Select ${id}`)
    const dialog = () => render().find(node => node.type === 'DeleteTemplateDialog')
    const gesture = (overrides = {}) => ({ pointerType: 'touch', button: 0, isPrimary: true, clientX: 20, clientY: 20, detail: 1, preventDefault() {}, ...overrides })
    return { render, card, dialog, gesture, timers, saved, original, deleted, notifications, selections,
        hold() { for (const [id, fn] of timers) { timers.delete(id); fn() } },
        finishDelete() { pendingDeletes.splice(0).forEach(resolve => resolve()) },
        unmount() { hooks.forEach(hook => hook.cleanup?.()) },
    }
}

test('Edit Designs right-click confirms deletion, waits for storage, and prevents duplicate submissions', async () => {
    const gallery = templateGallery({ deferDelete: true }); gallery.render(); await flush()
    let prevented = false
    gallery.card('active').props.onContextMenu(gallery.gesture({ preventDefault() { prevented = true } }))
    assert.equal(prevented, true)
    assert.equal(gallery.dialog().props.count, 1)
    assert.equal(gallery.saved.size, 2)
    gallery.dialog().props.onCancel()
    assert.equal(gallery.dialog(), undefined)
    assert.deepEqual(gallery.deleted, [])
    gallery.card('active').props.onContextMenu(gallery.gesture())
    gallery.dialog().props.onDelete(); gallery.dialog().props.onDelete()
    assert.deepEqual(gallery.deleted, ['active'])
    assert.equal(gallery.dialog().props.busy, true)
    assert.ok(gallery.card('active'))
    assert.deepEqual(gallery.notifications, [])
    gallery.finishDelete(); await flush()
    assert.equal(gallery.card('active'), undefined)
    assert.equal(gallery.saved.has('active'), false)
    assert.equal(gallery.saved.has('other'), true)
    assert.deepEqual(gallery.notifications, [['active']])
    assert.equal(gallery.dialog(), undefined)
})

test('double tap or click opens delete confirmation without changing selection', async () => {
    for (const pointerType of ['touch', 'mouse']) {
        const gallery = templateGallery(); gallery.render(); await flush()
        gallery.card('active').props.onClick(gallery.gesture({ pointerType, timeStamp: 100 }))
        assert.equal(gallery.card('active').props['aria-pressed'], true)
        gallery.card('active').props.onClick(gallery.gesture({ pointerType, timeStamp: 300, detail: 2 }))
        assert.equal(gallery.dialog().props.count, 1)
        assert.equal(gallery.card('active').props['aria-pressed'], false)
        assert.deepEqual(gallery.deleted, [])
        gallery.dialog().props.onDelete(); await flush()
        assert.deepEqual(gallery.deleted, ['active'])
    }
})

test('touch and pen long-press open deletion; taps, scrolling, cancellation, and unmount do not', async () => {
    for (const pointerType of ['touch', 'pen']) {
        const gallery = templateGallery(); gallery.render(); await flush()
        const card = gallery.card('active'), event = gallery.gesture({ pointerType })
        for (const cancel of ['onPointerUp', 'onPointerCancel', 'onPointerLeave']) {
            card.props.onPointerDown(event); card.props[cancel](); gallery.hold()
            assert.equal(gallery.dialog(), undefined)
        }
        card.props.onPointerDown(event)
        card.props.onPointerMove(gallery.gesture({ clientY: 40 })); gallery.hold()
        assert.equal(gallery.dialog(), undefined)
        card.props.onPointerDown(gallery.gesture({ pointerType: 'mouse' })); gallery.hold()
        assert.equal(gallery.dialog(), undefined)
        card.props.onPointerDown(event); gallery.hold()
        assert.equal(gallery.dialog().props.count, 1)
        card.props.onPointerUp(); card.props.onClick(event)
        assert.equal(gallery.card('active').props['aria-pressed'], false)
        gallery.dialog().props.onCancel()
        card.props.onPointerDown(event); card.props.onPointerUp(); card.props.onClick(event)
        assert.equal(gallery.card('active').props['aria-pressed'], true)
        card.props.onPointerDown(event); gallery.unmount()
        assert.equal(gallery.timers.size, 0)
    }
})

test('deletion is limited to custom templates in Edit Designs and supports keyboard access', async () => {
    const picker = templateGallery({ management: false }); picker.render(); await flush()
    for (const id of ['default-classic', 'active', 'other']) {
        const card = picker.card(id === 'default-classic' ? 'Photo Strip' : id)
        assert.ok(card)
        assert.equal(card.props.onContextMenu, undefined)
        assert.equal(card.props.onPointerDown, undefined)
        assert.equal(card.props.onKeyDown, undefined)
    }
    picker.card('active').props.onClick(picker.gesture())
    assert.deepEqual(picker.selections, ['active'])
    const gallery = templateGallery(); gallery.render(); await flush()
    assert.equal(gallery.card('Photo Strip'), undefined)
    gallery.card('active').props.onKeyDown(gallery.gesture({ key: 'Delete' }))
    assert.equal(gallery.dialog().props.count, 1)
    gallery.dialog().props.onCancel()
    gallery.card('other').props.onKeyDown(gallery.gesture({ key: 'F10', shiftKey: true }))
    gallery.dialog().props.onDelete(); await flush()
    assert.deepEqual(gallery.deleted, ['other'])
})

test('failed storage deletion retains the template and active selection; bulk deletion reports partial failure', async () => {
    const gallery = templateGallery({ failIds: ['active'] }); gallery.render(); await flush()
    gallery.card('active').props.onContextMenu(gallery.gesture())
    gallery.dialog().props.onDelete(); await flush()
    assert.ok(gallery.card('active'))
    assert.deepEqual(gallery.notifications, [])
    assert.ok(gallery.render().some(node => node.props?.role === 'alert'))
    for (const id of ['active', 'other']) {
        gallery.card(id).props.onPointerDown(gallery.gesture({ pointerType: 'mouse' }))
        gallery.card(id).props.onClick(gallery.gesture())
    }
    gallery.render().find(node => node.type === 'button' && node.props.children?.[0] === 'Delete Selected (').props.onClick()
    assert.equal(gallery.dialog().props.count, 2)
    gallery.dialog().props.onDelete(); await flush()
    assert.ok(gallery.card('active'))
    assert.equal(gallery.card('other'), undefined)
    assert.deepEqual(gallery.notifications, [['other']])
    assert.equal(gallery.saved.size, 1)
})

// Render UI handlers without running browser-only effects or child components.
function ui(file, props, imports) {
    const state = []; let cursor = 0, tree
    const jsx = (type, props) => ({ type, props })
    const Component = load(file, { ...imports, 'lucide-react': {},
        react: { useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] }, useEffect() {}, useRef: current => ({ current }) },
        'react/jsx-runtime': { jsx, jsxs: jsx },
    }).default
    const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
    const render = () => { cursor = 0; tree = Component(props); return nodes(tree) }
    return { render, find: type => nodes(tree).find(node => node.type === type) }
}

test('paper size defaults to 4R and survives customization, layout changes, and saved-design selection', () => {
    const app = ui('src/App.tsx', {}, {
        './App.css': {}, './Components/CameraBooth': { default: 'CameraBooth', __esModule: true },
        './Components/FleuraLogo': { default: 'Logo', __esModule: true },
        './Components/LayoutDetails': { default: 'LayoutDetails', __esModule: true },
        './Components/CustomizedLayouts': { default: 'CustomizedLayouts', __esModule: true },
        './hooks/useAndroidBack': { useAndroidBack() {} }, './lib/native': { isAndroidApp: () => false }, '@capacitor/app': {},
    })
    app.render().find(node => node.type === 'button' && node.props.className.includes('hero-start')).props.onClick()
    for (const layout of ['classic', 'postcard', 'landscape']) {
        app.render().find(node => node.type === 'button' && node.props.className === 'layout-choice-card group'
            && [node.props.children].flat().some(child => child?.props?.children === (layout === 'classic' ? 'Photo Strip' : layout === 'postcard' ? 'Postcard' : 'Landscape Postcard'))).props.onClick()
        app.render()
        const picker = app.find('CustomizedLayouts')
        assert.equal(picker.props.paperSize, layout === 'classic' ? '4R' : '3R')
        picker.props.onPaperSizeChange('3R'); app.render()
        app.find('CustomizedLayouts').props.onCustomize(); app.render()
        assert.equal(app.find('LayoutDetails').props.options.paperSize, '3R')
        app.find('LayoutDetails').props.onChange({ ...app.find('LayoutDetails').props.options, borderColor: '#123456', borderThickness: 1.2 }); app.render()
        app.find('LayoutDetails').props.onBack(); app.render()
        app.find('CustomizedLayouts').props.onCustomize(); app.render()
        assert.equal(app.find('LayoutDetails').props.options.borderColor, '#123456')
        assert.equal(app.find('LayoutDetails').props.options.borderThickness, 1.2)
        app.find('LayoutDetails').props.onBack(); app.render()
        app.find('CustomizedLayouts').props.onSelect({ id: 'old-template', settings: { layout, frameColor: 'Pink', backgroundImage: 'saved-background', paperSize: '4R', borderColor: '#987654', borderThickness: 2 } }); app.render()
        const camera = app.find('CameraBooth')
        assert.equal(camera.props.initialOptions.paperSize, '3R')
        assert.equal(camera.props.initialOptions.backgroundImage, 'saved-background')
        assert.equal(camera.props.initialOptions.borderColor, '#987654')
        assert.equal(camera.props.initialOptions.borderThickness, 2)
        camera.props.onExitToLayouts()
    }
})

test('deleting the active custom template selects the default and clears its saved appearance for every layout', () => {
    for (const layout of ['classic', 'postcard', 'landscape']) {
        const app = ui('src/App.tsx', {}, {
            './App.css': {}, './Components/CameraBooth': { default: 'CameraBooth', __esModule: true },
            './Components/FleuraLogo': { default: 'Logo', __esModule: true },
            './Components/LayoutDetails': { default: 'LayoutDetails', __esModule: true },
            './Components/CustomizedLayouts': { default: 'CustomizedLayouts', __esModule: true },
            './hooks/useAndroidBack': { useAndroidBack() {} }, './lib/native': { isAndroidApp: () => false }, '@capacitor/app': {},
        })
        const chooseLayout = () => {
            const label = layout === 'classic' ? 'Photo Strip' : layout === 'postcard' ? 'Postcard' : 'Landscape Postcard'
            app.render().find(node => node.type === 'button' && node.props.className === 'layout-choice-card group'
                && [node.props.children].flat().some(child => child?.props?.children === label)).props.onClick()
            app.render()
        }
        app.render().find(node => node.type === 'button' && node.props.className.includes('hero-start')).props.onClick()
        chooseLayout()
        app.find('CustomizedLayouts').props.onPaperSizeChange('3R'); app.render()
        app.find('CustomizedLayouts').props.onSelect({ id: 'active', settings: { layout, backgroundImage: 'custom.png', background: '#123456', frameColor: 'Pink', design: [{ id: 'text' }], borderColor: '#abcdef', borderThickness: 1.2 } })
        app.render(); app.find('CameraBooth').props.onExitToLayouts(); chooseLayout()
        app.find('CustomizedLayouts').props.onCustomize(); app.render()
        assert.equal(app.find('LayoutDetails').props.selectedId, 'active')
        app.find('LayoutDetails').props.onDeleted(['other']); app.render()
        assert.equal(app.find('LayoutDetails').props.options.backgroundImage, 'custom.png')
        assert.equal(app.find('LayoutDetails').props.selectedId, 'active')
        app.find('LayoutDetails').props.onDeleted(['active']); app.render()
        const details = app.find('LayoutDetails')
        assert.equal(details.props.selectedId, `default-${layout}`)
        assert.equal(details.props.options.layout, layout)
        assert.equal(details.props.options.paperSize, '3R')
        assert.equal(details.props.options.backgroundImage, undefined)
        assert.equal(details.props.options.background, '#ffffff')
        assert.equal(details.props.options.frameColor, 'White')
        assert.equal(details.props.options.borderColor, undefined)
        assert.equal(details.props.options.borderThickness, undefined)
        assert.deepEqual([...details.props.options.design], [])
        details.props.onBack(); app.render()
        assert.equal(app.find('CustomizedLayouts').props.selectedId, `default-${layout}`)
    }
})

test('Edit Designs forwards successful deletions to the owner of the active design', () => {
    let removed
    const details = ui('src/Components/LayoutDetails.tsx', { options: { layout: 'classic' }, selectedId: 'active', onDeleted: ids => { removed = ids } }, {
        './PhotoStrip': { default: 'PhotoStrip', __esModule: true }, './PaperSizeSelect': {}, './BorderControls': {},
        './CustomizedLayouts': { default: 'CustomizedLayouts', __esModule: true },
        '../lib/photoStrip': { paperForLayout: () => ({ width: 1200, height: 1800 }) }, '../lib/layoutBackground': {}, '../lib/stripTemplates': {},
    })
    details.render().find(node => node.type === 'button' && node.props.children === 'Edit Designs').props.onClick()
    details.render()
    const gallery = details.find('CustomizedLayouts')
    assert.equal(gallery.props.management, true)
    assert.equal(gallery.props.selectedId, 'active')
    gallery.props.onDeleted(['active'])
    assert.deepEqual(removed, ['active'])
})

test('one color picker and one thickness control update the entire design and default to no added border', () => {
    for (const layout of ['classic', 'postcard', 'landscape']) for (const paperSize of ['3R', '4R']) {
        const options = { layout, paperSize, monochrome: false, frameColor: 'White', caption: '', date: '', backgroundImage: 'built-in-border' }
        let next
        const controls = ui('src/Components/BorderControls.tsx', { options, onChange: value => { next = value } }, {})
        const inputs = controls.render().filter(node => node.type === 'input')
        assert.equal(inputs.length, 2)
        const color = inputs.find(node => node.props.type === 'color')
        const thickness = inputs.find(node => node.props.type === 'range')
        assert.equal(thickness.props.value, 0)
        color.props.onChange({ target: { value: '#123456' } })
        assert.equal(next.borderColor, '#123456')
        assert.equal(next.backgroundImage, 'built-in-border')
        thickness.props.onChange({ target: { value: '1.2' } })
        assert.equal(next.borderThickness, 1.2)
        assert.equal(next.layout, layout); assert.equal(next.paperSize, paperSize)
    }
})

test('4R frames match the supplied artwork openings while 3R remains unchanged', () => {
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': {} })
    for (const paperSize of ['3R', '4R']) {
        const layout = strip.websiteLayoutForOptions({ layout: 'landscape', paperSize })
        const frames = strip.photoFrames(layout)
        assert.equal(frames.length, 3)
        for (const frame of frames) {
            assert.equal(frame.width, paperSize === '3R' ? 684 : 2095 * (1200 / 3281))
            assert.equal(frame.height, paperSize === '3R' ? 444 : 1352 * (1200 / 3281))
            assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= layout.width && frame.y + frame.height <= layout.height)
        }
        assert.equal(frames[0].y, frames[1].y)
        assert.equal(frames[0].x, frames[2].x)
        assert.ok(frames[1].x > frames[0].x + frames[0].width)
        assert.ok(frames[2].y > frames[0].y + frames[0].height)
        assert.ok(Math.abs(layout.width - frames[1].x - frames[1].width - frames[0].x) < 1e-6)
        assert.equal(strip.designArea(layout).left, frames[1].x)
        if (paperSize === '4R') {
            const scale = 1200 / 3281, offset = (1800 - 4687 * scale) / 2
            const reference = [{ x: 182, y: 269 }, { x: 2410, y: 269 }, { x: 182, y: 1714 }]
            frames.forEach((frame, index) => {
                assert.ok(Math.abs(frame.x - offset - reference[index].x * scale) < 1e-6)
                assert.ok(Math.abs(frame.y - reference[index].y * scale) < 1e-6)
            })
            const area = strip.designArea(layout)
            assert.equal(area.left, frames[1].x); assert.equal(area.top, frames[2].y)
            assert.equal(area.width, frames[0].width); assert.equal(area.height, frames[0].height)
        } else {
            assert.deepEqual(Array.from(frames, frame => [frame.x, frame.y]), [[50, 50], [766, 50], [50, 519]])
        }
    }
})

test('4R keeps complete source artwork visible and scales event details identically in preview and export', async () => {
    const draws = [], scales = [], decorations = []
    class Photo { naturalWidth = 4687; naturalHeight = 3281; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect() {}, fillText() {}, drawImage(image, ...args) { draws.push([image.source, ...args]) },
        save() {}, restore() {}, scale(...args) { scales.push(args) } }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': { drawDesign: async (...args) => decorations.push(args.slice(2)) }, './fleuraQr': {} }, {
        Image: Photo, document: { createElement: () => ({ getContext: () => context, toDataURL: () => 'png' }) },
    })
    const options = { layout: 'landscape', paperSize: '4R', frameColor: 'White', backgroundImage: 'source-art', design: [{ id: 'event' }] }
    const layout = strip.websiteLayoutForOptions(options), scale = 1200 / 1050
    for (const preview of [true, false]) {
        draws.length = 0
        await strip.generatePhotoStrip(['1', '2', '3'], options, layout, true, preview)
        const artwork = draws[0]
        assert.equal(artwork[0], 'source-art'); assert.equal(artwork.length, 5)
        assert.ok(Math.abs(artwork[1] - (1800 - 4687 * 1200 / 3281) / 2) < 1e-6)
        assert.equal(artwork[2], 0); assert.equal(artwork[3], 4687 * (1200 / 3281)); assert.equal(artwork[4], 1200)
        assert.deepEqual(scales.at(-1), [scale, scale])
        assert.ok(Math.abs(decorations.at(-1)[2] - 1352 * 1050 / 3281) < 1e-6)
        assert.ok(Math.abs(decorations.at(-1)[4] - 2095 * 1050 / 3281) < 1e-6)
    }
})

test('every frame has matching inset borders in SVG, preview PNG, and final PNG without changing its outer edges', async () => {
    const fills = [], draws = []
    class Photo { naturalWidth = 1280; naturalHeight = 720; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect(...rect) { fills.push({ color: this.fillStyle, rect }) }, drawImage(image, ...args) { if (image.source !== 'png') draws.push(args.slice(-4)) }, fillText() {} }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': {} }, {
        Image: Photo, document: { createElement: () => ({ getContext: () => context, toDataURL: () => 'png' }) },
    })
    for (const layout of ['classic', 'postcard', 'landscape']) for (const paperSize of ['3R', '4R']) {
        const options = { layout, paperSize, monochrome: false, frameColor: 'White', caption: '', date: '' }
        const geometry = strip.websiteLayoutForOptions(options)
        const photos = Array.from({ length: layout === 'landscape' ? 3 : 4 }, (_, index) => String(index + 1))
        const render = (settings, preview) => layout === 'classic' ? strip.generateWebsiteClassicSheet(photos, settings, preview) : strip.generatePhotoStrip(photos, settings, geometry, true, preview)
        fills.length = 0; draws.length = 0
        await render(options, false)
        const originalFrames = draws.slice()
        assert.equal(fills.length, 1) // Background only: existing templates default to zero added border.
        const bordered = { ...options, borderColor: '#123456', borderThickness: 1.2 }
        for (const preview of [true, false]) {
            fills.length = 0; draws.length = 0
            await render(bordered, preview)
            assert.deepEqual(draws, originalFrames)
            const edges = fills.filter(fill => fill.color === '#123456').map(fill => fill.rect)
            assert.equal(edges.length, photos.length * 4)
            originalFrames.forEach(([x, y, width, height], index) => {
                const border = edges.slice(index * 4, index * 4 + 4)
                for (const [edgeX, edgeY, edgeWidth, edgeHeight] of border) {
                    assert.ok(edgeX >= x - 1e-6 && edgeY >= y - 1e-6)
                    assert.ok(edgeX + edgeWidth <= x + width + 1e-6 && edgeY + edgeHeight <= y + height + 1e-6)
                }
                assert.ok(Math.abs(border[0][3] - 1.2 * 300 / 25.4) < 1e-6)
                assert.equal(border[0][0], x); assert.equal(border[0][1], y); assert.equal(border[0][2], width)
                assert.ok(Math.abs(border[1][1] + border[1][3] - y - height) < 1e-6)
            })
            const svg = ui('src/Components/PhotoStrip.tsx', { ...bordered, photos, generatedImage: null, live: true, paired: layout === 'classic' }, {
                '../lib/photoStrip': strip, '../lib/native': { isAndroidApp: () => false }, '../lib/fleuraQr': {}, '../lib/stripDesign': {},
            }).render()
            const svgEdges = svg.filter(node => node.type === 'rect' && node.props.fill === '#123456').map(({ props }) => [props.x, props.y, props.width, props.height])
            assert.deepEqual(svgEdges, layout === 'classic' ? [...edges, ...edges] : edges)
        }
    }
})

test('3R and 4R previews and PNGs share paper dimensions and photo geometry for every website layout', async () => {
    const canvases = [], draws = []
    class Photo { naturalWidth = 1280; naturalHeight = 720; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect() {}, drawImage(image, ...args) { draws.push([image.source, ...args]) }, fillText() {} }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': {} }, {
        Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'png' }; canvases.push(canvas); return canvas } },
    })
    for (const paperSize of ['4R', '3R']) for (const layout of ['classic', 'postcard', 'landscape']) {
        const options = { monochrome: false, frameColor: 'White', caption: '', date: '', layout, paperSize }
        const paper = strip.paperForLayout(layout, paperSize)
        const dimensions = paperSize === '3R' ? [1050, 1500] : [1200, 1800]
        assert.deepEqual([paper.width, paper.height], layout === 'landscape' ? dimensions.toReversed() : dimensions)
        assert.equal(paper.width / paper.widthInches, 300); assert.equal(paper.height / paper.heightInches, 300)
        const geometry = strip.websiteLayoutForOptions(options)
        const photos = layout === 'landscape' ? ['1', '2', '3'] : ['1', '2', '3', '4']
        const generate = preview => layout === 'classic' ? strip.generateWebsiteClassicSheet(photos, options, preview) : strip.generatePhotoStrip(photos, options, geometry, true, preview)
        draws.length = 0; await generate(true)
        const preview = draws.slice()
        assert.equal(canvases.at(-1).width, paper.width); assert.equal(canvases.at(-1).height, paper.height)
        draws.length = 0; await generate(false)
        assert.deepEqual(draws, preview)
        const slots = draws.filter(([source]) => photos.includes(source)).map(draw => draw.slice(-4))
        assert.equal(slots.length, photos.length)
        for (const [x, y, width, height] of slots) {
            assert.ok(x >= 0 && y >= 0 && x + width <= geometry.width + 1e-6 && y + height <= paper.height + 1e-6)
        }
        if (layout === 'classic') {
            assert.deepEqual(draws.slice(-2), [['png', 0, 0], ['png', paper.width / 2, 0]])
            const area = strip.designArea(geometry)
            assert.equal(area.left, geometry.border)
            assert.ok(Math.abs(area.top + area.height - slots.at(-1)[1] - slots.at(-1)[3]) < 1e-6)
        }
        const previewUi = ui('src/Components/PhotoStrip.tsx', { ...options, photos: [], generatedImage: null, live: true, paired: layout === 'classic' }, {
            '../lib/photoStrip': strip, '../lib/native': { isAndroidApp: () => false }, '../lib/fleuraQr': {}, '../lib/stripDesign': {},
        })
        previewUi.render()
        assert.equal(previewUi.find('svg').props.viewBox, `0 0 ${paper.width} ${paper.height}`)
    }
})

test('capture results and print page sizes retain the selected size for every website layout', async () => {
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': {} })
    for (const paperSize of ['4R', '3R']) for (const layout of ['classic', 'postcard', 'landscape']) {
        const app = booth(false, { initialOptions: { layout, paperSize } }); app.render(); await flush()
        app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
        app.button('Start').props.onClick(); app.render()
        for (let i = 0; i < (layout === 'landscape' ? 9 : 12); i++) app.tick(1000)
        app.tick(0); await flush(); app.render()
        assert.equal(app.exports[0].options.paperSize, paperSize)
        const modal = app.all().find(node => node.type === 'CompletedModal')
        assert.equal(modal.props.ready, true)
        modal.props.onPrint(); app.render()
        const props = app.all().find(node => node.type === 'PrintPreview').props
        assert.equal(props.paperSize, paperSize)
        const print = ui('src/Components/PrintPreview.tsx', props, {
            '../lib/photoStrip': strip, '../lib/native': { isAndroidApp: () => false }, '../lib/thermalPrint': { printDimensions: () => ({}) },
            './PrinterConnection': {}, './PrinterAnimation': {}, '../hooks/useBluetoothPrinter': { useBluetoothPrinter: () => ({ info: {} }) },
        })
        print.render()
        const paper = strip.paperForLayout(layout, paperSize)
        assert.ok(print.find('style').props.children.includes(`@page { size: ${paper.widthInches}in ${paper.heightInches}in; margin: 0; }`))
        app.unmount()
    }
})

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
    const start = app.button('Start'); start.props.onClick(); start.props.onClick(); app.render()
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

test('native cancel capture clears partial photos and timers while keeping the camera ready for restart', async () => {
    const app = booth(false, {}, true); app.render(); await flush()
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
    app.button('Start').props.onClick(); app.render(); app.unmount()
    assert.equal(app.timers.size, 0); assert.equal(app.stops(), 1); assert.equal(app.video.srcObject, null)
})

test('each layout counts down before every shot, fills thumbnails in order, and plays every shutter', async () => {
    for (const layout of ['classic', 'postcard', 'landscape']) {
        const app = booth(false, { initialLayout: layout }); app.render(); await flush()
        assert.ok(app.all().some(node => ['website-camera', 'landscape-capture'].every(name => node.props.className?.split(' ').includes(name))))
        assert.equal(app.all().filter(node => node.type === 'video').length, 1)
        assert.equal(app.all().some(node => node.type === 'PhotoStrip'), false)
        assert.ok(app.all().some(node => node.type === 'button' && node.props['aria-label'] === 'Return to photo layout selection'))
        app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
        app.button('Start').props.onClick(); app.render()
        const count = layout === 'landscape' ? 3 : 4
        const column = app.all().find(node => node.type === 'ol')
        assert.equal(column.props.className, 'landscape-photo-slots')
        assert.equal(column.props.style['--photo-slot-count'], count)
        const slots = () => app.all().filter(node => node.type === 'li')
        assert.equal(slots().length, count)
        for (let shot = 1; shot <= count; shot++) {
            for (const remaining of [3, 2, 1]) {
                assert.ok(app.all().some(node => node.props['aria-label'] === `Capturing in ${remaining} seconds`))
                assert.equal(app.count(), shot - 1)
                assert.equal(app.shutters(), shot - 1)
                app.tick(1000)
            }
            assert.equal(app.shutters(), shot)
            assert.deepEqual(slots().map(node => node.props['aria-label']),
                Array.from({ length: count }, (_, index) => `Photo ${index + 1}: ${index < shot ? 'captured' : 'empty'}`))
            assert.equal(app.all().some(node => node.type === 'CompletedModal'), shot === count)
        }
        assert.equal(app.count(), count)
        app.unmount()
        assert.equal(app.timers.size, 0)
    }
})

test('a failed shot never plays a shutter or completes the session, and retry clears partial photos', async () => {
    for (const layout of ['classic', 'postcard']) {
        const app = booth(false, { initialLayout: layout }); app.render(); await flush()
        app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
        app.button('Start').props.onClick(); app.render()
        for (let i = 0; i < 3; i++) app.tick(1000)
        assert.equal(app.shutters(), 1)
        app.video.readyState = 0
        for (let i = 0; i < 3; i++) app.tick(1000)
        assert.equal(app.count(), 1)
        assert.equal(app.shutters(), 1)
        assert.equal(app.all().some(node => node.type === 'CompletedModal'), false)
        assert.ok(app.all().some(node => node.props.role === 'alert'))
        assert.equal(app.timers.size, 0)
        app.button('Retry camera').props.onClick(); app.render(); await flush(); app.render()
        assert.equal(app.all().filter(node => node.type === 'li').length, 0)
        assert.ok(app.button('Start'))
        app.unmount()
    }
})

test('Landscape capture fills three slots in order, opens the result after shot three, and preserves the 4R export', async () => {
    const options = { layout: 'landscape', monochrome: false, frameColor: 'White', caption: '', date: '', backgroundImage: 'saved-design' }
    const app = booth(false, { initialOptions: options }); app.render(); await flush()
    const slots = () => app.all().filter(node => node.type === 'li')
    assert.equal(slots().length, 0)
    assert.equal(app.all().some(node => node.type === 'PhotoStrip'), false)
    assert.equal(app.button('Start').props.disabled, true)
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    const start = app.button('Start')
    assert.equal(start.props.disabled, false)
    start.props.onClick(); start.props.onClick(); app.render()
    assert.equal(app.button('Start'), undefined)
    assert.equal(app.button('Cancel Capture'), undefined)
    assert.equal(slots().length, 3)
    assert.ok(slots().every(node => node.props.className === 'is-empty'))
    for (let shot = 1; shot <= 3; shot++) {
        for (const remaining of [3, 2, 1]) {
            assert.ok(app.all().some(node => node.props['aria-label'] === `Capturing in ${remaining} seconds`))
            assert.equal(app.count(), shot - 1)
            app.tick(1000)
        }
        assert.equal(app.count(), shot)
        const images = app.all().filter(node => node.type === 'img')
        assert.deepEqual(images.map(node => node.props.src), Array.from({ length: shot }, (_, index) => `photo-${index + 1}`))
        assert.equal(slots().filter(node => node.props.className === 'is-empty').length, 3 - shot)
        assert.equal(app.all().some(node => node.type === 'CompletedModal'), shot === 3)
    }
    assert.equal(app.stops(), 1)
    assert.equal([...app.timers.values()].filter(timer => timer.delay === 1000).length, 0)
    app.tick(0); await flush(); app.render()
    const result = app.all().find(node => node.type === 'CompletedModal')
    assert.equal(result.props.ready, true)
    assert.equal(result.props.image, 'strip.png')
    assert.equal(app.exports.length, 1)
    const exported = app.exports[0]
    assert.deepEqual([...exported.photos], ['photo-1', 'photo-2', 'photo-3'])
    assert.equal(exported.options.backgroundImage, 'saved-design')
    assert.equal(exported.layout.width, 1800); assert.equal(exported.layout.height, 1200)
    assert.equal(exported.layout.columns, 2); assert.equal(exported.layout.photoCount, 3)
    result.props.onPrint(); app.render()
    const print = app.all().find(node => node.type === 'PrintPreview')
    assert.equal(print.props.layout, 'landscape'); assert.equal(print.props.image, 'strip.png')
    print.props.onBack(); app.render()
    app.all().find(node => node.type === 'CompletedModal').props.onRetake(); app.render(); await flush(); app.render()
    assert.equal(slots().length, 0)
    assert.ok(app.button('Start'))
    assert.equal(app.all().some(node => node.type === 'CompletedModal'), false)
    assert.ok(app.video.srcObject)
    app.unmount()
})

test('exit modal pauses and resumes every layout without losing photos or allowing a queued shot', async () => {
    for (const android of [false, true]) for (const layout of ['classic', 'postcard', 'landscape']) {
        let exits = 0
        const app = booth(false, { initialLayout: layout, onClose: () => exits++, onExitToLayouts: () => exits++ }, android)
        app.render(); await flush()
        app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
        app.button(android ? 'Start Capture' : 'Start').props.onClick(); app.render()
        for (let i = 0; i < 4; i++) app.tick(1000)
        const queued = [...app.timers.values()].find(timer => timer.delay === 1000).fn
        const close = app.all().find(node => node.type === 'button' && /^Return to/.test(node.props['aria-label'] || ''))
        close.props.onClick()
        queued() // Even a timer already queued before React renders must not capture.
        app.render()
        const dialog = app.all().find(node => node.type === 'ExitSessionDialog')
        assert.ok(dialog)
        assert.equal(exits, 0); assert.equal(app.stops(), 0); assert.equal(app.count(), 1)
        assert.equal(app.timers.size, 0)
        assert.ok(app.all().some(node => node.props['aria-label'] === 'Capturing in 2 seconds'))
        assert.equal(app.all().filter(node => node.type === 'img').length, 1)
        dialog.props.onKeep(); app.render()
        assert.equal(app.all().some(node => node.type === 'ExitSessionDialog'), false)
        app.tick(1000); app.tick(1000)
        assert.equal(app.count(), 2)
        app.back(); app.render()
        assert.ok(app.all().some(node => node.type === 'ExitSessionDialog'))
        app.back(); app.render()
        assert.equal(app.all().some(node => node.type === 'ExitSessionDialog'), false)
        assert.equal(exits, 0)
        close.props.onClick(); app.render()
        const exit = app.all().find(node => node.type === 'ExitSessionDialog').props.onExit
        exit(); exit(); app.render()
        assert.equal(exits, 1); assert.equal(app.stops(), 1)
        assert.equal(app.video.srcObject, null)
        assert.equal(app.all().filter(node => node.type === 'img').length, 0)
        assert.equal(app.timers.size, 0)
        app.unmount(); assert.equal(app.timers.size, 0)
    }
})

test('exit before starting capture asks first and Keep Taking Photos leaves the camera ready', async () => {
    let exits = 0
    const app = booth(false, { onExitToLayouts: () => exits++ }); app.render(); await flush()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    const start = app.button('Start')
    app.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Return to photo layout selection').props.onClick()
    start.props.onClick(); app.render()
    assert.equal(app.timers.size, 0); assert.equal(exits, 0)
    app.all().find(node => node.type === 'ExitSessionDialog').props.onKeep(); app.render()
    assert.equal(app.button('Start').props.disabled, false)
    assert.ok(app.video.srcObject)
    app.unmount()
})

test('exiting Landscape capture clears the photo boxes, stops the camera, and cancels the countdown', async () => {
    let exits = 0
    const app = booth(false, { initialLayout: 'landscape', onExitToLayouts: () => exits++ }); app.render(); await flush()
    app.all().find(node => node.type === 'video').props.onLoadedData(); app.render()
    app.button('Start').props.onClick(); app.render()
    for (let second = 0; second < 3; second++) app.tick(1000)
    app.all().find(node => node.type === 'button' && node.props['aria-label'] === 'Return to photo layout selection').props.onClick(); app.render()
    assert.equal(exits, 0)
    app.all().find(node => node.type === 'ExitSessionDialog').props.onExit(); app.render()
    assert.equal(exits, 1)
    assert.equal(app.stops(), 1)
    assert.equal(app.video.srcObject, null)
    assert.equal(app.all().filter(node => node.type === 'img').length, 0)
    assert.equal(app.all().filter(node => node.type === 'li').length, 0)
    assert.equal(app.timers.size, 0)
    app.unmount()
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
    const app = booth(false, {}, true); app.render(); await flush()
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

test('Bluetooth diagnostic square contains exactly 48x48 black pixels with known row bytes', () => {
    const raster = load('src/lib/yhkRaster.ts', { './fleuraQr': {}, './photoStrip': {} }, { Uint8Array, Uint8ClampedArray, Float32Array, btoa: value => Buffer.from(value, 'binary').toString('base64') })
    const job = Buffer.from(raster.yhkTestJob(), 'base64')
    assert.deepEqual([...job.subarray(0, 10)], [27, 64, 29, 118, 48, 0, 48, 0, 64, 0])
    for (let y = 0; y < 64; y++) {
        for (let byte = 0; byte < 48; byte++) {
            assert.equal(job[10 + y * 48 + byte], y >= 8 && y < 56 && byte >= 21 && byte < 27 ? 255 : 0)
        }
    }
    assert.deepEqual([...job.subarray(-6)], [27, 100, 4, 10, 10, 10])
})

test('postcard exports four grid photos at 1200x1800 and leaves decoration space; classic dimensions stay unchanged', async () => {
    const canvases = [], positions = []
    class Photo {
        naturalWidth = 1280; naturalHeight = 720
        set src(value) { this.onload() }
    }
    const context = { fillRect() {}, drawImage(...args) { positions.push(args.slice(-4)) }, measureText() { return { width: 100 } }, fillText() {} }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': load('src/lib/stripDesign.ts', {}), './fleuraQr': { drawFleuraQr: () => 204, FLEURA_QR_CAPTION: 'QR caption' } }, { Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'png' }; canvases.push(canvas); return canvas } } })
    const options = { monochrome: false, frameColor: 'White', caption: '', date: '', layout: 'postcard' }
    await strip.generatePhotoStrip(['1', '2', '3', '4'], options)
    assert.equal(canvases[0].width, 1200); assert.equal(canvases[0].height, 1800)
    assert.deepEqual(positions, [[60, 60, 525, 405], [615, 60, 525, 405], [60, 495, 525, 405], [615, 495, 525, 405]])
    const area = strip.designArea(strip.layoutForOptions(options))
    assert.equal(area.top, 930); assert.equal(area.height, 510)
    positions.length = 0
    await strip.generatePhotoStrip(['1', '2', '3', '4'], { ...options, layout: 'classic' })
    assert.equal(canvases[1].height, 4610)
    assert.deepEqual(positions, [[60, 60, 1080, 810], [60, 900, 1080, 810], [60, 1740, 1080, 810], [60, 2580, 1080, 810]])
})

test('background renders beneath fixed slots in partial previews and exports', async () => {
    const draws = [], placeholders = [], canvases = []
    class Photo {
        naturalWidth = 1200; naturalHeight = 1800
        set src(value) { this.source = value; this.onload() }
    }
    const context = { fillRect(...args) { placeholders.push(args) }, drawImage(image, ...args) { draws.push([image.source, ...args.slice(-4)]) }, measureText() { return { width: 100 } }, fillText() {} }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': { drawFleuraQr: () => 204, FLEURA_QR_CAPTION: 'QR caption' } }, { Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'png' }; canvases.push(canvas); return canvas } } })
    for (const layout of ['postcard', 'classic']) {
        const options = { monochrome: false, frameColor: 'White', caption: '', date: '', layout, backgroundImage: 'background' }
        draws.length = 0; placeholders.length = 0
        await strip.generatePhotoStrip(['1', '2'], options, undefined, true, true)
        const height = layout === 'postcard' ? 1800 : 4610
        assert.equal(canvases.at(-1).height, height)
        assert.deepEqual(draws[0], ['background', 0, 0, 1200, height])
        assert.equal(placeholders.length, 3) // White base plus two empty photo slots.
        const previewPositions = draws.slice(1)
        draws.length = 0
        await strip.generatePhotoStrip(['1', '2', '3', '4'], options)
        assert.deepEqual(draws.slice(1, 3), previewPositions)
        assert.equal(draws.length, 5)
    }
})

test('landscape 4R uses three equal landscape frames in a 2x2 grid with a free design cell', async () => {
    const draws = [], canvases = []
    class Photo { naturalWidth = 1800; naturalHeight = 1200; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect() {}, drawImage(image, ...args) { draws.push([image.source, ...args.slice(-4)]) }, fillText() {} }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': { drawFleuraQr: () => 200, FLEURA_QR_CAPTION: 'QR' } }, { Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'png' }; canvases.push(canvas); return canvas } } })
    const options = { layout: 'landscape', monochrome: false, frameColor: 'White', caption: '', date: '', backgroundImage: 'background' }
    assert.equal(strip.photoCountForOptions(options), 3)
    await strip.generatePhotoStrip(['1', '2', '3'], options)
    assert.equal(canvases[0].width, 1800); assert.equal(canvases[0].height, 1200)
    assert.deepEqual(draws[0], ['background', 0, 0, 1800, 1200])
    assert.equal(draws.length, 4)
    const frames = draws.slice(1)
    assert.deepEqual(frames, [['1', 60, 60, 825, 450], ['2', 915, 60, 825, 450], ['3', 60, 540, 825, 450]])
    const area = strip.designArea(strip.LANDSCAPE_LAYOUT)
    assert.equal(area.left, 915); assert.equal(area.top, 540)
    assert.equal(area.width, 825); assert.equal(area.height, 450)
    draws.length = 0
    await strip.generatePhotoStrip(['1'], options, undefined, true, true)
    assert.equal(canvases[1].height, 1200)
    assert.deepEqual(draws[1], frames[0])
    await assert.rejects(strip.generatePhotoStrip(['1', '2', '3', '4'], options))
})

test('classic export has no automatic branding or QR while other layouts retain theirs', async () => {
    const texts = []; let qrCount = 0
    class Photo { naturalWidth = 1200; naturalHeight = 1800; set src(value) { this.onload() } }
    const context = { fillRect() {}, drawImage() {}, fillText(text) { texts.push(text) }, measureText() { return { width: 0 } } }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': { drawFleuraQr: () => { qrCount++; return 200 }, FLEURA_QR_CAPTION: 'QR caption' } }, { Image: Photo, document: { createElement() { return { getContext: () => context, toDataURL: () => 'png' } } } })
    const options = { monochrome: false, frameColor: 'White', caption: '', date: '' }
    await strip.generatePhotoStrip(['1', '2', '3', '4'], options)
    assert.equal(qrCount, 0); assert.deepEqual(texts, [])
    await strip.generatePhotoStrip(['1', '2', '3', '4'], { ...options, layout: 'postcard' })
    assert.equal(qrCount, 1); assert.ok(texts.includes('SnapBerry')); assert.ok(texts.includes('QR caption'))
    await strip.generatePhotoStrip(['1', '2', '3'], { ...options, layout: 'landscape' })
    assert.equal(qrCount, 2)
})

test('website postcard matches portrait grid reference and keeps the bottom background-only', async () => {
    const canvases = [], draws = [], texts = [], decorations = []
    class Photo { naturalWidth = 1200; naturalHeight = 1800; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect() {}, drawImage(image, ...args) { draws.push([image.source, ...args.slice(-4)]) }, fillText(text) { texts.push(text) } }
    const strip = load('src/lib/photoStrip.ts', {
        './stripDesign': { drawDesign: async (...args) => decorations.push(args) },
        './fleuraQr': { drawFleuraQr: () => assert.fail('Website postcard must not render QR') },
    }, { Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'png' }; canvases.push(canvas); return canvas } } })
    const options = { layout: 'postcard', monochrome: false, frameColor: 'White', backgroundImage: 'saved-upload', caption: 'Hidden', date: 'Hidden', design: [{ id: 'saved-design' }] }
    const layout = strip.websiteLayoutForOptions(options)
    await strip.generatePhotoStrip(['1', '2', '3', '4'], options, layout)
    assert.equal(canvases[0].width, 1200); assert.equal(canvases[0].height, 1800)
    assert.deepEqual(draws, [['saved-upload', 0, 0, 1200, 1800],
        ['1', 60, 60, 525, 700], ['2', 615, 60, 525, 700],
        ['3', 60, 790, 525, 700], ['4', 615, 790, 525, 700]])
    assert.deepEqual(texts, [])
    assert.equal(decorations[0][3] + decorations[0][4], 1490)
    assert.equal(options.backgroundImage, 'saved-upload'); assert.equal(options.design[0].id, 'saved-design')
    draws.length = 0; decorations.length = 0
    await strip.generatePhotoStrip(['1', '2', '3', '4'], options, layout, true, true)
    assert.deepEqual(draws.slice(1), [['1', 60, 60, 525, 700], ['2', 615, 60, 525, 700], ['3', 60, 790, 525, 700], ['4', 615, 790, 525, 700]])
    // Native and other layouts retain their original geometry.
    assert.equal(strip.layoutForOptions(options).photoHeight, 405)
    assert.equal(strip.websiteLayoutForOptions({ ...options, layout: 'classic' }), strip.WEBSITE_CLASSIC_LAYOUT)
    assert.equal(strip.websiteLayoutForOptions({ ...options, layout: 'landscape' }), strip.WEBSITE_LANDSCAPE_LAYOUT)
})

test('website Classic uses exact physical frames and an empty bottom on two native-size copies', async () => {
    const canvases = [], draws = [], texts = [], decorations = []
    class Photo { naturalWidth = 1280; naturalHeight = 720; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect() {}, drawImage(...args) { draws.push(args) }, fillText(text) { texts.push(text) } }
    const strip = load('src/lib/photoStrip.ts', {
        './stripDesign': { drawDesign: async (...args) => decorations.push(args) },
        './fleuraQr': { drawFleuraQr: () => assert.fail('Classic must not render QR') },
    }, { Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'png' }; canvases.push(canvas); return canvas } } })
    const options = { monochrome: false, frameColor: 'White', caption: 'Hidden', date: 'Hidden', design: [{ id: 'test' }] }
    await strip.generateWebsiteClassicSheet(['1', '2', '3', '4'], options)
    assert.equal(canvases[0].width, 600); assert.equal(canvases[0].height, 1800)
    assert.equal(canvases[1].width, 1200); assert.equal(canvases[1].height, 1800)
    const cm = pixels => pixels * 2.54 / 300
    const layout = strip.WEBSITE_CLASSIC_LAYOUT
    assert.ok(Math.abs(cm(layout.width - 2 * layout.border) - 4.32) < 1e-9)
    assert.ok(Math.abs(cm(layout.photoHeight) - 2.96) < 1e-9)
    assert.ok(Math.abs(cm(layout.footerHeight) - 2.56) < 1e-9)
    const bottom = layout.border + 4 * layout.photoHeight + 3 * layout.gap
    assert.ok(bottom + layout.footerHeight <= 1800)
    assert.equal(draws.length, 6)
    for (const draw of draws.slice(0, 4)) {
        assert.ok(Math.abs(cm(draw[7]) - 4.32) < 1e-9)
        assert.ok(Math.abs(cm(draw[8]) - 2.96) < 1e-9)
    }
    assert.equal(draws[4][0], draws[5][0])
    assert.deepEqual(draws[4].slice(1), [0, 0]); assert.deepEqual(draws[5].slice(1), [600, 0])
    assert.deepEqual(texts, [])
    assert.equal(decorations.length, 1)
    assert.ok(decorations[0][3] + decorations[0][4] <= bottom)
})

test('classic 4R print sheet draws the same strip twice without distortion or recapture', async () => {
    const draws = [], canvases = []
    class Photo { naturalWidth = 1200; naturalHeight = 4610; set src(value) { this.source = value; this.onload() } }
    const context = { fillRect() {}, drawImage(...args) { draws.push(args) } }
    const strip = load('src/lib/photoStrip.ts', { './stripDesign': {}, './fleuraQr': {} }, { Image: Photo, document: { createElement() { const canvas = { getContext: () => context, toDataURL: () => 'sheet' }; canvases.push(canvas); return canvas } } })
    assert.equal(await strip.generateClassicPrintSheet('finished-strip'), 'sheet')
    assert.equal(canvases[0].width, 1200); assert.equal(canvases[0].height, 1800)
    assert.equal(draws.length, 2); assert.equal(draws[0][0], draws[1][0]); assert.equal(draws[0][0].source, 'finished-strip')
    assert.deepEqual(draws[0].slice(2), draws[1].slice(2))
    const [, left, top, width, height] = draws[0]
    assert.ok(Math.abs(width / height - 1200 / 4610) < 1e-9)
    assert.ok(Math.abs(top - 30) < 1e-9); assert.ok(left >= 30)
    assert.ok(Math.abs(draws[1][1] - left - width - 30) < 1e-9)
    assert.ok(draws[1][1] + width <= 1170)
    assert.ok(top + height <= 1770)
    for (const layout of [undefined, 'classic', 'postcard']) {
        assert.deepEqual({ ...strip.paperForLayout(layout) }, { width: 1200, height: 1800, widthInches: 4, heightInches: 6 })
    }
    assert.deepEqual({ ...strip.paperForLayout('landscape') }, { width: 1800, height: 1200, widthInches: 6, heightInches: 4 })
})
