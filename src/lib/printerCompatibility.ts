export type PrinterStatus = 'Not Connected' | 'Connecting' | 'Connected' | 'Failed'

export function printerSetupMessage(secureContext: boolean, bluetoothAvailable: boolean): string {
    if (!secureContext) return 'Bluetooth needs a secure connection. Open SnapBerry using HTTPS. You can still use Print Now.'
    if (!bluetoothAvailable) return 'This browser does not support Web Bluetooth. You can still use Print Now.'
    return 'Your BT Instant / WalkPrint printer needs its exact model and verified Bluetooth protocol before connecting. You can still use Print Now or download your strip for WalkPrint.'
}
