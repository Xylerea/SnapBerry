import StripDesigner from './StripDesigner'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Camera, X } from 'lucide-react'
import { useShutterSound } from '../hooks/useShutterSound'
import { isAndroidApp, SnapBerryNative } from '../lib/native'
import FleuraLogo from './FleuraLogo'
import CompletedStripModal from './CompletedStripModal'
import ExitSessionDialog from './ExitSessionDialog'
import PrintPreview from './PrintPreview'
import { generateWebsiteClassicSheet, generatePhotoStrip, layoutForOptions, websiteLayoutForOptions, photoFrames, type StripOptions } from '../lib/photoStrip'
import './CameraBooth.css'

type CameraBoothProps = { onClose: () => void; onExitToLayouts?: () => void; initialLayout?: StripOptions['layout']; initialOptions?: StripOptions }

export default function CameraBooth({ onClose, onExitToLayouts, initialLayout, initialOptions }: CameraBoothProps) {
    const { prepare: prepareShutter, beep: countdownBeep, play: playShutter, stop: stopSounds } = useShutterSound(!isAndroidApp())
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const capturingRef = useRef(false)
    const exitDestinationRef = useRef<(() => void) | null>(null)
    const [showExitDialog, setShowExitDialog] = useState(false)
    const [photos, setPhotos] = useState<string[]>([])
    const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
    const selectedPhotoRef = useRef<number | null>(null)
    const pressRef = useRef<{ timer: number; pointerId: number; x: number; y: number } | null>(null)
    const lastPointerType = useRef('mouse')
    const photoSlotsRef = useRef<HTMLOListElement>(null)
    function clearPress() {
        if (pressRef.current) window.clearTimeout(pressRef.current.timer)
        pressRef.current = null
    }
    function selectPhoto(index: number | null) {
        selectedPhotoRef.current = index
        setSelectedPhoto(index)
    }
    useEffect(() => {
        function dismiss(event: PointerEvent) {
            if (!photoSlotsRef.current?.contains(event.target as Node)) selectPhoto(null)
        }
        window.addEventListener('pointerdown', dismiss)
        return () => { window.removeEventListener('pointerdown', dismiss); clearPress() }
    }, [])
    const [countdown, setCountdown] = useState<number | null>(null)
    const [cameraReady, setCameraReady] = useState(false)
    const [cameraAttempt, setCameraAttempt] = useState(0)
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
    const [error, setError] = useState('')
    const [options, setOptions] = useState<StripOptions>({ monochrome: false, frameColor: 'White', caption: '', date: '', ...(!isAndroidApp() && initialLayout ? { layout: initialLayout } : {}), ...(!isAndroidApp() ? initialOptions : {}) })
    const photoCount = options.layout === 'landscape' && !isAndroidApp() ? 3 : 4
    const frameRatio = 3 / 4
    const slotLayout = isAndroidApp() ? layoutForOptions(options) : websiteLayoutForOptions(options)
    const slotFrame = photoFrames(slotLayout)[0]
    const slotRatio = slotFrame.width / slotFrame.height
    const [stripImage, setStripImage] = useState<string | null>(null)
    const [stripError, setStripError] = useState('')
    const [exporting, setExporting] = useState(false)
    const [exportAttempt, setExportAttempt] = useState(0)
    const [showDesigner, setShowDesigner] = useState(false)
    const [showPrintPreview, setShowPrintPreview] = useState(false)
    const complete = photos.length === photoCount
    // Every website layout shares the Landscape Postcard camera stage.
    // Only the shot count and final print composition depend on the layout.
    const fullscreenCapture = !isAndroidApp()
    // The rendered result is tied to its source/settings, preventing stale downloads.
    const [renderedSettings, setRenderedSettings] = useState('')
    const settingsKey = JSON.stringify(options)
    const exportReady = complete && !exporting && !!stripImage && renderedSettings === settingsKey

    useEffect(() => {
        const viewport = window.matchMedia('(orientation: landscape)')
        const screenOrientation = window.screen?.orientation
        // Use viewport geometry for layout (including split-screen tablets).
        // Screen and legacy events also cover browsers that delay viewport updates.
        const update = () => setOrientation(viewport.matches ? 'landscape' : 'portrait')
        update()
        viewport.addEventListener('change', update)
        screenOrientation?.addEventListener('change', update)
        window.addEventListener('orientationchange', update)
        window.addEventListener('resize', update)
        return () => {
            viewport.removeEventListener('change', update)
            screenOrientation?.removeEventListener('change', update)
            window.removeEventListener('orientationchange', update)
            window.removeEventListener('resize', update)
        }
    }, [])

    const requestExit = useCallback((navigate: () => void) => {
        if (exitDestinationRef.current) return
        exitDestinationRef.current = navigate
        stopSounds()
        setShowExitDialog(true)
    }, [stopSounds])

    const keepTakingPhotos = useCallback(() => {
        exitDestinationRef.current = null
        setShowExitDialog(false)
    }, [])

    useEffect(() => {
        function back(event: Event) {
            event.preventDefault()
            if (showExitDialog) keepTakingPhotos()
            else if (showDesigner) setShowDesigner(false)
            else if (showPrintPreview) setShowPrintPreview(false)
            else requestExit(onClose)
        }
        window.addEventListener('snapberry:back', back)
        return () => window.removeEventListener('snapberry:back', back)
    }, [showDesigner, showPrintPreview, showExitDialog, keepTakingPhotos, requestExit, onClose])

    useEffect(() => {
        if (photos.length !== photoCount) return
        let cancelled = false
        const timer = window.setTimeout(() => {
            setExporting(true)
            setStripError('')
            const settings = JSON.parse(settingsKey) as StripOptions
            const generate = !isAndroidApp() && (!settings.layout || settings.layout === 'classic')
                ? generateWebsiteClassicSheet(photos, settings)
                : generatePhotoStrip(photos, settings, isAndroidApp() ? undefined : websiteLayoutForOptions(settings))
            void generate.then(result => {
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
        if (countdown === null || showExitDialog) return
        const timer = window.setTimeout(() => {
            if (!capturingRef.current || exitDestinationRef.current) return
            if (countdown > 1) {
                countdownBeep()
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
                const bounds = video.getBoundingClientRect()
                if (!bounds.width || !bounds.height) throw new Error('Camera preview is not visible. Please retry.')
                // The preview uses centered object-fit: cover, including after rotation.
                const scale = Math.max(bounds.width / video.videoWidth, bounds.height / video.videoHeight)
                const sourceWidth = bounds.width / scale
                const sourceHeight = bounds.height / scale
                canvas.width = Math.round(sourceWidth)
                canvas.height = Math.round(sourceHeight)
                const context = canvas.getContext('2d')
                if (!context) throw new Error('Unable to capture a photo. Please retry the session.')
                context.translate(canvas.width, 0)
                context.scale(-1, 1)
                context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2,
                    sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
                const nextPhotos = [...photos, canvas.toDataURL('image/png')]
                setPhotos(nextPhotos)
                playShutter()
                if (nextPhotos.length === photoCount) {
                    capturingRef.current = false
                    setCountdown(null)
                    setCameraReady(false)
                    streamRef.current?.getTracks().forEach(track => track.stop())
                    streamRef.current = null
                    video.srcObject = null
                } else {
                    setCountdown(3)
                    countdownBeep()
                }
            } catch (cause) {
                stopSounds()
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
    }, [countdown, photos, photoCount, playShutter, countdownBeep, stopSounds, showExitDialog])

    function startSession() {
        if (exitDestinationRef.current || capturingRef.current || !cameraReady || error || complete) return
        prepareShutter()
        selectPhoto(null)
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
        clearPress()
        selectPhoto(null)
        stopSounds()
        setCountdown(null)
        setPhotos([])
        setStripImage(null)
        setStripError('')
        setExporting(false)
    }

    function resetSession() {
        stopSounds()
        clearPress()
        selectPhoto(null)
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
        if (!isAndroidApp() || window.confirm(`Retake all ${photoCount} photos? Your current photos will be replaced.`)) resetSession()
    }

    function returnHome() {
        requestExit(onClose)
    }

    function exitPhotoSession() {
        requestExit(onExitToLayouts ?? onClose)
    }

    function confirmExitSession() {
        const navigate = exitDestinationRef.current
        if (!navigate) return
        capturingRef.current = false
        exitDestinationRef.current = null
        setShowExitDialog(false)
        setCountdown(null)
        stopSounds()
        setPhotos([])
        setStripImage(null)
        setStripError('')
        setExporting(false)
        setCameraReady(false)
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        navigate()
    }

    const photoSlots = (countdown !== null || photos.length > 0) && <ol aria-label="Captured photos"
        ref={photoSlotsRef}
        className={fullscreenCapture ? 'landscape-photo-slots' : 'camera-photo-slots'}
        style={{ '--photo-slot-ratio': slotRatio, '--photo-slot-count': photoCount } as CSSProperties}>
        {Array.from({ length: photoCount }, (_, index) => <li key={index}
            aria-label={`Photo ${index + 1}: ${photos[index] ? 'captured' : 'empty'}`}
            className={photos[index] ? 'is-captured' : 'is-empty'}
            onContextMenu={event => { if (photos[index]) event.preventDefault() }}
            onDoubleClick={event => { if (photos[index] && lastPointerType.current === 'mouse' && event.detail === 2) { event.preventDefault(); selectPhoto(index) } }}
            onPointerDown={event => {
                lastPointerType.current = event.pointerType
                if (!(event.target as HTMLElement).closest('button')) selectPhoto(null)
                if (!photos[index] || (event.target as HTMLElement).closest('button') || event.pointerType === 'mouse') return
                clearPress()
                const { pointerId, clientX: x, clientY: y } = event
                const timer = window.setTimeout(() => { pressRef.current = null; selectPhoto(index) }, 600)
                pressRef.current = { timer, pointerId, x, y }
            }}
            onPointerMove={event => { const press = pressRef.current; if (press && press.pointerId === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) clearPress() }}
            onPointerUp={clearPress} onPointerCancel={clearPress} onPointerLeave={clearPress}>
            {photos[index] ? <img src={photos[index]} alt={`Captured photo ${index + 1}`}
                draggable={false} style={{ filter: options.monochrome ? 'grayscale(1)' : undefined }} />
                : <span aria-hidden="true">{index + 1}</span>}
            {photos[index] && selectedPhoto === index && <button type="button" className="photo-delete" aria-label={`Delete photo ${index + 1}`}
                onClick={event => {
                    event.stopPropagation()
                    if (selectedPhotoRef.current !== index) return
                    selectPhoto(null)
                    setPhotos(current => current.filter((_, i) => i !== index))
                }}>Delete</button>}
        </li>)}
    </ol>

    const captureControls = <div className="camera-capture-controls contents">
        <button type="button" onClick={startSession} disabled={countdown !== null || !cameraReady || !!error}
            className="mx-auto mt-4 flex min-h-12 items-center gap-2 rounded-full bg-pink-600 px-8 py-4 font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
            <Camera size={20} /> {countdown !== null ? 'Get Ready!' : 'Start Capture'}
        </button>
        {countdown !== null && <button type="button" onClick={cancelCapture}
            className="mx-auto mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full border border-pink-300 px-8 py-3 font-semibold text-pink-600 hover:bg-pink-100">
            <X size={18} /> Cancel Capture
        </button>}
    </div>

    return (
        <div data-orientation={orientation} className={`camera-booth min-h-screen bg-[#FFF5F8] px-4 py-6 ${!isAndroidApp() ? 'website-camera' : 'native-camera'} ${!complete ? 'is-capturing' : ''} ${fullscreenCapture && !complete ? 'landscape-capture' : ''}`}>
            <div className="mx-auto max-w-5xl">
                <header className="mb-6 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <FleuraLogo className="h-12 w-12 sm:h-14 sm:w-14" />
                        <div>
                            <h1 className="text-xl font-bold text-pink-600 sm:text-2xl">SnapBerry &#127827;</h1>
                            <p className="text-sm text-gray-500">by FLEURA</p>
                        </div>
                    </div>
                    <button type="button" onClick={isAndroidApp() ? returnHome : exitPhotoSession} aria-label={isAndroidApp() ? 'Return to homepage' : 'Return to photo layout selection'}
                        className="shrink-0 rounded-full p-3 text-pink-600 hover:bg-pink-100"><X size={26} /></button>
                </header>
                <div className="camera-content">
                <p role="status" aria-live="polite" className={fullscreenCapture || (!isAndroidApp() && (countdown !== null || complete)) ? 'sr-only' : 'mb-4 text-center font-semibold text-pink-600'}>
                    {complete ? `All ${photoCount} photos are ready!` : countdown !== null
                        ? 'Taking Photo ' + (photos.length + 1) + ' of ' + photoCount
                        : error ? 'Camera needs attention' : cameraReady ? '' : 'Starting camera…'}
                </p>
                {fullscreenCapture ? <div className={`landscape-capture-stage ${complete ? 'hidden' : ''}`} style={{ '--preview-ratio': slotRatio } as CSSProperties}>
                    <video ref={videoRef} autoPlay playsInline muted controls={false} onLoadedData={() => setCameraReady(true)}
                        aria-label="Live camera preview" style={{ opacity: cameraReady ? 1 : 0 }}
                        className="landscape-live-video camera-preview" />
                    {!cameraReady && !error && <p className="landscape-camera-loading">Starting camera…</p>}
                    {countdown !== null && <div className="landscape-countdown">
                        <span aria-label={'Capturing in ' + countdown + ' seconds'}>{countdown}</span>
                    </div>}
                    {photos.length > 0 && <div key={cameraAttempt + ':' + photos.length} aria-hidden="true" className="camera-shutter pointer-events-none absolute inset-0 bg-white" />}
                    {countdown === null && photos.length === 0 && <div className="landscape-capture-bottom">
                        <button type="button" onClick={startSession} disabled={!cameraReady || !!error} aria-label={`Start ${photoCount}-photo capture`}
                            className="landscape-start rounded-full bg-pink-600 font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
                            <Camera size={28} aria-hidden="true" /><span className="sr-only">Start</span>
                        </button>
                    </div>}
                    {photoSlots}
                </div> : <div className={!isAndroidApp() && !complete ? `mx-auto grid max-w-5xl items-start gap-4 ${options.layout !== 'classic' && options.layout ? 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'}` : 'mx-auto max-w-2xl'}>
                    <div className={complete ? 'hidden' : 'camera-session-panel md:sticky md:top-6'}>
                        <div className="camera-live-frame relative overflow-hidden rounded-3xl bg-gray-900"
                            data-camera-layout={options.layout ?? 'classic'}
                            style={{ '--desktop-slot-ratio': slotRatio, '--preview-ratio': slotRatio, ...(!isAndroidApp() ? { width: `min(100%, calc(var(--camera-panel-height) * ${frameRatio}))` } : {}) } as CSSProperties}>
                            <video ref={videoRef} autoPlay playsInline muted controls={false} onLoadedData={() => setCameraReady(true)}
                                style={{ opacity: cameraReady ? 1 : 0, aspectRatio: slotRatio, objectPosition: 'center' }}
                                className="camera-preview aspect-[3/4] max-h-[60svh] min-h-48 w-full object-cover scale-x-[-1]" />
                            {countdown !== null && <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <span aria-label={'Capturing in ' + countdown + ' seconds'} className="text-8xl font-bold text-white">{countdown}</span>
                            </div>}
                            {photos.length > 0 && <div key={cameraAttempt + ':' + photos.length} aria-hidden="true" className="camera-shutter pointer-events-none absolute inset-0 bg-white" />}
                            {photoSlots}
                        </div>
                        {isAndroidApp() && <div className="mt-3 flex justify-center gap-2" aria-label="Photo layout">
                            {((isAndroidApp() ? ['classic', 'postcard'] : ['classic', 'postcard', 'landscape']) as StripOptions['layout'][]).map(layout => <button key={layout} type="button" disabled={countdown !== null || photos.length > 0} aria-pressed={(options.layout ?? 'classic') === layout}
                                onClick={() => setOptions({ ...options, layout })} className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${(options.layout ?? 'classic') === layout ? 'bg-pink-600 text-white' : 'text-pink-600'}`}>
                                {layout === 'classic' ? 'Classic Vertical' : layout === 'postcard' ? '2×2 Postcard' : '3-Photo 4R Landscape'}
                            </button>)}
                        </div>}
                        {isAndroidApp() && <button type="button" disabled={countdown !== null || photos.length > 0} onClick={() => setShowDesigner(true)} className="mx-auto mt-3 block min-h-11 rounded-full px-5 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-100 disabled:opacity-50">Design Strip</button>}
                        {isAndroidApp() && <p className="mt-4 text-center text-sm text-gray-500">{photoCount} photos, with 3 seconds to pose before each one.</p>}
                        {captureControls}
                    </div>
                </div>}
                </div>
                {error && <div className={`mt-4 text-center ${fullscreenCapture ? 'landscape-camera-error' : ''}`}>
                    <p role="alert" className="text-red-600">{error}</p>
                    <button type="button" onClick={resetSession} className="mt-3 min-h-12 rounded-full border border-pink-200 px-6 py-3 font-medium text-pink-600">Retry camera</button>
                </div>}
                {isAndroidApp() && <button type="button" onClick={returnHome} className="mx-auto mt-5 hidden min-h-12 rounded-full px-6 py-3 font-medium text-pink-600 hover:bg-pink-100 md:block">Return to homepage</button>}
            </div>
            {showDesigner && <StripDesigner photos={photos} options={options} onChange={next => setOptions(photos.length ? { ...next, layout: options.layout } : next)} onDone={() => setShowDesigner(false)} />}
            {complete && !showPrintPreview && !showDesigner && <CompletedStripModal photos={photos} options={options} image={stripImage} ready={exportReady} error={stripError}
                onDesign={!isAndroidApp() ? () => setShowDesigner(true) : undefined} onClose={returnHome} onRetake={retakePhotos} onPrint={() => { if (exportReady) setShowPrintPreview(true) }}
                onRetry={() => { setStripError(''); setExporting(true); setExportAttempt(attempt => attempt + 1) }} />}
            {complete && showPrintPreview && stripImage && <PrintPreview layout={options.layout} paperSize={options.paperSize} image={stripImage} onBack={() => setShowPrintPreview(false)} />}
            {showExitDialog && <ExitSessionDialog onKeep={keepTakingPhotos} onExit={confirmExitSession} />}
        </div>
    )
}






