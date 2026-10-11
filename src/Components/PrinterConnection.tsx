import { Bluetooth } from 'lucide-react'
import { isAndroidApp } from '../lib/native'
import type { useBluetoothPrinter } from '../hooks/useBluetoothPrinter'

type Props = { printer: ReturnType<typeof useBluetoothPrinter>; processing: boolean }
const button = 'min-h-12 rounded-xl border border-pink-200 px-3 py-3 text-sm font-semibold text-pink-600 disabled:opacity-50'

export default function PrinterConnection({ printer, processing }: Props) {
    if (!isAndroidApp()) return <section className="rounded-2xl border border-pink-200 bg-white p-3">
        <h3 className="flex items-center gap-2 font-semibold text-pink-600"><Bluetooth size={18} /> Bluetooth Printer</h3>
        <p className="mt-2 text-sm text-gray-600">Direct YHK printing is available in the SnapBerry Android app. Browser printing remains available here.</p>
    </section>
    const busy = printer.busy || processing
    return <section aria-labelledby="printer-heading" className="rounded-2xl border border-pink-200 bg-white p-3">
        <h3 id="printer-heading" className="flex items-center gap-2 font-semibold text-pink-600"><Bluetooth size={18} /> YHK Bluetooth Printer</h3>
        <p role="status" aria-live="polite" className="mt-2 text-sm font-semibold text-gray-700">{printer.status}{printer.info.connected && printer.info.name ? ` — ${printer.info.name}` : ''}</p>
        {printer.message && <p role={printer.failed ? 'alert' : 'status'} className="mt-1 text-sm text-gray-600">{printer.message}</p>}
        {printer.progress !== null && <div className="mt-2"><progress className="w-full accent-pink-600" max={100} value={printer.progress} aria-label="Bluetooth transfer progress" /><p className="text-center text-xs text-gray-500">Sending: {printer.progress}%</p></div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy || printer.info.connected} onClick={() => void printer.connect()} className={`${button} bg-pink-600 text-white`}>Connect Printer</button>
            <button type="button" disabled={!printer.info.connected} onClick={() => void printer.disconnect()} className={button}>{printer.busy ? 'Cancel / Disconnect' : 'Disconnect'}</button>
        </div>
        {printer.devices.length > 1 && !printer.info.connected && <div className="mt-2 grid gap-2">{printer.devices.map(device => <button key={device.address} type="button" disabled={busy} onClick={() => void printer.connect(device.address)} className={button}>{device.name}</button>)}</div>}
        {printer.info.connected && <button type="button" disabled={busy} onClick={() => void printer.test()} className={`${button} mt-2 w-full`}>Print Test</button>}
        {printer.testSent && !busy && <div className="mt-2 grid gap-2">
            <button type="button" onClick={() => void printer.confirm()} className={`${button} bg-pink-600 text-white`}>Yes, test printed clearly</button>
            <button type="button" onClick={() => void printer.disconnect()} className={button}>No, disconnect and retry</button>
        </div>}
    </section>
}
