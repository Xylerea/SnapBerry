import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { isAndroidApp } from '../lib/native'

export function useAndroidBack(onBack: () => void) {
    const callback = useRef(onBack)
    useEffect(() => { callback.current = onBack }, [onBack])
    useEffect(() => {
        if (!isAndroidApp()) return
        let cancelled = false
        let handle: PluginListenerHandle | null = null
        void App.addListener('backButton', () => callback.current()).then(listener => {
            if (cancelled) void listener.remove()
            else handle = listener
        })
        return () => { cancelled = true; if (handle) void handle.remove() }
    }, [])
}
