import QRCode from 'qrcode'

export const FLEURA_FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61570602811270'
export const FLEURA_QR_CAPTION = 'Scan to follow FLEURA & get your photos!'
export const QR_QUIET_ZONE = 4
export const FLEURA_QR = QRCode.create(FLEURA_FACEBOOK_URL, { errorCorrectionLevel: 'M' }).modules

// The same matrix powers the on-screen SVG and exported canvas; no remote QR service.
const size = FLEURA_QR.size + QR_QUIET_ZONE * 2
const paths: string[] = []
for (let row = 0; row < FLEURA_QR.size; row++) {
    for (let column = 0; column < FLEURA_QR.size; column++) {
        if (FLEURA_QR.get(row, column)) paths.push(`M${column + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`)
    }
}
export const FLEURA_QR_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${paths.join('')}" fill="black"/></svg>`,
)}`

export function drawFleuraQr(context: CanvasRenderingContext2D, centerX: number, y: number, maxSize: number) {
    // Integer pixels per module keep the QR crisp, including its four-module quiet zone.
    const scale = Math.max(1, Math.floor(maxSize / size))
    const pixels = size * scale
    const x = Math.round(centerX - pixels / 2)
    context.fillStyle = '#ffffff'
    context.fillRect(x, y, pixels, pixels)
    context.fillStyle = '#000000'
    for (let row = 0; row < FLEURA_QR.size; row++) {
        for (let column = 0; column < FLEURA_QR.size; column++) {
            if (FLEURA_QR.get(row, column)) {
                context.fillRect(x + (column + QR_QUIET_ZONE) * scale, y + (row + QR_QUIET_ZONE) * scale, scale, scale)
            }
        }
    }
    return pixels
}
