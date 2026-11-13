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

export type StripLayout = typeof STRIP_LAYOUT & { columns?: number; height?: number; photoCount?: number; photoWidth?: number; columnGap?: number; offsetX?: number; designScale?: number; websiteClassic?: boolean; websitePostcard?: boolean; websiteLandscape?: boolean }
const pixelsPerCm = 300 / 2.54
// Each half-sheet is 5.08 cm wide. Frames retain their specified physical size.
export const WEBSITE_CLASSIC_LAYOUT: StripLayout = {
    ...STRIP_LAYOUT, websiteClassic: true, width: 600, height: 1800,
    border: (600 - 4.32 * pixelsPerCm) / 2,
    gap: 0.08 * pixelsPerCm, photoHeight: 2.96 * pixelsPerCm,
    footerHeight: 2.56 * pixelsPerCm, qrFooterHeight: 0,
}
export const POSTCARD_LAYOUT: StripLayout = { ...STRIP_LAYOUT, columns: 2, height: 1800, photoHeight: 405, footerHeight: 540, qrFooterHeight: 300 }
// Website reference: 525×700 portrait slots, 60px margins, 30px gaps.
export const WEBSITE_POSTCARD_LAYOUT: StripLayout = {
    ...POSTCARD_LAYOUT, websitePostcard: true, photoHeight: 700, footerHeight: 250, qrFooterHeight: 0,
}
// Three landscape photos in a 2×2 grid; the fourth cell is for designs.
export const LANDSCAPE_LAYOUT: StripLayout = { ...STRIP_LAYOUT, width: 1800, height: 1200, columns: 2, photoCount: 3, photoHeight: 450 }
// Exact photo openings in the supplied 4687×3281 navy-and-gold event artwork.
// One scale preserves the artwork, gold borders, and event lettering on 4R.
const artworkScale = 1200 / 3281
const landscapeScale = artworkScale * 3281 / 1050
export const WEBSITE_LANDSCAPE_LAYOUT: StripLayout = {
    ...LANDSCAPE_LAYOUT, websiteLandscape: true,
    border: 269 * artworkScale, gap: 93 * artworkScale,
    photoWidth: 2095 * artworkScale, photoHeight: 1352 * artworkScale,
    columnGap: 133 * artworkScale,
    offsetX: (1800 - 4687 * artworkScale) / 2 + (182 - 269) * artworkScale,
    designScale: landscapeScale,
}
export function photoCountForOptions(options?: Pick<StripOptions, 'layout'>) { return options?.layout === 'landscape' ? 3 : PHOTO_COUNT }
export const FRAME_COLORS = { White: '#ffffff', Pink: '#fce7f3', Black: '#171717', Cream: '#fff4dc' }
export type FrameColor = keyof typeof FRAME_COLORS
export const CAPTION_LIMIT = 32
export type PaperSize = '4R' | '3R'
export type StripOptions = { monochrome: boolean; frameColor: FrameColor; caption: string; date: string; design?: DesignItem[]; background?: string; backgroundImage?: string; layout?: 'classic' | 'postcard' | 'landscape'; paperSize?: PaperSize; borderColor?: string; borderThickness?: number }

export type PhotoFrame = { x: number; y: number; width: number; height: number }

export function photoFrames(layout: StripLayout, count = layout.photoCount ?? PHOTO_COUNT): PhotoFrame[] {
    const columns = layout.columns ?? 1
    const columnGap = layout.columnGap ?? layout.gap
    const width = layout.photoWidth ?? (layout.width - 2 * layout.border - (columns - 1) * columnGap) / columns
    return Array.from({ length: count }, (_, index) => ({
        x: (layout.offsetX ?? 0) + layout.border + (index % columns) * (width + columnGap),
        y: layout.border + Math.floor(index / columns) * (layout.photoHeight + layout.gap),
        width, height: layout.photoHeight,
    }))
}

// Thickness is stored in millimetres. Fill only inside the fixed outer edges.
export function photoBorderRects(frame: PhotoFrame, thickness = 0): PhotoFrame[] {
    const t = Math.min(Number.isFinite(thickness) ? Math.max(0, thickness) * 300 / 25.4 : 0, frame.width / 2, frame.height / 2)
    if (!t) return []
    const { x, y, width, height } = frame
    return [{ x, y, width, height: t }, { x, y: y + height - t, width, height: t },
        { x, y: y + t, width: t, height: height - 2 * t }, { x: x + width - t, y: y + t, width: t, height: height - 2 * t }]
}

// Photo paper at 300 DPI; only the three-photo layout uses landscape paper.
export function paperForLayout(layout?: StripOptions['layout'], paperSize: PaperSize = '4R') {
    const [short, long] = paperSize === '3R' ? [3.5, 5] : [4, 6]
    return layout === 'landscape'
        ? { width: long * 300, height: short * 300, widthInches: long, heightInches: short }
        : { width: short * 300, height: long * 300, widthInches: short, heightInches: long }
}

export function layoutForOptions(options?: StripOptions): StripLayout {
    return options?.layout === 'landscape' ? LANDSCAPE_LAYOUT : options?.layout === 'postcard' ? POSTCARD_LAYOUT : STRIP_LAYOUT
}

export function websiteLayoutForOptions(options?: StripOptions): StripLayout {
    const layout = options?.layout === 'landscape' ? WEBSITE_LANDSCAPE_LAYOUT : options?.layout === 'postcard' ? WEBSITE_POSTCARD_LAYOUT : WEBSITE_CLASSIC_LAYOUT
    if (options?.paperSize !== '3R') return layout
    if (layout.websiteLandscape) return { ...LANDSCAPE_LAYOUT, websiteLandscape: true,
        width: 1500, height: 1050, border: 50, gap: 25, photoWidth: 684, photoHeight: 444, columnGap: 32 }
    const paper = paperForLayout(options.layout, options.paperSize)
    const width = layout.websiteClassic ? paper.width / 2 : paper.width
    const scale = Math.min(width / layout.width, paper.height / stripHeight(layout))
    const resized = { ...layout, width, height: paper.height, border: layout.border * scale, gap: layout.gap * scale,
        photoHeight: layout.photoHeight * scale, footerHeight: layout.footerHeight * scale, qrFooterHeight: layout.qrFooterHeight * scale }
    return resized
}

export function stripHeight(layout: StripLayout, photoCount = PHOTO_COUNT) {
    if (layout.height) return layout.height
    return layout.border * 2 + photoCount * layout.photoHeight
        + (photoCount - 1) * layout.gap + layout.footerHeight + layout.qrFooterHeight
}

export function designArea(layout: StripLayout, count = PHOTO_COUNT) {
    if (layout.websiteClassic) {
        return { left: layout.border, width: layout.width - 2 * layout.border,
            top: layout.border, height: PHOTO_COUNT * layout.photoHeight + (PHOTO_COUNT - 1) * layout.gap }
    }
    if (layout.websitePostcard) {
        // Decorations stay above the background-only bottom section.
        return { left: layout.border, width: layout.width - 2 * layout.border,
            top: layout.border, height: 2 * layout.photoHeight + layout.gap }
    }
    if (layout.photoCount === 3) {
        const frames = photoFrames(layout, 4)
        return { left: frames[3].x, width: frames[3].width, top: frames[3].y, height: frames[3].height }
    }
    if (layout.columns === 2) {
        const top = layout.border + Math.ceil(count / 2) * (layout.photoHeight + layout.gap)
        return { left: 60, width: layout.width - 120, top, height: stripHeight(layout, count) - layout.border - layout.qrFooterHeight - top }
    }
    return { left: 60, width: layout.width - 120, top: layout.border, height: stripHeight(layout, count) - layout.border * 2 - layout.footerHeight - layout.qrFooterHeight }
}
function loadPhoto(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Unable to load a captured photo. Please retake the session.'))
        image.src = source
    })
}

export async function generateWebsiteClassicSheet(photos: string[], options: StripOptions, preview = false): Promise<string> {
    const layout = websiteLayoutForOptions({ ...options, layout: 'classic' })
    const paper = paperForLayout('classic', options.paperSize)
    const source = await generatePhotoStrip(photos, options, layout, true, preview)
    const image = await loadPhoto(source)
    const canvas = document.createElement('canvas')
    canvas.width = paper.width; canvas.height = paper.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare your print preview.')
    // Both copies share the selected paper geometry, with no resampling.
    context.drawImage(image, 0, 0)
    context.drawImage(image, layout.width, 0)
    return canvas.toDataURL('image/png')
}

export function classicPrintPlacement(sourceWidth = STRIP_LAYOUT.width, sourceHeight = stripHeight(STRIP_LAYOUT)) {
    const paper = paperForLayout('classic')
    const margin = 30, gap = 30
    const scale = Math.min((paper.width - 2 * margin - gap) / 2 / sourceWidth, (paper.height - 2 * margin) / sourceHeight)
    const width = sourceWidth * scale, height = sourceHeight * scale
    return { width, height, left: (paper.width - 2 * width - gap) / 2, top: (paper.height - height) / 2, gap }
}

// Reuse the finished strip twice without additional captures.
export async function generateClassicPrintSheet(source: string): Promise<string> {
    const image = await loadPhoto(source)
    const canvas = document.createElement('canvas')
    const paper = paperForLayout('classic')
    canvas.width = paper.width; canvas.height = paper.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare your print preview.')
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
    const { width, height, left, top, gap } = classicPrintPlacement(image.naturalWidth, image.naturalHeight)
    context.drawImage(image, left, top, width, height)
    context.drawImage(image, left + width + gap, top, width, height)
    return canvas.toDataURL('image/png')
}

export async function generatePhotoStrip(
    photos: string[], options: StripOptions, layout: StripLayout = layoutForOptions(options), renderDesign = true, preview = false,
): Promise<string> {
    const expectedCount = layout.photoCount ?? PHOTO_COUNT
    if (!preview && (layout.photoCount === 3 ? photos.length !== 3 : photos.length !== 2 && photos.length !== PHOTO_COUNT)) throw new Error('Complete your photo session first.')
    const images = await Promise.all(Array.from({ length: preview ? expectedCount : photos.length }, (_, index) => photos[index] ? loadPhoto(photos[index]) : null))
    const backgroundImage = options.backgroundImage ? await loadPhoto(options.backgroundImage) : null
    const canvas = document.createElement('canvas')
    canvas.width = layout.width
    canvas.height = stripHeight(layout, images.length)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create the photo strip.')
    context.fillStyle = options.background ?? FRAME_COLORS[options.frameColor]
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    if (backgroundImage) {
        if (layout.websiteLandscape && layout.designScale) {
            // Keep the entire source artwork visible, with its original proportions.
            const scale = Math.min(canvas.width / backgroundImage.naturalWidth, canvas.height / backgroundImage.naturalHeight)
            const width = backgroundImage.naturalWidth * scale, height = backgroundImage.naturalHeight * scale
            context.drawImage(backgroundImage, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        } else {
            const scale = Math.max(canvas.width / backgroundImage.naturalWidth, canvas.height / backgroundImage.naturalHeight)
            const width = canvas.width / scale, height = canvas.height / scale
            context.drawImage(backgroundImage, (backgroundImage.naturalWidth - width) / 2, (backgroundImage.naturalHeight - height) / 2, width, height, 0, 0, canvas.width, canvas.height)
        }
    }
    const columns = layout.columns ?? 1
    const frames = photoFrames(layout, images.length)
    const photoWidth = frames[0].width
    const finish = () => {
        context.fillStyle = options.borderColor ?? '#ffffff'
        for (const frame of frames) for (const edge of photoBorderRects(frame, options.borderThickness)) {
            context.fillRect(edge.x, edge.y, edge.width, edge.height)
        }
        return canvas.toDataURL('image/png')
    }

    images.forEach((image, index) => {
        const { x, y } = frames[index]
        if (!image) {
            context.fillStyle = '#fdf2f8'; context.fillRect(x, y, photoWidth, layout.photoHeight)
            context.fillStyle = '#9d174d'; context.font = '40px Arial'; context.textAlign = 'center'
            context.fillText(`Photo ${index + 1}`, x + photoWidth / 2, y + layout.photoHeight / 2)
            return
        }
        // Center crop using the original image, matching object-fit: cover.
        const scale = Math.max(photoWidth / image.naturalWidth, layout.photoHeight / image.naturalHeight)
        const sourceWidth = photoWidth / scale
        const sourceHeight = layout.photoHeight / scale
        context.drawImage(image, (image.naturalWidth - sourceWidth) / 2,
            (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight,
            x, y, photoWidth, layout.photoHeight)
        if (options.monochrome) {
            const pixels = context.getImageData(x, y, photoWidth, layout.photoHeight)
            for (let i = 0; i < pixels.data.length; i += 4) {
                const luminance = 0.2126 * pixels.data[i] + 0.7152 * pixels.data[i + 1] + 0.0722 * pixels.data[i + 2]
                const gray = luminance
                pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray
            }
            context.putImageData(pixels, x, y)
        }
    })
    if (layout.websiteClassic) {
        const photoBottom = layout.border + PHOTO_COUNT * layout.photoHeight + (PHOTO_COUNT - 1) * layout.gap
        if (renderDesign && options.design?.length) await drawDesign(context, options.design, layout.width,
            layout.border, photoBottom - layout.border, layout.border, photoWidth)
        // Leave the bottom section background-only.
        return finish()
    }
    if (layout.websitePostcard) {
        const area = designArea(layout)
        if (renderDesign && options.design?.length) await drawDesign(context, options.design, layout.width,
            area.top, area.height, area.left, area.width)
        return finish()
    }
    if (layout.photoCount === 3) {
        const area = designArea(layout)
        if (renderDesign && options.design?.length) {
            const scale = layout.designScale ?? 1
            context.save()
            try {
                context.scale(scale, scale)
                await drawDesign(context, options.design, layout.width / scale, area.top / scale, area.height / scale, area.left / scale, area.width / scale)
            } finally { context.restore() }
        }
        if (layout.websiteLandscape) return finish()
        drawFleuraQr(context, 1600, 1000, 180)
        context.textAlign = 'center'; context.fillStyle = '#342b31'; context.font = '28px Arial, sans-serif'
        context.fillText(FLEURA_QR_CAPTION, 900, 1180, 1680)
        return finish()
    }
    if (columns === 2) {
        const area = designArea(layout)
        if (renderDesign && options.design?.length) await drawDesign(context, options.design, layout.width, area.top, area.height)
        const footerTop = canvas.height - layout.border - layout.qrFooterHeight
        context.textAlign = 'center'; context.fillStyle = '#342b31'; context.font = '48px Arial, sans-serif'
        context.fillText('SnapBerry', 360, footerTop + 100)
        context.font = '32px Arial, sans-serif'; context.fillText('by FLEURA', 360, footerTop + 155)
        drawFleuraQr(context, 900, footerTop + 12, 204)
        context.font = '32px Arial, sans-serif'
        context.fillText(FLEURA_QR_CAPTION, canvas.width / 2, canvas.height - layout.border - 12, canvas.width - 2 * layout.border)
        return finish()
    }
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
    return finish()
}







