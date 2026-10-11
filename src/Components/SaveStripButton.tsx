import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { isAndroidApp, saveStrip } from '../lib/native'

export default function SaveStripButton({ image, ready }: { image: string | null; ready: boolean }) {
    const busy = useRef(false)
    const mounted = useRef(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
    async function save() {
        if (!image || !ready || busy.current) return
        busy.current = true
        setSaving(true)
        setMessage('')
        try {
            const result = await saveStrip(image)
            if (mounted.current) setMessage(result)
        } catch {
            if (mounted.current) setMessage('Could not save your strip. Please try again and check your available storage.')
        } finally {
            busy.current = false
            if (mounted.current) setSaving(false)
        }
    }
    return <div className="col-span-2">
        <button type="button" disabled={!ready || !image || saving} onClick={() => void save()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-pink-600 px-3 py-3 font-semibold text-white hover:bg-pink-700 disabled:opacity-50">
            <Download size={18} /> {saving ? 'Saving…' : isAndroidApp() ? 'Save to Gallery' : 'Download'}
        </button>
        {message && <p role="status" className="mt-2 text-center text-sm text-gray-600">{message}</p>}
    </div>
}
