import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { ArrowLeft, Check, Trash2, X } from 'lucide-react'
import PhotoStrip from './PhotoStrip'
import PaperSizeSelect from './PaperSizeSelect'
import DeleteTemplateDialog from './DeleteTemplateDialog'
import type { PaperSize } from '../lib/photoStrip'
import { deleteTemplate, listTemplates, type StripTemplate } from '../lib/stripTemplates'

type Props = { selectedId?: string | null; selectedLayout: StripTemplate['settings']['layout']; paperSize?: PaperSize; onPaperSizeChange?: (size: PaperSize) => void; onSelect?: (template: StripTemplate) => void; onBack: () => void; onCustomize?: () => void; management?: boolean; onDeleted?: (ids: string[]) => void }

export default function CustomizedLayouts({ selectedId, selectedLayout, paperSize = '4R', onPaperSizeChange, onSelect, onBack, onCustomize, management = false, onDeleted }: Props) {
    const [templates, setTemplates] = useState<StripTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectionMode, setSelectionMode] = useState(false)
    const [busy, setBusy] = useState(false)
    const [pendingIds, setPendingIds] = useState<string[] | null>(null)
    const deleting = useRef(false)
    const press = useRef<{ timer: number; x: number; y: number } | null>(null)
    const suppressClick = useRef(false)
    const lastClick = useRef<{ id: string; time: number } | null>(null)
    function cancelPress() {
        if (press.current) window.clearTimeout(press.current.timer)
        press.current = null
    }
    useEffect(() => () => cancelPress(), [])
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

    function requestDelete(requested: string[]) {
        cancelPress()
        lastClick.current = null
        const ids = requested.filter(id => savedDesigns.some(template => template.id === id))
        if ((management || selectionMode) && !deleting.current && ids.length) setPendingIds(ids)
    }

    async function removeSelected() {
        const ids = (pendingIds ?? []).filter(id => savedDesigns.some(template => template.id === id))
        if ((!management && !selectionMode) || deleting.current || !ids.length) return
        deleting.current = true; setBusy(true); setError('')
        try {
            const results = await Promise.allSettled(ids.map(id => deleteTemplate(id)))
            const removed = ids.filter((_, index) => results[index].status === 'fulfilled')
            setTemplates(current => current.filter(template => !removed.includes(template.id)))
            setSelectedIds(current => current.filter(id => !removed.includes(id)))
            setPendingIds(null)
            if (removed.length) onDeleted?.(removed)
            const failed = ids.length - removed.length
            if (failed) setError(`${failed} design${failed === 1 ? '' : 's'} could not be deleted. ${removed.length} deleted. Please retry the remaining selection.`)
        } finally { deleting.current = false; setBusy(false) }
    }

    return <main className={`homepage-layout-choice custom-designs${management ? ' design-management' : ''}`} aria-labelledby="custom-designs-title">
        <div className="custom-designs-heading">
            <h2 id="custom-designs-title" className="font-bold text-pink-600">{management ? 'Edit Designs' : 'Choose Your Design'}</h2>
            {!management && <div className="custom-design-actions">
                <button type="button" onClick={onCustomize} className="custom-designs-open rounded-full shadow-lg">Customize Design</button>
                {onPaperSizeChange && <PaperSizeSelect value={paperSize} onChange={onPaperSizeChange} />}
                <button type="button" className="custom-designs-open custom-designs-delete rounded-full shadow-lg" aria-label={selectionMode ? 'Cancel deletion' : 'Delete designs'} aria-pressed={selectionMode} disabled={loading || busy} onClick={() => { setSelectionMode(current => !current); setSelectedIds([]) }}>{selectionMode ? <X size={20} aria-hidden="true" /> : <Trash2 size={20} aria-hidden="true" />}</button>
            </div>}
        </div>
        {loading && <p role="status" className="text-center text-gray-500">Loading saved designs…</p>}
        {error && <p role="alert" className="text-center text-red-600">{error}</p>}
        {management && !loading && !error && !savedDesigns.length && <p className="text-center text-gray-500">No customized designs for this layout yet.</p>}
        {(management || selectionMode) && <div className="design-management-actions">
            <button type="button" className="layout-details-continue" disabled={busy || !selectedIds.length} onClick={() => requestDelete(selectedIds)}>Delete Selected ({selectedIds.length})</button>
            {management && <button type="button" className="layout-details-save" disabled={busy} onClick={onBack}>Cancel</button>}
        </div>}
        {selectionMode && <p className="text-center text-sm text-gray-500">{savedDesigns.length ? 'Select uploaded designs to delete. Built-in designs cannot be deleted.' : 'No uploaded designs for this layout.'}</p>}
        {management && savedDesigns.length > 0 && <p className="text-center text-sm text-gray-500">Double-tap, double-click, touch and hold, or right-click a template to delete it. With a keyboard, focus a template and press Delete.</p>}
        <div className="custom-design-grid">
            {designs.map(template => <div key={template.id} className="custom-design-item">
                <button type="button" className="custom-design-option" disabled={busy || (selectionMode && template === defaultDesign)}
                aria-label={`${selectionMode ? 'Select for deletion' : 'Select'} ${template.name}`} aria-pressed={management || selectionMode ? selectedIds.includes(template.id) : selectedId === template.id}
                {...(management ? {
                    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
                        event.preventDefault()
                        suppressClick.current = true
                        requestDelete([template.id])
                    },
                    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
                        cancelPress()
                        suppressClick.current = false
                        if (!event.isPrimary || event.button !== 0 || event.pointerType === 'mouse') return
                        press.current = { x: event.clientX, y: event.clientY, timer: window.setTimeout(() => {
                            suppressClick.current = true
                            requestDelete([template.id])
                        }, 600) }
                    },
                    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
                        if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancelPress()
                    },
                    onPointerUp: cancelPress,
                    onPointerCancel: cancelPress,
                    onPointerLeave: cancelPress,
                    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
                        if (event.key === 'Delete' || (event.shiftKey && event.key === 'F10')) {
                            event.preventDefault()
                            requestDelete([template.id])
                        }
                    },
                } : {})}
                onClick={event => {
                    if (suppressClick.current && event.detail !== 0) { event.preventDefault(); suppressClick.current = false; return }
                    if (pendingIds) return
                    if (selectionMode) {
                        setSelectedIds(current => current.includes(template.id) ? current.filter(id => id !== template.id) : [...current, template.id])
                    } else if (management) {
                        const previous = lastClick.current
                        if (event.detail !== 0 && previous?.id === template.id && event.timeStamp - previous.time >= 0 && event.timeStamp - previous.time <= 500) {
                            setSelectedIds(current => current.includes(template.id) ? current.filter(id => id !== template.id) : [...current, template.id])
                            requestDelete([template.id])
                            return
                        }
                        lastClick.current = event.detail === 0 ? null : { id: template.id, time: event.timeStamp }
                        setSelectedIds(current => current.includes(template.id) ? current.filter(id => id !== template.id) : [...current, template.id])
                    }
                    else onSelect?.(template)
                }}>
                <div className={`custom-design-preview ${template.settings.layout === 'landscape' ? 'is-landscape' : ''}`} aria-hidden="true">
                    <PhotoStrip photos={[]} generatedImage={null} live paired={!template.settings.layout || template.settings.layout === 'classic'}
                        monochrome={false} caption="" date="" {...template.settings} paperSize={management ? template.settings.paperSize : paperSize} />
                </div>
                {(management || selectionMode) && selectedIds.includes(template.id) && <span className="design-selected-check"><Check size={18} aria-hidden="true" /></span>}
                </button>
            </div>)}
        </div>
        <button type="button" className="layout-choice-back" disabled={busy} onClick={onBack}><ArrowLeft size={18} /> {management ? 'Done' : 'Back'}</button>
        {pendingIds && <DeleteTemplateDialog count={pendingIds.length} busy={busy} onCancel={() => setPendingIds(null)} onDelete={() => void removeSelected()} />}
    </main>
}
