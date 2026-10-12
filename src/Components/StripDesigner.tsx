import { useEffect, useRef, useState } from 'react'
import { generatePhotoStrip, photoCountForOptions, layoutForOptions, websiteLayoutForOptions, stripHeight, designArea, type StripOptions } from '../lib/photoStrip'
import { isAndroidApp } from '../lib/native'
import { loadLayoutBackground } from '../lib/layoutBackground'
import { DESIGN_FONTS, constrainDesign, type DesignItem } from '../lib/stripDesign'
import DragDesignCanvas from './DragDesignCanvas'
import { listTemplates, saveTemplate, deleteTemplate, type StripTemplate } from '../lib/stripTemplates'

type Props = { options: StripOptions; photos?: string[]; onChange: (options: StripOptions) => void; onDone: () => void }
const button = 'min-h-11 rounded-xl border border-pink-200 px-3 py-2 text-sm font-semibold text-pink-700'
export default function StripDesigner({ options, photos, onChange, onDone }: Props) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [preview, setPreview] = useState('')
    const [error, setError] = useState('')
    const [uploading, setUploading] = useState(false)
    const [templates, setTemplates] = useState<StripTemplate[]>([])
    const [templateName, setTemplateName] = useState('')
    const [templateBusy, setTemplateBusy] = useState(false)
    const templateLock = useRef(false)
    const [templateMessage, setTemplateMessage] = useState('')
    const mounted = useRef(false)
    const latestOptions = useRef(options)
    useEffect(() => { latestOptions.current = options }, [options])
    const textInput = useRef<HTMLInputElement>(null)
    const [editRequest, setEditRequest] = useState(0)
    const items = options.design ?? []
    const layout = isAndroidApp() ? layoutForOptions(options) : websiteLayoutForOptions(options)
    const height = stripHeight(layout)
    const area = designArea(layout)
    const editableHeight = area.height
    const editableWidth = area.width
    const layoutChoice = options.layout
    const hasDesign = items.length > 0
    const background = options.background
    const frameColor = options.frameColor
    const backgroundImage = options.backgroundImage
    const photosKey = JSON.stringify(photos ?? [])
    const current = items.find(item => item.id === selected)
    useEffect(() => {
        if (editRequest) { textInput.current?.focus(); textInput.current?.select() }
    }, [editRequest])
    useEffect(() => {
        mounted.current = true
        const element = dialog.current, focus = document.activeElement, overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'; element?.showModal()
        return () => { mounted.current = false; element?.close(); document.body.style.overflow = overflow; if (focus instanceof HTMLElement && focus.isConnected) focus.focus() }
    }, [])
    useEffect(() => {
        let cancelled = false
        void listTemplates().then(saved => { if (!cancelled) setTemplates(saved) }).catch(() => {
            if (!cancelled) setTemplateMessage('Saved templates are unavailable. Please try reopening the editor.')
        })
        return () => { cancelled = true }
    }, [])
    async function changeTemplates(operation: () => Promise<unknown>, message: string) {
        if (templateLock.current) return
        templateLock.current = true; setTemplateBusy(true); setTemplateMessage('')
        try {
            await operation()
            const saved = await listTemplates()
            if (mounted.current) { setTemplates(saved); setTemplateMessage(message) }
        } catch {
            if (mounted.current) setTemplateMessage('Unable to save changes. Check available device storage and try again.')
        } finally {
            templateLock.current = false
            if (mounted.current) setTemplateBusy(false)
        }
    }
    function saveCurrentTemplate() {
        const name = templateName.trim()
        if (!name || !backgroundImage || uploading || templateLock.current) return
        const settings = { layout: options.layout ?? 'classic', background: options.background, backgroundImage, frameColor, design: options.design } as const
        void changeTemplates(() => saveTemplate({ id: crypto.randomUUID(), name, settings }), 'Template saved on this device.')
    }
    useEffect(() => {
        let cancelled = false
        const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 810
        const context = canvas.getContext('2d')
        if (!context) return
        context.fillStyle = '#fce7f3'; context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#9d174d'; context.font = '48px Arial'; context.textAlign = 'center'; context.fillText('Your photo here', 540, 420)
        const timer = window.setTimeout(() => {
            const captured = JSON.parse(photosKey) as string[]
            const previewOptions: StripOptions = { monochrome: false, caption: '', date: '', background, backgroundImage, frameColor, layout: layoutChoice, design: hasDesign ? [{ id: 'base', kind: 'text', value: '', font: 'Simple', size: 64, x: 50, y: 80 }] : [] }
            void generatePhotoStrip(Array.from({ length: photoCountForOptions({ layout: layoutChoice }) }, (_, index) => captured[index] ?? canvas.toDataURL('image/png')), previewOptions, isAndroidApp() ? undefined : websiteLayoutForOptions(previewOptions), false).then(image => { if (!cancelled) { setPreview(image); setError('') } }).catch(() => { if (!cancelled) setError('Unable to preview your design. Try removing the last item.') })
        }, 120)
        return () => { cancelled = true; window.clearTimeout(timer) }
    }, [hasDesign, background, backgroundImage, frameColor, layoutChoice, photosKey])
    function add(kind: DesignItem['kind'], value: string, aspectRatio?: number) {
        if (items.length >= 6) { setError('You can add up to 6 items.'); return }
        const id = crypto.randomUUID()
        onChange({ ...options, design: [...items, { id, kind, value, font: 'Simple', size: kind === 'image' ? 90 : 64, x: 50, y: 80, aspectRatio }] }); setSelected(id)
    }
    function edit(patch: Partial<DesignItem>) { onChange({ ...options, design: items.map(item => item.id === selected ? constrainDesign({ ...item, ...patch }, editableWidth, editableHeight) : item) }) }
    async function upload(file?: File, asBackground = false) {
        if (!file || uploading) return
        if (!(asBackground ? ['image/png', 'image/jpeg'] : ['image/png', 'image/jpeg', 'image/webp']).includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Choose a PNG, JPG, or WebP image under 8 MB.'); return }
        setUploading(true); setError('')
        try {
            if (asBackground) {
                const backgroundImage = await loadLayoutBackground(file, Math.max(layout.width, height))
                if (mounted.current) onChange({ ...latestOptions.current, backgroundImage })
                return
            }
            const url = URL.createObjectURL(file)
            try {
                const image = new Image(); image.src = url; await image.decode()
                const scale = Math.min(1, (asBackground ? Math.max(layout.width, height) : 800) / Math.max(image.naturalWidth, image.naturalHeight))
                const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale)
                const context = canvas.getContext('2d'); if (!context) throw new Error()
                context.drawImage(image, 0, 0, canvas.width, canvas.height)
                if (mounted.current) {
                    if (asBackground) onChange({ ...latestOptions.current, backgroundImage: canvas.toDataURL('image/png') })
                    else add('image', canvas.toDataURL('image/png'), image.naturalWidth / image.naturalHeight)
                }
            } finally { URL.revokeObjectURL(url) }
        } catch { if (mounted.current) setError('Unable to open that image. Try another one.') }
        finally { if (mounted.current) setUploading(false) }
    }
    return <dialog ref={dialog} className="completed-strip-modal" aria-labelledby="design-title" onCancel={event => { event.preventDefault(); onDone() }}>
        <h2 id="design-title" className="text-xl font-bold text-pink-600">Design your strip</h2>

        <div className="relative mx-auto w-full max-w-[300px] bg-white shadow-md" style={{ aspectRatio: `${layout.width} / ${height}` }}>
            {preview && <img src={preview} alt="Editable photo strip" className="block h-full w-full" />}
            <div className="absolute" style={{ left: `${area.left / layout.width * 100}%`, width: `${editableWidth / layout.width * 100}%`, top: `${area.top / height * 100}%`, height: `${editableHeight / height * 100}%` }}>
                <DragDesignCanvas width={editableWidth} height={editableHeight} items={items} selected={selected} onSelect={setSelected} onEditText={id => { setSelected(id); setEditRequest(value => value + 1) }} onChange={design => onChange({ ...options, design })} />
            </div>
        </div>
            <div className="min-w-0 space-y-2">
                <button type="button" className={`${button} w-full`} disabled={items.length >= 6} onClick={() => add('text', 'Your text')}>Add Text</button>
                <label className={`${button} block text-center`}>{uploading ? 'Loading…' : 'Add Image'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || items.length >= 6} className="mt-2 w-full text-xs" onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
                <div className="flex flex-wrap gap-1">{['♡', '✿', '🍓', '🌷'].map(sticker => <button key={sticker} type="button" aria-label={`Add ${sticker} sticker`} disabled={items.length >= 6} className={button} onClick={() => add('text', sticker)}>{sticker}</button>)}</div>
                {items.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`${button} w-full truncate ${selected === item.id ? 'bg-pink-100' : ''}`}>{item.kind === 'image' ? `Image ${index + 1}` : item.value || 'Empty text'}</button>)}
            </div>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-pink-700">Background<input type="color" value={options.background ?? '#ffffff'} onChange={event => onChange({ ...options, background: event.target.value })} className="h-11 w-14" /></label>
        <label className={`${button} block text-center`}>{uploading ? 'Loading?' : backgroundImage ? 'Replace Background' : 'Upload Background'}<input type="file" accept="image/png,image/jpeg" disabled={uploading} className="mt-2 w-full text-xs" onChange={event => { void upload(event.target.files?.[0], true); event.target.value = '' }} /></label>
        {backgroundImage && <button type="button" disabled={uploading} className={button} onClick={() => onChange({ ...options, backgroundImage: undefined })}>Remove Background</button>}
        <div className="space-y-2">
            <label className="block text-sm font-semibold text-pink-700">Template name<input value={templateName} maxLength={60} onChange={event => setTemplateName(event.target.value)} placeholder="My background design" className="mt-1 min-h-11 w-full rounded-lg border border-pink-200 px-3" /></label>
            <button type="button" className={`${button} w-full`} disabled={!backgroundImage || !templateName.trim() || uploading || templateBusy} onClick={saveCurrentTemplate}>Save as Template</button>
            <details>
                <summary className={`${button} cursor-pointer`}>Saved Templates ({templates.length})</summary>
                <div className="mt-2 space-y-3">
                    {!templates.length && <p className="text-sm text-gray-500">No saved templates yet.</p>}
                    {templates.map(template => <div key={template.id} className="min-w-0 space-y-1">
                        <p className="break-words text-sm font-semibold">{template.name} · {isAndroidApp() ? template.settings.layout === 'landscape' ? '4R Landscape' : template.settings.layout === 'postcard' ? 'Postcard' : 'Classic Vertical' : template.settings.layout === 'landscape' ? 'Landscape Postcard' : template.settings.layout === 'postcard' ? 'Postcard' : 'Photo Strip'}</p>
                        <div className="flex flex-wrap gap-1">
                            <button type="button" className={button} disabled={uploading || templateBusy} onClick={() => { onChange({ ...options, ...template.settings }); setSelected(null); setTemplateMessage('Template applied. Your photos are kept.') }}>Use</button>
                            <button type="button" className={button} disabled={templateBusy} onClick={() => {
                                const name = window.prompt('Template name', template.name)?.trim().slice(0, 60)
                                if (name) void changeTemplates(() => saveTemplate({ ...template, name }), 'Template renamed.')
                            }}>Rename</button>
                            <button type="button" className={button} disabled={templateBusy} onClick={() => {
                                if (window.confirm(`Delete "${template.name}"?`)) void changeTemplates(() => deleteTemplate(template.id), 'Template deleted.')
                            }}>Delete</button>
                        </div>
                    </div>)}
                </div>
            </details>
            {templateMessage && <p role="status" className="text-sm text-pink-700">{templateMessage}</p>}
        </div>
        {current && <div className="space-y-2 rounded-xl bg-white p-3">
            {current.kind === 'text' && <>
                <label className="block text-sm font-semibold">Text<input ref={textInput} value={current.value} maxLength={60} onChange={event => edit({ value: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-pink-200 px-3" /></label>
                <label className="block text-sm font-semibold">Font<select value={current.font} onChange={event => edit({ font: event.target.value as DesignItem['font'] })} className="mt-1 min-h-11 w-full rounded-lg border border-pink-200 px-3">{Object.entries(DESIGN_FONTS).map(([name, font]) => <option key={name} style={{ fontFamily: font }}>{name}</option>)}</select></label>
            </>}
            <label className="block text-sm">Size<input type="range" className="block min-h-11 w-full accent-pink-600" min={24} max={180} value={current.size} onChange={event => edit({ size: Number(event.target.value) })} /></label>
            <button type="button" className={button} onClick={() => { onChange({ ...options, design: items.filter(item => item.id !== selected) }); setSelected(null) }}>Delete</button>
        </div>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="button" onClick={onDone} className="min-h-12 rounded-full bg-pink-600 px-6 py-3 font-semibold text-white">Done</button>
    </dialog>
}



