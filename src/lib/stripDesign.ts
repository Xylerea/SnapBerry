export const DESIGN_FONTS = { Simple: 'Arial, sans-serif', Handwritten: 'cursive', Elegant: 'Georgia, serif' }
export type DesignItem = { id: string; kind: 'text' | 'image'; value: string; font: keyof typeof DESIGN_FONTS; size: number; x: number; y: number; rotation?: number; aspectRatio?: number }
export const DESIGN_HEIGHT = 480
let measuring: CanvasRenderingContext2D | null | undefined
export function designBounds(item: DesignItem) {
    const size = Math.max(24, Math.min(180, item.size))
    if (item.kind === 'image') {
        const ratio = item.aspectRatio ?? 1
        return { width: ratio >= 1 ? size * 2 : size * 2 * ratio, height: ratio >= 1 ? size * 2 / ratio : size * 2 }
    }
    if (measuring === undefined) measuring = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    if (measuring) measuring.font = `${size}px ${DESIGN_FONTS[item.font]}`
    return { width: Math.max(1, Math.min(1000, measuring?.measureText(item.value.slice(0, 60)).width ?? item.value.length * size * 0.6)), height: size * 1.3 }
}
export function constrainDesign(item: DesignItem, width: number, height: number): DesignItem {
    const size = Math.max(24, Math.min(180, item.size))
    const bounds = designBounds({ ...item, size })
    const rotation = item.rotation ?? 0, angle = rotation * Math.PI / 180
    const halfX = Math.min(width / 2, (Math.abs(Math.cos(angle)) * bounds.width + Math.abs(Math.sin(angle)) * bounds.height) / 2)
    const halfY = Math.min(height / 2, (Math.abs(Math.sin(angle)) * bounds.width + Math.abs(Math.cos(angle)) * bounds.height) / 2)
    return { ...item, size, rotation, x: Math.max(halfX, Math.min(width - halfX, item.x / 100 * width)) / width * 100, y: Math.max(halfY, Math.min(height - halfY, item.y / 100 * height)) / height * 100 }
}
export async function drawDesign(context: CanvasRenderingContext2D, items: DesignItem[], width: number, top: number, height = DESIGN_HEIGHT, left = 60, designWidth = width - 120) {
    context.save()
    try {
        context.beginPath(); context.rect(left, top, designWidth, height); context.clip()
        for (const raw of items) {
            const item = constrainDesign(raw, designWidth, height), bounds = designBounds(item)
            let image: HTMLImageElement | undefined
            if (item.kind === 'image') { image = new Image(); image.src = item.value; await image.decode() }
            context.save()
            try {
                context.translate(left + designWidth * item.x / 100, top + height * item.y / 100)
                context.rotate((item.rotation ?? 0) * Math.PI / 180)
                if (image) {
                    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight)
                    const imageWidth = image.naturalWidth * scale, imageHeight = image.naturalHeight * scale
                    context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight)
                }
                else {
                    context.fillStyle = '#342b31'; context.textAlign = 'center'; context.textBaseline = 'alphabetic'
                    context.font = `${item.size}px ${DESIGN_FONTS[item.font]}`
                    context.fillText(item.value.slice(0, 60), 0, item.size * 0.32, bounds.width)
                }
            } finally { context.restore() }
        }
    } finally { context.restore() }
}

