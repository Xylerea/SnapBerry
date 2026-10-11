import { FRAME_COLORS, PHOTO_COUNT, layoutForOptions, stripHeight, type StripOptions } from '../lib/photoStrip'
import { FLEURA_QR_CAPTION, FLEURA_QR_IMAGE } from '../lib/fleuraQr'
import { DESIGN_FONTS, designBounds, constrainDesign } from '../lib/stripDesign'

type PhotoStripProps = StripOptions & { photos: string[]; generatedImage: string | null }

export default function PhotoStrip({ photos, monochrome, frameColor, caption, date, design, background, generatedImage }: PhotoStripProps) {
    const layout = layoutForOptions()
    const photoCount = photos.length === 2 ? 2 : PHOTO_COUNT
    const height = stripHeight(layout, photoCount)
    const editableHeight = height - layout.border * 2 - 360 - layout.qrFooterHeight
    return (
        <div className="relative mx-auto w-full max-w-[280px] bg-white shadow-lg"
            style={{ aspectRatio: `${layout.width} / ${height}`, backgroundColor: background ?? FRAME_COLORS[frameColor] }}>
            {generatedImage ? (
                <img src={generatedImage} alt={`Completed ${photoCount}-photo SnapBerry strip`} className="block h-auto w-full" />
            ) : (
                <div style={{ padding: `${layout.border / layout.width * 100}%` }}>
                    <div className="flex flex-col">
                        {Array.from({ length: photoCount }, (_, index) => (
                            <div key={index} className="relative flex items-center justify-center overflow-hidden bg-pink-50 text-sm text-pink-300"
                                style={{ aspectRatio: `${layout.width - 2 * layout.border} / ${layout.photoHeight}`,
                                    marginBottom: index < photoCount - 1 ? `${layout.gap / (layout.width - 2 * layout.border) * 100}%` : 0 }}>
                                {photos[index] ? <img src={photos[index]} alt={`Captured photo ${index + 1}`}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    style={{ filter: monochrome ? 'grayscale(1)' : undefined }} />
                                    : <span>Photo {index + 1}</span>}
                            </div>
                        ))}
                    </div>
                    {!!design?.length && <svg viewBox={`0 0 ${layout.width - 2 * layout.border} ${editableHeight}`} className="pointer-events-none absolute overflow-hidden" style={{ left: '5%', width: '90%', top: `${60 / height * 100}%`, height: `${editableHeight / height * 100}%` }} aria-label="Your strip decorations">
                        {design.map(raw => {
                            const item = constrainDesign(raw, 1080, editableHeight), bounds = designBounds(item)
                            return <g key={item.id} transform={`translate(${item.x * 10.8} ${editableHeight * item.y / 100}) rotate(${item.rotation ?? 0})`}>
                                {item.kind === 'image'
                                    ? <image href={item.value} x={-bounds.width / 2} y={-bounds.height / 2} width={bounds.width} height={bounds.height} preserveAspectRatio="xMidYMid meet" />
                                    : <text textAnchor="middle" y={item.size * 0.32} fontFamily={DESIGN_FONTS[item.font]} fontSize={item.size} textLength={bounds.width} lengthAdjust="spacingAndGlyphs" fill="#342b31">{item.value}</text>}
                            </g>
                        })}
                    </svg>}
                    <div className="flex flex-col items-center justify-center text-center"
                        style={{ aspectRatio: `${layout.width - 2 * layout.border} / 360`,
                            color: frameColor === 'Black' ? 'white' : '#342b31' }}>
                        {caption && <p className="w-full truncate text-[10px] font-semibold">{caption}</p>}
                        {date && <p className="text-[8px]">{date}</p>}
                        <p className="mt-1 text-[11px] font-semibold">SnapBerry &#127827;</p>
                        <p className="text-[8px]">by FLEURA &#127799;</p>
                    </div>
                    <div className="flex flex-col items-center text-center"
                        style={{ aspectRatio: `${layout.width - 2 * layout.border} / ${layout.qrFooterHeight}`, paddingTop: '2.22%', color: frameColor === 'Black' ? 'white' : '#342b31' }}>
                        <img src={FLEURA_QR_IMAGE} alt="QR code for the FLEURA Facebook page" style={{ width: '62.22%' }} />
                        <p className="mt-1 w-full text-[7px] leading-tight">{FLEURA_QR_CAPTION}</p>
                    </div>
                </div>
            )}
        </div>
    )
}




