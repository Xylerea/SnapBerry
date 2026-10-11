import { STRIP_LAYOUT, stripHeight } from './photoStrip'

export type PaperWidth = 57 | 58 | 80

export function printDimensions(paperWidth: PaperWidth, aspectRatio = stripHeight(STRIP_LAYOUT) / STRIP_LAYOUT.width) {
    // Starting C15 preset; physical output still needs verification on the device.
    const margin = paperWidth === 57 ? 4.5 : STRIP_LAYOUT.printMarginMm
    const width = paperWidth - 2 * margin
    return { width, margin, height: width * aspectRatio + 2 * margin }
}

// Transform a separate copy of the finished PNG, including branding and QR.
// Pure black/white QR modules and the white quiet zone remain unchanged.
export function thermalPixels(pixels: Uint8ClampedArray) {
    for (let i = 0; i < pixels.length; i += 4) {
        const gray = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
        const value = Math.max(0, Math.min(255, (gray - 127.5) * 1.35 + 127.5))
        pixels[i] = pixels[i + 1] = pixels[i + 2] = value
    }
}

export async function createThermalStrip(source: string): Promise<string> {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare thermal printing. Please try Normal Print.')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    thermalPixels(pixels.data)
    context.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/png')
}

