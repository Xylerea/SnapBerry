import { useEffect, useRef } from 'react'
import { Printer, RotateCcw, X } from 'lucide-react'
import SaveStripButton from './SaveStripButton'
import PhotoStrip from './PhotoStrip'
import { layoutForOptions, stripHeight, type StripOptions } from '../lib/photoStrip'

type Props = {
    photos: string[]
    options: StripOptions
    image: string | null
    ready: boolean
    error: string
    onClose: () => void
    onRetake: () => void
    onPrint: () => void
    onRetry: () => void
}

export default function CompletedStripModal({ photos, options, image, ready, error, onClose, onRetake, onPrint, onRetry }: Props) {
    const layout = layoutForOptions()
    const dialogRef = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        const dialog = dialogRef.current
        const previousFocus = document.activeElement
        const overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog?.showModal()
        return () => {
            dialog?.close()
            document.body.style.overflow = overflow
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
        }
    }, [])

    return (
        <dialog ref={dialogRef} className="completed-strip-modal" aria-labelledby="completed-title"
            onCancel={event => { event.preventDefault(); onClose() }}>
            <div className="flex items-center justify-between gap-2">
                <h2 id="completed-title" className="text-xl font-bold text-pink-600">Your sweet moments ðŸ“</h2>
                <button type="button" onClick={onClose} aria-label="Return to homepage" className="shrink-0 rounded-full p-3 text-pink-600 hover:bg-pink-100"><X size={20} /></button>
            </div>
            <div className="mx-auto w-full" style={{ maxWidth: `min(240px, calc(max(160px, 100dvh - 270px) * ${layout.width / stripHeight(layout, photos.length)}))` }}>
                <PhotoStrip photos={photos} {...options} generatedImage={ready ? image : null} />
            </div>
            <p role={error ? 'alert' : 'status'} className={`text-center text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
                {error || (ready ? 'Your strip is ready to download or print.' : 'Preparing your stripâ€¦')}
            </p>
            {error && <button type="button" onClick={onRetry} className="min-h-12 rounded-full border border-pink-200 px-3 py-3 font-semibold text-pink-600">Retry strip</button>}
            <div className="modal-actions grid grid-cols-2 gap-2">
                <SaveStripButton image={image} ready={ready} />
                <button type="button" onClick={onRetake} className="flex min-h-12 items-center justify-center gap-1 rounded-full border border-pink-200 px-3 py-3 font-semibold text-pink-600"><RotateCcw size={18} /> Retake</button>
                <button type="button" disabled={!ready} onClick={onPrint} className="flex min-h-12 items-center justify-center gap-1 rounded-full border border-pink-200 px-3 py-3 font-semibold text-pink-600 disabled:opacity-50"><Printer size={18} /> Print</button>
            </div>
        </dialog>
    )
}



