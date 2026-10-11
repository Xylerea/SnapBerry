import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type PairedPrinter = { name: string; address: string }
export type PrinterInfo = { connected: boolean; confirmed: boolean; name?: string; message?: string }
export const BluetoothPrinter = registerPlugin<{
    pairedPrinters(): Promise<{ devices: PairedPrinter[] }>
    connect(options: { address: string }): Promise<PrinterInfo>
    disconnect(): Promise<void>
    status(): Promise<PrinterInfo>
    send(options: { job: string; test: boolean }): Promise<void>
    confirmTest(): Promise<PrinterInfo>
    addListener(event: 'printerStatus', callback: (info: PrinterInfo) => void): Promise<PluginListenerHandle>
    addListener(event: 'printerProgress', callback: (info: { sent: number; total: number }) => void): Promise<PluginListenerHandle>
}>('SnapBerryBluetooth')
