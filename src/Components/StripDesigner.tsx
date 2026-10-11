import { useEffect, useRef, useState } from 'react'
import { generatePhotoStrip, layoutForOptions, stripHeight, STRIP_LAYOUT, type StripOptions } from '../lib/photoStrip'
import { DESIGN_FONTS, constrainDesign, type DesignItem } from '../lib/stripDesign'
import DragDesignCanvas from './DragDesignCanvas'

type Props = { options: StripOptions; onChange: (options: StripOptions) => void; onDone: () => void }
const button = 'min-h-11 rounded-xl border border-pink-200 px-3 py-2 text-sm font-semibold text-pink-700'
export default function StripDesigner({ options, onChange, onDone }: Props) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [preview, setPreview] = useState('')
    const [error, setError] = useState('')
    const [uploading, setUploading] = useState(false)
    const mounted = useRef(false)
    const textInput = useRef<HTMLInputElement>(null)
    const [editRequest, setEditRequest] = useState(0)
    const items = options.design ?? []
    const layout = layoutForOptions()
    const height = stripHeight(layout)
    const editableHeight = height - layout.border * 2 - STRIP_LAYOUT.footerHeight - layout.qrFooterHeight
    const hasDesign = items.length > 0
    const background = options.background
    const frameColor = options.frameColor
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
        const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 810
        const context = canvas.getContext('2d')
        if (!context) return
        context.fillStyle = '#fce7f3'; context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#9d174d'; context.font = '48px Arial'; context.textAlign = 'center'; context.fillText('Your photo here', 540, 420)
        const timer = window.setTimeout(() => {
            void generatePhotoStrip(Array(4).fill(canvas.toDataURL('image/png')), { monochrome: false, caption: '', date: '', background, frameColor, design: hasDesign ? [{ id: 'base', kind: 'text', value: '', font: 'Simple', size: 64, x: 50, y: 80 }] : [] }, undefined, false).then(image => { if (!cancelled) { setPreview(image); setError('') } }).catch(() => { if (!cancelled) setError('Unable to preview your design. Try removing the last item.') })
        }, 120)
        return () => { cancelled = true; window.clearTimeout(timer) }
    }, [hasDesign, background, frameColor])
    function add(kind: DesignItem['kind'], value: string, aspectRatio?: number) {
        if (items.length >= 6) { setError('You can add up to 6 items.'); return }
        const id = crypto.randomUUID()
        onChange({ ...options, design: [...items, { id, kind, value, font: 'Simple', size: kind === 'image' ? 90 : 64, x: 50, y: 80, aspectRatio }] }); setSelected(id)
    }
    function edit(patch: Partial<DesignItem>) { onChange({ ...options, design: items.map(item => item.id === selected ? constrainDesign({ ...item, ...patch }, 1080, editableHeight) : item) }) }
    async function upload(file?: File) {
        if (!file || uploading) return
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Choose a PNG, JPG, or WebP image under 8 MB.'); return }
        setUploading(true); setError('')
        try {
            const url = URL.createObjectURL(file)
            try {
                const image = new Image(); image.src = url; await image.decode()
                const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight))
                const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale)
                const context = canvas.getContext('2d'); if (!context) throw new Error()
                context.drawImage(image, 0, 0, canvas.width, canvas.height)
                if (mounted.current) add('image', canvas.toDataURL('image/png'), image.naturalWidth / image.naturalHeight)
            } finally { URL.revokeObjectURL(url) }
        } catch { if (mounted.current) setError('Unable to open that image. Try another one.') }
        finally { if (mounted.current) setUploading(false) }
    }
    return <dialog ref={dialog} className="completed-strip-modal" aria-labelledby="design-title" onCancel={event => { event.preventDefault(); onDone() }}>
        <h2 id="design-title" className="text-xl font-bold text-pink-600">Design your strip</h2>

        <div className="relative mx-auto w-full max-w-[300px] bg-white shadow-md" style={{ aspectRatio: `1200 / ${height}` }}>
            {preview && <img src={preview} alt="Editable photo strip" className="block h-full w-full" />}
            <div className="absolute" style={{ left: '5%', width: '90%', top: `${60 / height * 100}%`, height: `${editableHeight / height * 100}%` }}>
                <DragDesignCanvas height={editableHeight} items={items} selected={selected} onSelect={setSelected} onEditText={id => { setSelected(id); setEditRequest(value => value + 1) }} onChange={design => onChange({ ...options, design })} />
            </div>
        </div>
            <div className="min-w-0 space-y-2">
                <button type="button" className={`${button} w-full`} disabled={items.length >= 6} onClick={() => add('text', 'Your text')}>Add Text</button>
                <label className={`${button} block text-center`}>{uploading ? 'Loading…' : 'Add Image'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || items.length >= 6} className="mt-2 w-full text-xs" onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
                <div className="flex flex-wrap gap-1">{['♡', '✿', '🍓', '🌷'].map(sticker => <button key={sticker} type="button" aria-label={`Add ${sticker} sticker`} disabled={items.length >= 6} className={button} onClick={() => add('text', sticker)}>{sticker}</button>)}</div>
                {items.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`${button} w-full truncate ${selected === item.id ? 'bg-pink-100' : ''}`}>{item.kind === 'image' ? `Image ${index + 1}` : item.value || 'Empty text'}</button>)}
            </div>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-pink-700">Background<input type="color" value={options.background ?? '#ffffff'} onChange={event => onChange({ ...options, background: event.target.value })} className="h-11 w-14" /></label>
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


