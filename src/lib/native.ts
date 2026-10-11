import { Capacitor, registerPlugin } from '@capacitor/core'

type SnapBerryNativePlugin = {
    prepareCamera(): Promise<void>
    saveImage(options: { dataUrl: string }): Promise<{ uri: string }>
    printImage(options: { dataUrl: string; paperWidth: number }): Promise<void>
}

export const isAndroidApp = () => Capacitor.getPlatform() === 'android'
export const SnapBerryNative = registerPlugin<SnapBerryNativePlugin>('SnapBerryNative')

export async function saveStrip(dataUrl: string) {
    if (isAndroidApp()) {
        await SnapBerryNative.saveImage({ dataUrl })
        return 'Saved to Gallery in Pictures/SnapBerry.'
    }
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'snapberry-photo-strip.png'
    document.body.append(link)
    link.click()
    link.remove()
    return 'Your strip is ready to save. Check your downloads.'
}
