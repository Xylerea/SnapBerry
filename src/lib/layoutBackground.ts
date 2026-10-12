// Shared by the layout details screen and the existing background editor.
export async function loadLayoutBackground(file: File, maxDimension: number): Promise<string> {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 8 * 1024 * 1024) {
        throw new Error('Choose a PNG or JPG image under 8 MB.')
    }
    const url = URL.createObjectURL(file)
    try {
        const image = new Image(); image.src = url; await image.decode()
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Unable to open that image. Try another one.')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/png')
    } finally { URL.revokeObjectURL(url) }
}
