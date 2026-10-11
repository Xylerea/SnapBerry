import { drawDesign, type DesignItem } from './stripDesign'
import { drawFleuraQr, FLEURA_QR_CAPTION } from './fleuraQr'

export const PHOTO_COUNT = 4

// Pixel dimensions can be adapted to a printer's printable dot width later.
export const STRIP_LAYOUT = {
    width: 1200,
    border: 60,
    gap: 30,
    photoHeight: 810,
    footerHeight: 360,
    qrFooterHeight: 800,
    paperWidthMm: 58,
    printMarginMm: 4,
}

export type StripLayout = typeof STRIP_LAYOUT
export const FRAME_COLORS = { White: '#ffffff', Pink: '#fce7f3', Black: '#171717', Cream: '#fff4dc' }
export type FrameColor = keyof typeof FRAME_COLORS
export const CAPTION_LIMIT = 32
export type StripOptions = { monochrome: boolean; frameColor: FrameColor; caption: string; date: string; design?: DesignItem[]; background?: string }

export function layoutForOptions(): StripLayout {
    return STRIP_LAYOUT
}

export function stripHeight(layout: StripLayout, photoCount = PHOTO_COUNT) {
    return layout.border * 2 + photoCount * layout.photoHeight
        + (photoCount - 1) * layout.gap + layout.footerHeight + layout.qrFooterHeight
}

function loadPhoto(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Unable to load a captured photo. Please retake the session.'))
        image.src = source
    })
}

export async function generatePhotoStrip(
    photos: string[], options: StripOptions, layout: StripLayout = layoutForOptions(), renderDesign = true,
): Promise<string> {
    if (photos.length !== 2 && photos.length !== PHOTO_COUNT) throw new Error('Complete your photo session first.')
    const images = await Promise.all(photos.map(loadPhoto))
    const canvas = document.createElement('canvas')
    canvas.width = layout.width
    canvas.height = stripHeight(layout, photos.length)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create the photo strip.')
    context.fillStyle = options.background ?? FRAME_COLORS[options.frameColor]
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const photoWidth = layout.width - 2 * layout.border

    images.forEach((image, index) => {
        // Center crop using the original image, matching object-fit: cover.
        const scale = Math.max(photoWidth / image.naturalWidth, layout.photoHeight / image.naturalHeight)
        const sourceWidth = photoWidth / scale
        const sourceHeight = layout.photoHeight / scale
        const y = layout.border + index * (layout.photoHeight + layout.gap)
        context.drawImage(image, (image.naturalWidth - sourceWidth) / 2,
            (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight,
            layout.border, y, photoWidth, layout.photoHeight)
        if (options.monochrome) {
            const pixels = context.getImageData(layout.border, y, photoWidth, layout.photoHeight)
            for (let i = 0; i < pixels.data.length; i += 4) {
                const luminance = 0.2126 * pixels.data[i] + 0.7152 * pixels.data[i + 1] + 0.0722 * pixels.data[i + 2]
                const gray = luminance
                pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray
            }
            context.putImageData(pixels, layout.border, y)
        }
    })
    const designTop = canvas.height - layout.border - layout.footerHeight - layout.qrFooterHeight
    if (renderDesign && options.design?.length) await drawDesign(context, options.design, layout.width, layout.border, designTop - layout.border)
    const footerTop = designTop
    context.textAlign = 'center'
    const textColor = options.frameColor === 'Black' ? '#ffffff' : '#342b31'
    const caption = options.caption.trim().slice(0, CAPTION_LIMIT)
    context.fillStyle = textColor
    let captionSize = layout.width * 0.044
    context.font = `600 ${captionSize}px Arial, sans-serif`
    while (context.measureText(caption).width > photoWidth && captionSize > layout.width * 0.022) {
        captionSize -= 1
        context.font = `600 ${captionSize}px Arial, sans-serif`
    }
    if (caption) context.fillText(caption, canvas.width / 2, footerTop + STRIP_LAYOUT.footerHeight * 0.23, photoWidth)
    context.font = `${layout.width * 0.026}px Arial, sans-serif`
    if (options.date) context.fillText(options.date, canvas.width / 2, footerTop + STRIP_LAYOUT.footerHeight * 0.42, photoWidth)
    context.fillStyle = options.frameColor === 'Black' ? '#fbcfe8' : '#9d174d'
    context.font = `600 ${layout.width * 0.048}px Arial, sans-serif`
    context.fillText('SnapBerry \u{1F353}', canvas.width / 2, footerTop + STRIP_LAYOUT.footerHeight * 0.68)
    context.fillStyle = textColor
    context.font = `${layout.width * 0.029}px Arial, sans-serif`
    context.fillText('by FLEURA \u{1F337}', canvas.width / 2, footerTop + STRIP_LAYOUT.footerHeight * 0.87)
    const qrTop = Math.round(footerTop + STRIP_LAYOUT.footerHeight + layout.width * 0.02)
    const qrSize = drawFleuraQr(context, canvas.width / 2, qrTop, layout.width * 0.56)
    context.fillStyle = textColor
    context.font = `${layout.width * 0.032}px Arial, sans-serif`
    context.fillText(FLEURA_QR_CAPTION, canvas.width / 2, qrTop + qrSize + layout.width * 0.05, photoWidth)
    return canvas.toDataURL('image/png')
}





