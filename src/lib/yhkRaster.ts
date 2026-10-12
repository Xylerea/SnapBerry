import { drawFleuraQr } from './fleuraQr'
import { STRIP_LAYOUT } from './photoStrip'

// Driver for a publicly tested YHK variant; our device protocol still requires a physical test.
// https://www.joshmcarthur.com/case-studies/yhk-mini-printer/
export const YHK_WIDTH = 384

export function encodeYhkRaster(pixels: Uint8ClampedArray, height: number): Uint8Array {
    if (!Number.isInteger(height) || height < 1 || height > 5000 || pixels.length !== YHK_WIDTH * height * 4) throw new Error('Invalid printer image.')
    const rowBytes = YHK_WIDTH / 8
    const job = new Uint8Array(10 + rowBytes * height + 6)
    job.set([0x1b, 0x40, 0x1d, 0x76, 0x30, 0, rowBytes, 0, height & 255, height >> 8])
    let errors = new Float32Array(YHK_WIDTH + 2)
    for (let y = 0; y < height; y++) {
        const next = new Float32Array(YHK_WIDTH + 2)
        for (let x = 0; x < YHK_WIDTH; x++) {
            const i = (y * YHK_WIDTH + x) * 4
            const alpha = pixels[i + 3] / 255
            const raw = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) * alpha + 255 * (1 - alpha)
            // Pure QR modules/white quiet zones stay pure; diffuse midtone photo pixels.
            const value = raw <= 1 ? 0 : raw >= 254 ? 255 : Math.max(0, Math.min(255, raw + errors[x + 1]))
            const black = value < 128
            if (black) job[10 + y * rowBytes + (x >> 3)] |= 1 << (7 - (x & 7))
            const difference = raw <= 1 || raw >= 254 ? 0 : value - (black ? 0 : 255)
            errors[x + 2] += difference * 7 / 16
            next[x] += difference * 3 / 16
            next[x + 1] += difference * 5 / 16
            next[x + 2] += difference / 16
        }
        errors = next
    }
    job.set([0x1b, 0x64, 4, 10, 10, 10], job.length - 6)
    return job
}

function base64(bytes: Uint8Array) {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 4096) binary += String.fromCharCode(...bytes.subarray(i, i + 4096))
    return btoa(binary)
}

export async function yhkStripJob(source: string) {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = YHK_WIDTH
    canvas.height = Math.round(image.naturalHeight * YHK_WIDTH / image.naturalWidth)
    if (canvas.height < 1 || canvas.height > 5000) throw new Error('Photo strip is too long for this printer.')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare the printer image.')
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    // Re-render the same local QR at whole printer dots rather than blurring scaled modules.
    const scale = YHK_WIDTH / STRIP_LAYOUT.width
    const footerTop = image.naturalHeight - STRIP_LAYOUT.border - STRIP_LAYOUT.qrFooterHeight
    const qrTop = Math.round((footerTop + STRIP_LAYOUT.width * 0.02) * scale)
    const qrSize = Math.ceil(YHK_WIDTH * 0.56)
    context.fillStyle = 'white'
    context.fillRect(Math.floor((YHK_WIDTH - qrSize) / 2), qrTop, qrSize, qrSize)
    drawFleuraQr(context, YHK_WIDTH / 2, qrTop, qrSize)
    return base64(encodeYhkRaster(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.height))
}

// Known 48x48 black square, independent of canvas, fonts, and photo decoding.
export function yhkTestJob() {
    const height = 64
    const pixels = new Uint8ClampedArray(YHK_WIDTH * height * 4).fill(255)
    for (let y = 8; y < 56; y++) {
        for (let x = 168; x < 216; x++) {
            const i = (y * YHK_WIDTH + x) * 4
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0
        }
    }
    return base64(encodeYhkRaster(pixels, height))
}
