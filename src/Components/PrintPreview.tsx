import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { paperForLayout, type StripOptions } from '../lib/photoStrip'
import { printDimensions } from '../lib/thermalPrint'
import PrinterConnection from './PrinterConnection'
import PrinterAnimation from './PrinterAnimation'
import { isAndroidApp, SnapBerryNative } from '../lib/native'
import { useBluetoothPrinter } from '../hooks/useBluetoothPrinter'

type Props = { layout?: StripOptions['layout']; image: string; onBack: () => void }

export default function PrintPreview({ layout, image, onBack }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const printImageRef = useRef<HTMLImageElement>(null)
    const printingRef = useRef(false)
    const autoStarted = useRef(false)
    const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined)
    const [error, setError] = useState('')
    const [printing, setPrinting] = useState(false)
    const [animationAttempt, setAnimationAttempt] = useState(0)
    const printer = useBluetoothPrinter()
    const classicCopies = !isAndroidApp() && (!layout || layout === 'classic')
    const outputImage = image
    const postcard = layout === 'postcard' || layout === 'landscape'
    const paper = paperForLayout(layout)
    const paperWidth = 57
    const dimensions = printDimensions(paperWidth, aspectRatio)
    const showSetup = !printing && (animationAttempt === 0 || printer.failed || Boolean(error))

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

    async function printNow(system = false) {
        const element = printImageRef.current
        if (!element || printingRef.current || printer.busy) return
        printingRef.current = true
        setPrinting(true)
        setError('')
        try {
            await element.decode()
            if (!element.isConnected) return
            if (isAndroidApp() && !system) await printer.print(image, paperWidth, () => setAnimationAttempt(attempt => attempt + 1))
            else {
                setAnimationAttempt(attempt => attempt + 1)
                if (isAndroidApp()) await SnapBerryNative.printImage({ dataUrl: image, paperWidth })
                else window.print()
            }
        } catch {
            if (element.isConnected) setError('Unable to print. Please try again.')
        } finally {
            printingRef.current = false
            if (element.isConnected) setPrinting(false)
        }
    }

    return <>
        <dialog ref={dialogRef} className="completed-strip-modal" aria-labelledby="print-title"
            onCancel={event => { event.preventDefault(); onBack() }}>
            <h2 id="print-title" className="text-xl font-bold text-pink-600">{printing || animationAttempt > 0 ? 'Printing…' : 'Print your strip'}</h2>
            {classicCopies && outputImage && <img src={outputImage} alt="4R portrait print preview: two identical four-photo strips" className="mx-auto block w-full max-w-[300px] bg-white shadow-md" style={{ aspectRatio: `${paper.width} / ${paper.height}`, objectFit: 'contain' }} />}
            {classicCopies && !outputImage && !error && <p role="status" className="text-center text-sm text-gray-600">Preparing print preview…</p>}
            {!classicCopies && animationAttempt > 0 && <PrinterAnimation key={animationAttempt} image={image} />}
            {printing && <p role="status" aria-live="polite" className="text-center text-sm text-gray-600">
                {animationAttempt > 0 ? 'Sending your strip…' : 'Connecting and preparing your strip…'}
                {printer.progress !== null && ` ${printer.progress}%`}
            </p>}
            {!printing && animationAttempt > 0 && printer.failed && <p role="alert" className="text-center text-sm text-red-600">{printer.message}</p>}
            {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
            {showSetup && <>
                {!classicCopies && <PrinterConnection printer={printer} processing={printing} />}
                {isAndroidApp() && <button type="button" disabled={printer.busy} onClick={() => void printNow(true)} className="min-h-12 rounded-full border border-pink-200 px-3 py-3 font-semibold text-pink-600 disabled:opacity-50">Android System Print</button>}
                <button type="button" disabled={printer.busy || printing || !outputImage} onClick={() => void printNow()} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-pink-600 px-3 py-3 font-semibold text-white disabled:opacity-50"><Printer size={18} /> {classicCopies ? 'Print Now' : printer.info.confirmed ? 'Print' : 'Connect / Continue'}</button>
            </>}
            <button type="button" onClick={onBack} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-pink-200 px-3 py-3 font-semibold text-pink-600"><ArrowLeft size={18} /> {printing ? 'Cancel' : 'Back'}</button>
        </dialog>
        <div className="strip-print-only">{outputImage && <img ref={printImageRef} src={outputImage} alt="Photo strip for printing" onLoad={event => {
            setAspectRatio(event.currentTarget.naturalHeight / event.currentTarget.naturalWidth)
            if (classicCopies || autoStarted.current) return
            autoStarted.current = true
            void printNow()
        }} />}</div>
        <style>{postcard || classicCopies
            ? `@media print { @page { size: ${paper.widthInches}in ${paper.heightInches}in; margin: 0; } .strip-print-only { width: ${paper.widthInches}in; height: ${paper.heightInches}in; } .strip-print-only img { width: 100%; height: 100%; object-fit: contain; } }`
            : `@media print { @page { size: ${paperWidth}mm ${dimensions.height}mm; margin: ${dimensions.margin}mm; } .strip-print-only { width: ${dimensions.width}mm; } }`}</style>
    </>
}


