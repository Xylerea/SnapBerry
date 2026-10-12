import { useCallback, useEffect, useRef } from 'react'

export function useShutterSound(active: boolean) {
    const contextRef = useRef<AudioContext | null>(null)
    const buffers = useRef<Partial<Record<'beep' | 'shutter', AudioBuffer>>>({})
    const sources = useRef(new Set<AudioBufferSourceNode>())
    const nextSoundAt = useRef(0)
    const version = useRef(0)

    useEffect(() => {
        if (!active) return
        let cancelled = false
        const activeSources = sources.current
        try {
            const context = new AudioContext()
            contextRef.current = context
            for (const name of ['beep', 'shutter'] as const) {
                void fetch(`${import.meta.env.BASE_URL}sounds/${name}.wav`)
                    .then(response => { if (!response.ok) throw new Error(); return response.arrayBuffer() })
                    .then(data => context.decodeAudioData(data))
                    .then(buffer => { if (!cancelled) buffers.current[name] = buffer })
                    .catch(() => { /* Audio is optional; capture continues. */ })
            }
            return () => {
                cancelled = true
                for (const source of activeSources) { try { source.stop() } catch { /* Already ended. */ } }
                activeSources.clear(); buffers.current = {}; contextRef.current = null
                void context.close().catch(() => {})
            }
        } catch { /* Unsupported or restricted audio never blocks the camera. */ }
    }, [active])

    const sound = useCallback((name: 'beep' | 'shutter') => {
        ++version.current
        const context = contextRef.current, buffer = buffers.current[name]
        if (!context || context.state !== 'running' || !buffer) return
        try {
            const source = context.createBufferSource(), gain = context.createGain()
            source.buffer = buffer; gain.gain.value = 0.55
            source.connect(gain); gain.connect(context.destination)
            const start = Math.max(context.currentTime, nextSoundAt.current)
            sources.current.add(source)
            source.onended = () => { sources.current.delete(source); source.disconnect(); gain.disconnect() }
            source.start(start); nextSoundAt.current = start + buffer.duration
        } catch { /* Playback failures do not affect photo capture. */ }
    }, [])
    const beep = useCallback(() => sound('beep'), [sound])
    const play = useCallback(() => sound('shutter'), [sound])
    const stop = useCallback(() => {
        ++version.current; nextSoundAt.current = 0
        for (const source of sources.current) { try { source.stop() } catch { /* Already ended. */ } }
        sources.current.clear()
    }, [])
    const prepare = useCallback(() => {
        const context = contextRef.current
        if (!context) return
        const attempt = ++version.current
        try {
            void context.resume().then(() => {
                if (contextRef.current === context && version.current === attempt) beep()
            }).catch(() => {})
        } catch { /* Browser restrictions are handled silently. */ }
    }, [beep])
    return { prepare, beep, play, stop }
}
