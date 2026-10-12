import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import PhotoStrip from './PhotoStrip'
import { deleteTemplate, listTemplates, type StripTemplate } from '../lib/stripTemplates'

type Props = { selectedId?: string | null; selectedLayout: StripTemplate['settings']['layout']; onSelect?: (template: StripTemplate) => void; onBack: () => void; onCustomize?: () => void; management?: boolean }

export default function CustomizedLayouts({ selectedId, selectedLayout, onSelect, onBack, onCustomize, management = false }: Props) {
    const [templates, setTemplates] = useState<StripTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    const deleting = useRef(false)
    useEffect(() => {
        let cancelled = false
        void listTemplates().then(saved => {
            if (!cancelled) setTemplates(saved.filter(template => Boolean(template.settings.backgroundImage)))
        }).catch(() => {
            if (!cancelled) setError('Unable to load saved designs. Please reopen this screen to try again.')
        }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])
    const layout = selectedLayout ?? 'classic'
    const defaultDesign: StripTemplate = {
        id: `default-${layout}`,
        name: layout === 'classic' ? 'Photo Strip' : layout === 'postcard' ? 'Postcard' : 'Landscape Postcard',
        settings: { layout, frameColor: 'White', background: '#ffffff', design: [] },
    }
    // Built-in preview only; never write the default design to template storage.
    const savedDesigns = templates.filter(template => (template.settings.layout ?? 'classic') === layout)
    const designs = management ? savedDesigns : [defaultDesign, ...savedDesigns]

    async function removeSelected() {
        const ids = selectedIds.filter(id => savedDesigns.some(template => template.id === id))
        if (!management || deleting.current || !ids.length) return
        if (!window.confirm(`Permanently delete ${ids.length} selected design${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
        deleting.current = true; setBusy(true); setError('')
        try {
            const results = await Promise.allSettled(ids.map(id => deleteTemplate(id)))
            const removed = ids.filter((_, index) => results[index].status === 'fulfilled')
            setTemplates(current => current.filter(template => !removed.includes(template.id)))
            setSelectedIds(current => current.filter(id => !removed.includes(id)))
            const failed = ids.length - removed.length
            if (failed) setError(`${failed} design${failed === 1 ? '' : 's'} could not be deleted. ${removed.length} deleted. Please retry the remaining selection.`)
        } finally { deleting.current = false; setBusy(false) }
    }

    return <main className={`homepage-layout-choice custom-designs${management ? ' design-management' : ''}`} aria-labelledby="custom-designs-title">
        <div className="custom-designs-heading">
            <h2 id="custom-designs-title" className="font-bold text-pink-600">{management ? 'Edit Designs' : 'Choose Your Design'}</h2>
            {!management && <button type="button" onClick={onCustomize} className="custom-designs-open rounded-full shadow-lg">Customize Design</button>}
        </div>
        {loading && <p role="status" className="text-center text-gray-500">Loading saved designs…</p>}
        {error && <p role="alert" className="text-center text-red-600">{error}</p>}
        {management && !loading && !error && !savedDesigns.length && <p className="text-center text-gray-500">No customized designs for this layout yet.</p>}
        {management && <div className="design-management-actions">
            <button type="button" className="layout-details-continue" disabled={busy || !selectedIds.length} onClick={() => void removeSelected()}>Delete Selected ({selectedIds.length})</button>
            <button type="button" className="layout-details-save" disabled={busy} onClick={onBack}>Cancel</button>
        </div>}
        <div className="custom-design-grid">
            {designs.map(template => <div key={template.id} className="custom-design-item">
                <button type="button" className="custom-design-option" disabled={busy}
                aria-label={`Select ${template.name}`} aria-pressed={management ? selectedIds.includes(template.id) : selectedId === template.id}
                onClick={() => management
                    ? setSelectedIds(current => current.includes(template.id) ? current.filter(id => id !== template.id) : [...current, template.id])
                    : onSelect?.(template)}>
                <div className={`custom-design-preview ${template.settings.layout === 'landscape' ? 'is-landscape' : ''}`} aria-hidden="true">
                    <PhotoStrip photos={[]} generatedImage={null} live paired={!template.settings.layout || template.settings.layout === 'classic'}
                        monochrome={false} caption="" date="" {...template.settings} />
                </div>
                {management && selectedIds.includes(template.id) && <span className="design-selected-check"><Check size={18} aria-hidden="true" /></span>}
                </button>
            </div>)}
        </div>
        <button type="button" className="layout-choice-back" disabled={busy} onClick={onBack}><ArrowLeft size={18} /> {management ? 'Done' : 'Back'}</button>
    </main>
}
