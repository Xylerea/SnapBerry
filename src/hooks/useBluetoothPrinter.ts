import { useEffect, useRef, useState } from 'react'
import { BluetoothPrinter, type PairedPrinter, type PrinterInfo } from '../lib/bluetoothPrinter'
import { isAndroidApp } from '../lib/native'
import { yhkStripJob, yhkTestJob } from '../lib/yhkRaster'
import type { PluginListenerHandle } from '@capacitor/core'
import type { PaperWidth } from '../lib/thermalPrint'

export function useBluetoothPrinter() {
    const mounted = useRef(false), busyRef = useRef(false)
    const infoRef = useRef<PrinterInfo>({ connected: false, confirmed: false })
    const [info, setInfo] = useState<PrinterInfo>({ connected: false, confirmed: false })
    const [devices, setDevices] = useState<PairedPrinter[]>([])
    const [busy, setBusy] = useState(false), [connecting, setConnecting] = useState(false)
    const [testSent, setTestSent] = useState(false), [failed, setFailed] = useState(false)
    const [message, setMessage] = useState('')
    const [progress, setProgress] = useState<number | null>(null)
    function update(next: PrinterInfo) {
        infoRef.current = next
        if (mounted.current) { setInfo(next); if (next.message) setMessage(next.message); if (!next.connected) setTestSent(false) }
    }
    function report(error: unknown) {
        if (mounted.current) { setMessage(error instanceof Error ? error.message : 'Printer connection failed. Check Bluetooth and retry.'); setFailed(true) }
    }
    useEffect(() => {
        mounted.current = true
        if (!isAndroidApp()) return () => { mounted.current = false }
        let cancelled = false, events = 0
        const handles: PluginListenerHandle[] = []
        function keep(promise: Promise<PluginListenerHandle>) {
            void promise.then(handle => { if (cancelled) void handle.remove(); else handles.push(handle) }).catch(() => {})
        }
        keep(BluetoothPrinter.addListener('printerStatus', next => {
            events++; infoRef.current = next
            if (!cancelled) { setInfo(next); if (next.message) setMessage(next.message); if (!next.connected) setTestSent(false) }
        }))
        keep(BluetoothPrinter.addListener('printerProgress', next => { if (!cancelled) setProgress(Math.round(next.sent / next.total * 100)) }))
        void BluetoothPrinter.status().then(next => { if (!cancelled && events === 0) { infoRef.current = next; setInfo(next) } }).catch(() => {})
        return () => {
            cancelled = true; mounted.current = false
            handles.forEach(handle => { void handle.remove() })
            void BluetoothPrinter.disconnect().catch(() => {})
        }
    }, [])
    async function connect(address?: string): Promise<PrinterInfo | null> {
        if (busyRef.current) return null
        busyRef.current = true; setBusy(true); setConnecting(true); setFailed(false); setMessage('Connecting to your printer…')
        try {
            const result = await BluetoothPrinter.pairedPrinters()
            if (!mounted.current) return null
            setDevices(result.devices)
            if (!result.devices.length) throw new Error('No paired YHK printer found. Pair YHK-1D08 in Android Bluetooth Settings, then retry.')
            if (!address && result.devices.length > 1) { setMessage('Choose your printer below.'); return null }
            const next = await BluetoothPrinter.connect({ address: address ?? result.devices[0].address })
            if (!mounted.current) return null
            update(next); setDevices([]); setTestSent(false); return next
        } catch (error) { report(error); return null }
        finally { busyRef.current = false; if (mounted.current) { setBusy(false); setConnecting(false) } }
    }
    async function disconnect() {
        try { await BluetoothPrinter.disconnect(); update({ connected: false, confirmed: false, message: 'Printer disconnected.' }) }
        catch (error) { report(error) }
    }
    async function test() {
        if (busyRef.current || !infoRef.current.connected) return
        busyRef.current = true; setBusy(true); setProgress(0); setFailed(false); setTestSent(false); setMessage('Sending a small test image…')
        try {
            await BluetoothPrinter.send({ job: yhkTestJob(), test: true })
            if (mounted.current) { setTestSent(true); setMessage('Test data sent. Did “SnapBerry TEST” and the rectangle print clearly?') }
        } catch (error) { report(error) }
        finally { busyRef.current = false; if (mounted.current) { setBusy(false); setProgress(null) } }
    }
    async function confirm() {
        if (busyRef.current) return
        busyRef.current = true; setBusy(true)
        try { update(await BluetoothPrinter.confirmTest()); if (mounted.current) setTestSent(false) }
        catch (error) { report(error) }
        finally { busyRef.current = false; if (mounted.current) setBusy(false) }
    }
    async function print(image: string, paperWidth: PaperWidth, onStart: () => void) {
        if (paperWidth === 80) { setMessage('Your YHK printer uses narrow paper. Choose C15 or 58mm for Bluetooth printing.'); return }
        const next = infoRef.current.connected ? infoRef.current : await connect()
        if (!next || !mounted.current) return
        if (!next.confirmed) { setMessage('Before the first photo strip, tap Print Test and confirm that it printed clearly.'); return }
        if (busyRef.current) return
        busyRef.current = true; setBusy(true); setFailed(false); setProgress(0); setMessage('Preparing your photo strip…')
        try {
            const job = await yhkStripJob(image)
            if (!mounted.current) return
            onStart(); setMessage('Sending your photo strip to the printer…')
            await BluetoothPrinter.send({ job, test: false })
            if (mounted.current) setMessage('Strip sent.')
        } catch (error) { report(error) }
        finally { busyRef.current = false; if (mounted.current) { setBusy(false); setProgress(null) } }
    }
    return { info, devices, busy, testSent, failed, message, progress, connect, disconnect, test, confirm, print,
        status: connecting ? 'Connecting' : info.connected ? 'Connected' : failed ? 'Failed' : 'Not Connected' }
}
