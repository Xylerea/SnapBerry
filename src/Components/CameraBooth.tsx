import StripDesigner from './StripDesigner'
import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { isAndroidApp, SnapBerryNative } from '../lib/native'
import FleuraLogo from './FleuraLogo'
import CompletedStripModal from './CompletedStripModal'
import PrintPreview from './PrintPreview'
import { generatePhotoStrip, type StripOptions } from '../lib/photoStrip'
import './CameraBooth.css'

type CameraBoothProps = { onClose: () => void }

export default function CameraBooth({ onClose }: CameraBoothProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const capturingRef = useRef(false)
    const photoCount = 4
    const [photos, setPhotos] = useState<string[]>([])
    const [countdown, setCountdown] = useState<number | null>(null)
    const [cameraReady, setCameraReady] = useState(false)
    const [cameraAttempt, setCameraAttempt] = useState(0)
    const [error, setError] = useState('')
    const [options, setOptions] = useState<StripOptions>({ monochrome: false, frameColor: 'White', caption: '', date: '' })
    const [stripImage, setStripImage] = useState<string | null>(null)
    const [stripError, setStripError] = useState('')
    const [exporting, setExporting] = useState(false)
    const [exportAttempt, setExportAttempt] = useState(0)
    const [showDesigner, setShowDesigner] = useState(false)
    const [showPrintPreview, setShowPrintPreview] = useState(false)
    const complete = photos.length === photoCount
    // The rendered result is tied to its source/settings, preventing stale downloads.
    const [renderedSettings, setRenderedSettings] = useState('')
    const settingsKey = JSON.stringify(options)
    const exportReady = complete && !exporting && !!stripImage && renderedSettings === settingsKey

    useEffect(() => {
        function back(event: Event) {
            event.preventDefault()
            if (showDesigner) setShowDesigner(false)
            else if (showPrintPreview) setShowPrintPreview(false)
            else if (!photos.length || window.confirm('Return to the homepage? Your photos will be discarded.')) onClose()
        }
        window.addEventListener('snapberry:back', back)
        return () => window.removeEventListener('snapberry:back', back)
    }, [showDesigner, showPrintPreview, photos.length, onClose])

    useEffect(() => {
        if (photos.length !== photoCount) return
        let cancelled = false
        const timer = window.setTimeout(() => {
            setExporting(true)
            setStripError('')
            void generatePhotoStrip(photos, JSON.parse(settingsKey) as StripOptions).then(result => {
                if (cancelled) return
                setStripImage(result)
                setRenderedSettings(settingsKey)
                setExporting(false)
            }).catch(cause => {
                if (cancelled) return
                setStripError(cause instanceof Error ? cause.message : 'Unable to generate the strip.')
                setExporting(false)
            })
        }, 0)
        return () => { cancelled = true; window.clearTimeout(timer) }
    }, [photos, settingsKey, exportAttempt, photoCount])

    useEffect(() => {
        let cancelled = false
        let stream: MediaStream | null = null
        const video = videoRef.current
        function cameraFailed(message: string) {
            if (cancelled) return
            capturingRef.current = false
            setCountdown(null)
            setCameraReady(false)
            setError(message)
        }
        function handleEnded() {
            cameraFailed('The camera disconnected. Please retry to start a new session.')
        }
        async function startCamera() {
            if (!navigator.mediaDevices?.getUserMedia) {
                cameraFailed('Camera access is unavailable. Open SnapBerry using HTTPS or localhost in a supported browser.')
                return
            }
            try {
                if (isAndroidApp()) await SnapBerryNative.prepareCamera()
                if (cancelled) return
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
                })
                if (cancelled) {
                    cameraStream.getTracks().forEach(track => track.stop())
                    return
                }
                stream = cameraStream
                streamRef.current = cameraStream
                stream.getVideoTracks().forEach(track => track.addEventListener('ended', handleEnded))
                if (video) {
                    video.srcObject = stream
                    await video.play()
                }
            } catch (cause) {
                stream?.getTracks().forEach(track => track.stop())
                const name = cause instanceof DOMException ? cause.name :
                    cause instanceof Error && cause.message.includes('permission') ? 'NotAllowedError' : ''
                cameraFailed(name === 'NotAllowedError'
                    ? isAndroidApp()
                        ? 'Camera permission was denied. Allow Camera for SnapBerry in Android Settings, then retry.'
                        : 'Camera permission was denied. Allow access in your browser settings, then retry.'
                    : name === 'NotFoundError'
                        ? 'No camera was found. Connect or enable a camera, then retry.'
                        : 'Unable to start the camera. Close other apps using it, then retry.')
            }
        }
        void startCamera()
        return () => {
            cancelled = true
            stream?.getTracks().forEach(track => {
                track.removeEventListener('ended', handleEnded)
                track.stop()
            })
            if (streamRef.current === stream) streamRef.current = null
            if (video) video.srcObject = null
        }
    }, [cameraAttempt])

    // A single timeout drives the sequence and is cleared on every change or unmount.
    useEffect(() => {
        if (countdown === null) return
        const timer = window.setTimeout(() => {
            if (!capturingRef.current) return
            if (countdown > 1) {
                setCountdown(countdown - 1)
                return
            }
            try {
                const video = videoRef.current
                if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight
                    || !streamRef.current?.getVideoTracks().some(track => track.readyState === 'live')) {
                    throw new Error('Camera is not ready. Please retry the session.')
                }
                const canvas = document.createElement('canvas')
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                const context = canvas.getContext('2d')
                if (!context) throw new Error('Unable to capture a photo. Please retry the session.')
                context.translate(canvas.width, 0)
                context.scale(-1, 1)
                context.drawImage(video, 0, 0, canvas.width, canvas.height)
                const nextPhotos = [...photos, canvas.toDataURL('image/png')]
                setPhotos(nextPhotos)
                if (nextPhotos.length === photoCount) {
                    capturingRef.current = false
                    setCountdown(null)
                    setCameraReady(false)
                    streamRef.current?.getTracks().forEach(track => track.stop())
                    streamRef.current = null
                    video.srcObject = null
                } else {
                    setCountdown(3)
                }
            } catch (cause) {
                capturingRef.current = false
                setCountdown(null)
                setCameraReady(false)
                streamRef.current?.getTracks().forEach(track => track.stop())
                streamRef.current = null
                if (videoRef.current) videoRef.current.srcObject = null
                setError(cause instanceof Error ? cause.message : 'Unable to capture photos. Please retry.')
            }
        }, 1000)
        return () => window.clearTimeout(timer)
    }, [countdown, photos, photoCount])

    function startSession() {
        if (capturingRef.current || !cameraReady || error || complete) return
        capturingRef.current = true
        setPhotos([])
        setStripImage(null)
        setStripError('')
        setExporting(false)
        setCountdown(3)
    }
    function cancelCapture() {
        if (!capturingRef.current) return
        capturingRef.current = false
        setCountdown(null)
        setPhotos([])
        setStripImage(null)
        setStripError('')
        setExporting(false)
    }

    function resetSession() {
        setShowPrintPreview(false)
        capturingRef.current = false
        setCountdown(null)
        setPhotos([])
        setStripImage(null)
        setStripError('')
        setExporting(false)
        setError('')
        setCameraReady(false)
        setCameraAttempt(attempt => attempt + 1)
    }

    function retakePhotos() {
        if (window.confirm('Retake all four photos? Your current photos will be replaced.')) resetSession()
    }

    function returnHome() {
        if (!photos.length || window.confirm('Return to the homepage? Your photos will be discarded.')) onClose()
    }

    return (
        <div className="camera-booth min-h-screen bg-[#FFF5F8] px-4 py-6">
            <div className="mx-auto max-w-5xl">
                <header className="mb-6 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <FleuraLogo className="h-12 w-12 sm:h-14 sm:w-14" />
                        <div>
                            <h1 className="text-xl font-bold text-pink-600 sm:text-2xl">SnapBerry &#127827;</h1>
                            <p className="text-sm text-gray-500">by FLEURA</p>
                        </div>
                    </div>
                    <button type="button" onClick={returnHome} aria-label="Return to homepage"
                        className="shrink-0 rounded-full p-3 text-pink-600 hover:bg-pink-100"><X size={26} /></button>
                </header>
                <p role="status" aria-live="polite" className="mb-4 text-center font-semibold text-pink-600">
                    {complete ? 'All four photos are ready!' : countdown !== null
                        ? 'Taking Photo ' + (photos.length + 1) + ' of ' + photoCount
                        : error ? 'Camera needs attention' : cameraReady ? '' : 'Starting camera…'}
                </p>
                <div className="mx-auto max-w-2xl">
                    <div className={complete ? 'hidden' : 'md:sticky md:top-6'}>
                        <div className="relative overflow-hidden rounded-3xl bg-gray-900">
                            <video ref={videoRef} autoPlay playsInline muted controls={false} onLoadedData={() => setCameraReady(true)}
                                style={{ opacity: cameraReady ? 1 : 0 }}
                                className="camera-preview aspect-[3/4] max-h-[60svh] min-h-48 w-full object-cover scale-x-[-1]" />
                            {countdown !== null && <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <span aria-label={'Capturing in ' + countdown + ' seconds'} className="text-8xl font-bold text-white">{countdown}</span>
                            </div>}
                            {photos.length > 0 && <div key={cameraAttempt + ':' + photos.length} aria-hidden="true" className="camera-shutter pointer-events-none absolute inset-0 bg-white" />}
                        </div>
                        <button type="button" disabled={countdown !== null || photos.length > 0} onClick={() => setShowDesigner(true)} className="mx-auto mt-3 block min-h-11 rounded-full px-5 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-100 disabled:opacity-50">Design Strip</button>
                        <p className="mt-4 text-center text-sm text-gray-500">{photoCount} photos, with 3 seconds to pose before each one.</p>
                        <button type="button" onClick={startSession} disabled={countdown !== null || !cameraReady || !!error}
                            className="mx-auto mt-4 flex min-h-12 items-center gap-2 rounded-full bg-pink-600 px-8 py-4 font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
                            <Camera size={20} /> {countdown !== null ? 'Get Ready!' : 'Start Capture'}
                        </button>
                        {countdown !== null && <button type="button" onClick={cancelCapture}
                            className="mx-auto mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full border border-pink-300 px-8 py-3 font-semibold text-pink-600 hover:bg-pink-100">
                            <X size={18} /> Cancel Capture
                        </button>}
                    </div>
                </div>
                {error && <div className="mt-4 text-center">
                    <p role="alert" className="text-red-600">{error}</p>
                    <button type="button" onClick={resetSession} className="mt-3 min-h-12 rounded-full border border-pink-200 px-6 py-3 font-medium text-pink-600">Retry camera</button>
                </div>}
                <button type="button" onClick={returnHome} className="mx-auto mt-5 hidden min-h-12 rounded-full px-6 py-3 font-medium text-pink-600 hover:bg-pink-100 md:block">Return to homepage</button>
            </div>
            {showDesigner && <StripDesigner options={options} onChange={setOptions} onDone={() => setShowDesigner(false)} />}
            {complete && !showPrintPreview && <CompletedStripModal photos={photos} options={options} image={stripImage} ready={exportReady} error={stripError}
                onClose={returnHome} onRetake={retakePhotos} onPrint={() => { if (exportReady) setShowPrintPreview(true) }}
                onRetry={() => { setStripError(''); setExporting(true); setExportAttempt(attempt => attempt + 1) }} />}
            {complete && showPrintPreview && stripImage && <PrintPreview image={stripImage} onBack={() => setShowPrintPreview(false)} />}
        </div>
    )
}




