import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Upload } from 'lucide-react'
import PhotoStrip from './PhotoStrip'
import CustomizedLayouts from './CustomizedLayouts'
import { paperForLayout, type StripOptions } from '../lib/photoStrip'
import { loadLayoutBackground } from '../lib/layoutBackground'
import { saveTemplate } from '../lib/stripTemplates'

type Props = { options: StripOptions; onChange: (options: StripOptions) => void; onBack: () => void; onContinue: () => void; onSaved: (id: string) => void }

export default function LayoutDetails({ options, onChange, onBack, onContinue, onSaved }: Props) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [editingDesigns, setEditingDesigns] = useState(false)
    const mounted = useRef(false)
    const working = useRef(false)
    const savedId = useRef<string | null>(null)
    useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
    const paper = paperForLayout(options.layout)
    const title = options.layout === 'landscape' ? 'Landscape Postcard' : options.layout === 'postcard' ? 'Postcard' : 'Photo Strip'

    async function upload(file?: File) {
        if (!file || working.current) return
        working.current = true; setBusy(true); setError('')
        try {
            const backgroundImage = await loadLayoutBackground(file, Math.max(paper.width, paper.height))
            if (mounted.current) { savedId.current = null; onChange({ ...options, backgroundImage }) }
        } catch (cause) {
            if (mounted.current) setError(cause instanceof Error ? cause.message : 'Unable to open that image. Try another one.')
        } finally { working.current = false; if (mounted.current) setBusy(false) }
    }

    async function save() {
        if (!options.backgroundImage || working.current) return
        working.current = true; setBusy(true); setError('')
        try {
            const { layout, background, backgroundImage, frameColor, design } = options
            const id = savedId.current ?? crypto.randomUUID()
            await saveTemplate({ id, name: `${title} Design`, settings: { layout, background, backgroundImage, frameColor, design } })
            savedId.current = id
            if (mounted.current) onSaved(id)
        } catch { if (mounted.current) setError('Unable to save this layout. Please try again.') }
        finally { working.current = false; if (mounted.current) setBusy(false) }
    }

    if (editingDesigns) return <CustomizedLayouts selectedLayout={options.layout} management onBack={() => setEditingDesigns(false)} />

    return <main className="homepage-layout-choice layout-details" aria-labelledby="layout-details-title">
        <div className="layout-details-heading">
            <div>
                <h2 id="layout-details-title" className="font-bold text-pink-600">{title}</h2>
                <p className="mt-1 text-sm text-gray-500">{options.layout === 'landscape' ? 3 : 4} captures · 4R {options.layout === 'landscape' ? 'Landscape' : 'Portrait'}</p>
            </div>
            <button type="button" className="custom-designs-open" disabled={busy} onClick={() => setEditingDesigns(true)}>Edit Designs</button>
        </div>
        <div className="layout-details-grid">
            <div className="layout-details-preview" style={{ aspectRatio: `${paper.width} / ${paper.height}`, width: `min(100%, calc(var(--details-preview-height) * ${paper.width / paper.height}))` }}>
                <PhotoStrip photos={[]} generatedImage={null} live paired={!options.layout || options.layout === 'classic'} {...options} />
            </div>
            <div className="layout-details-controls">
                <p className="text-sm text-gray-500">Add your background. Photo frames stay fixed.</p>
                <label className="layout-details-upload"><span className="flex items-center justify-center gap-2"><Upload size={18} /> {options.backgroundImage ? 'Replace Background (PNG/JPG)' : 'Upload Background (PNG/JPG)'}</span>
                    <input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} />
                </label>
                <button type="button" className="layout-details-save" disabled={busy || !options.backgroundImage} onClick={() => void save()}>Save Design</button>
                {busy && <p role="status" className="text-sm text-gray-500">Preparing your layout…</p>}
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <button type="button" className="layout-details-continue" disabled={busy} onClick={onContinue}><Camera size={18} /> Continue to Camera</button>
            </div>
        </div>
        <button type="button" className="layout-choice-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
    </main>
}
