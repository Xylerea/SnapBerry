import { useEffect, useState } from 'react'
import { generateClassicPrintSheet, classicPrintPlacement, generateWebsiteClassicSheet, WEBSITE_CLASSIC_LAYOUT, paperForLayout, generatePhotoStrip, FRAME_COLORS, PHOTO_COUNT, photoCountForOptions, layoutForOptions, websiteLayoutForOptions, stripHeight, designArea, type StripOptions } from '../lib/photoStrip'
import { isAndroidApp } from '../lib/native'
import { FLEURA_QR_CAPTION, FLEURA_QR_IMAGE } from '../lib/fleuraQr'
import { DESIGN_FONTS, designBounds, constrainDesign } from '../lib/stripDesign'

type PhotoStripProps = StripOptions & { photos: string[]; generatedImage: string | null; live?: boolean; paired?: boolean; fullWidth?: boolean }

export default function PhotoStrip({ photos, monochrome, frameColor, caption, date, design, background, backgroundImage, layout: layoutChoice, generatedImage, live = false, paired = false, fullWidth = false }: PhotoStripProps) {
    const [rendered, setRendered] = useState<{ key: string; image: string } | null>(null)
    const key = JSON.stringify({ photos, options: { monochrome, frameColor, caption, date, design, background, backgroundImage, layout: layoutChoice } })
    useEffect(() => {
        if ((!live && !paired && layoutChoice !== 'landscape' && !(layoutChoice === 'postcard' && !isAndroidApp())) || generatedImage) return
        let cancelled = false
        const snapshot = JSON.parse(key) as { photos: string[]; options: StripOptions }
        const generate = paired && !isAndroidApp() ? generateWebsiteClassicSheet(snapshot.photos, snapshot.options, true)
            : generatePhotoStrip(snapshot.photos, snapshot.options, isAndroidApp() ? undefined : websiteLayoutForOptions(snapshot.options), true, true).then(image => paired ? generateClassicPrintSheet(image) : image)
        void generate.then(image => {
            if (!cancelled) setRendered({ key, image })
        }).catch(() => { /* Keep the immediate layout visible. */ })
            return () => { cancelled = true }
    }, [key, live, layoutChoice, generatedImage, paired])
    const displayImage = generatedImage ?? (rendered?.key === key ? rendered.image : null)
    const options = { monochrome, frameColor, caption, date, layout: layoutChoice }
    const layout = isAndroidApp() ? layoutForOptions(options) : websiteLayoutForOptions(options)
    const photoCount = layoutChoice === 'landscape' ? photoCountForOptions({ layout: layoutChoice }) : !live && !fullWidth && photos.length === 2 ? 2 : PHOTO_COUNT
    const height = stripHeight(layout, photoCount)
    const area = designArea(layout, photoCount)
    const editableHeight = area.height
    const postcard = layout.columns === 2
    const landscape = layout.photoCount === 3
    const editableWidth = area.width
    const photoWidth = postcard ? 525 : layout.width - 2 * layout.border
    if (paired) {
        const paper = paperForLayout('classic')
        if (isAndroidApp()) {
            const placement = classicPrintPlacement()
            const copyOptions = { monochrome, frameColor, caption, date, design, background, backgroundImage, layout: layoutChoice }
            return <div className="relative mx-auto w-full max-w-[400px] bg-white shadow-lg" style={{ aspectRatio: `${paper.width} / ${paper.height}` }}>
                {displayImage ? <img src={displayImage} alt="Two identical four-photo strips on 4R portrait paper" className="block h-full w-full object-contain" />
                    : [0, 1].map(copy => <div key={copy} className="absolute" style={{ left: `${(placement.left + copy * (placement.width + placement.gap)) / paper.width * 100}%`, top: `${placement.top / paper.height * 100}%`, width: `${placement.width / paper.width * 100}%`, height: `${placement.height / paper.height * 100}%` }}>
                        <PhotoStrip photos={photos} {...copyOptions} generatedImage={null} fullWidth />
                    </div>)}
            </div>
        }
        const classic = WEBSITE_CLASSIC_LAYOUT
        const frameWidth = classic.width - 2 * classic.border
        return <div className="relative mx-auto w-full max-w-[400px] bg-white shadow-lg" style={{ aspectRatio: `${paper.width} / ${paper.height}` }}>
            {displayImage ? <img src={displayImage} alt="Two identical four-photo strips on 4R portrait paper" className="block h-full w-full object-contain" />
                : <svg viewBox="0 0 1200 1800" className="block h-full w-full" aria-label="Classic double-strip preview">
                    {[0, 1].map(copy => <g key={copy} transform={`translate(${copy * classic.width} 0)`}>
                        <rect width="600" height="1800" fill={background ?? FRAME_COLORS[frameColor]} />
                        {backgroundImage && <image href={backgroundImage} width="600" height="1800" preserveAspectRatio="xMidYMid slice" />}
                        {Array.from({ length: PHOTO_COUNT }, (_, index) => {
                            const y = classic.border + index * (classic.photoHeight + classic.gap)
                            return <g key={index}>{photos[index]
                                ? <image href={photos[index]} x={classic.border} y={y} width={frameWidth} height={classic.photoHeight} preserveAspectRatio="xMidYMid slice" style={{ filter: monochrome ? 'grayscale(1)' : undefined }} />
                                : <><rect x={classic.border} y={y} width={frameWidth} height={classic.photoHeight} fill="#fdf2f8" /><text x="300" y={y + classic.photoHeight / 2} textAnchor="middle" fontSize="24" fill="#9d174d">Photo {index + 1}</text></>}</g>
                        })}
                    </g>)}
                </svg>}
        </div>
    }
    return (
        <div className={`relative mx-auto w-full min-w-0 bg-white shadow-lg ${fullWidth ? 'max-w-none' : landscape ? 'max-w-[600px]' : live && postcard ? 'max-w-[400px]' : 'max-w-[280px]'}`}
            style={{ aspectRatio: `${layout.width} / ${height}`, backgroundColor: background ?? FRAME_COLORS[frameColor], backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {displayImage ? (
                <img src={displayImage} alt={`Completed ${photoCount}-photo SnapBerry strip`} className="block h-full w-full object-contain" />
            ) : layout.websitePostcard ? (
                <svg viewBox={`0 0 ${layout.width} ${height}`} className="block h-full w-full" aria-label="2×2 portrait postcard preview">
                    {Array.from({ length: PHOTO_COUNT }, (_, index) => {
                        const x = layout.border + (index % 2) * (photoWidth + layout.gap)
                        const y = layout.border + Math.floor(index / 2) * (layout.photoHeight + layout.gap)
                        return <g key={index}>{photos[index]
                            ? <image href={photos[index]} x={x} y={y} width={photoWidth} height={layout.photoHeight} preserveAspectRatio="xMidYMid slice" style={{ filter: monochrome ? 'grayscale(1)' : undefined }} />
                            : <><rect x={x} y={y} width={photoWidth} height={layout.photoHeight} fill="#fdf2f8" /><text x={x + photoWidth / 2} y={y + layout.photoHeight / 2} textAnchor="middle" fontSize="40" fill="#9d174d">Photo {index + 1}</text></>}</g>
                    })}
                </svg>
            ) : landscape ? (
                <svg viewBox="0 0 1800 1200" className="block h-full w-full" aria-label="Landscape Postcard preview">
                    {Array.from({ length: 3 }, (_, index) => {
                        const width = (layout.width - 2 * layout.border - layout.gap) / 2
                        const x = layout.border + (index % 2) * (width + layout.gap)
                        const y = layout.border + Math.floor(index / 2) * (layout.photoHeight + layout.gap)
                        return <g key={index}>{photos[index]
                            ? <image href={photos[index]} x={x} y={y} width={width} height={layout.photoHeight} preserveAspectRatio="xMidYMid slice" style={{ filter: monochrome ? 'grayscale(1)' : undefined }} />
                            : <><rect x={x} y={y} width={width} height={layout.photoHeight} fill="#fdf2f8" /><text x={x + width / 2} y={y + layout.photoHeight / 2} textAnchor="middle" fontSize="40" fill="#9d174d">Photo {index + 1}</text></>}</g>
                    })}
                    {design?.map(raw => {
                        const item = constrainDesign(raw, editableWidth, editableHeight), bounds = designBounds(item)
                        return <g key={item.id} transform={`translate(${area.left + item.x * editableWidth / 100} ${area.top + editableHeight * item.y / 100}) rotate(${item.rotation ?? 0})`}>
                            {item.kind === 'image' ? <image href={item.value} x={-bounds.width / 2} y={-bounds.height / 2} width={bounds.width} height={bounds.height} preserveAspectRatio="xMidYMid meet" />
                                : <text textAnchor="middle" y={item.size * 0.32} fontFamily={DESIGN_FONTS[item.font]} fontSize={item.size} fill="#342b31">{item.value}</text>}
                        </g>
                    })}
                    {!layout.websiteLandscape && <>
                        <image href={FLEURA_QR_IMAGE} x="1510" y="1000" width="180" height="180" />
                        <text x="900" y="1180" textAnchor="middle" fontSize="28" fill="#342b31">{FLEURA_QR_CAPTION}</text>
                    </>}
                </svg>
            ) : (
                <div style={{ padding: `${layout.border / layout.width * 100}%` }}>
                    <div className={postcard ? "grid grid-cols-2" : "flex flex-col"} style={{ columnGap: postcard ? `${layout.gap / 1080 * 100}%` : undefined,
                        aspectRatio: postcard ? `1080 / ${2 * layout.photoHeight + layout.gap}` : undefined,
                        rowGap: postcard ? `${layout.gap / (2 * layout.photoHeight + layout.gap) * 100}%` : undefined }}>
                        {Array.from({ length: photoCount }, (_, index) => (
                            <div key={index} className="relative flex items-center justify-center overflow-hidden bg-pink-50 text-sm text-pink-300"
                                style={{ aspectRatio: `${photoWidth} / ${layout.photoHeight}`,
                                    marginBottom: postcard ? 0 : index < photoCount - 1 ? `${layout.gap / (layout.width - 2 * layout.border) * 100}%` : 0 }}>
                                {photos[index] ? <img src={photos[index]} alt={`Captured photo ${index + 1}`}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    style={{ filter: monochrome ? 'grayscale(1)' : undefined }} />
                                    : <span>Photo {index + 1}</span>}
                            </div>
                        ))}
                    </div>
                    {postcard && <div style={{ aspectRatio: `1080 / ${area.height + layout.gap}` }} />}
                    {!!design?.length && <svg viewBox={`0 0 ${layout.width - 2 * layout.border} ${editableHeight}`} className="pointer-events-none absolute overflow-hidden" style={{ left: '5%', width: '90%', top: `${area.top / height * 100}%`, height: `${editableHeight / height * 100}%` }} aria-label="Your strip decorations">
                        {design.map(raw => {
                            const item = constrainDesign(raw, 1080, editableHeight), bounds = designBounds(item)
                            return <g key={item.id} transform={`translate(${item.x * 10.8} ${editableHeight * item.y / 100}) rotate(${item.rotation ?? 0})`}>
                                {item.kind === 'image'
                                    ? <image href={item.value} x={-bounds.width / 2} y={-bounds.height / 2} width={bounds.width} height={bounds.height} preserveAspectRatio="xMidYMid meet" />
                                    : <text textAnchor="middle" y={item.size * 0.32} fontFamily={DESIGN_FONTS[item.font]} fontSize={item.size} textLength={bounds.width} lengthAdjust="spacingAndGlyphs" fill="#342b31">{item.value}</text>}
                            </g>
                        })}
                    </svg>}
                    {!postcard && <>
                    <div className="flex flex-col items-center justify-center text-center"
                        style={{ aspectRatio: `${layout.width - 2 * layout.border} / 360`,
                            color: frameColor === 'Black' ? 'white' : '#342b31' }}>
                        {caption && <p className="w-full truncate text-[10px] font-semibold">{caption}</p>}
                        {date && <p className="text-[8px]">{date}</p>}
                    </div>
                    <div style={{ aspectRatio: `${layout.width - 2 * layout.border} / ${layout.qrFooterHeight}` }} />
                    </>}
                    {postcard && <div className="relative text-center text-[#342b31]" style={{ aspectRatio: '1080 / 300' }}>
                        <div className="absolute left-0 top-1/4 w-1/2"><p className="text-[11px] font-semibold">SnapBerry</p><p className="text-[8px]">by FLEURA</p></div>
                        <img src={FLEURA_QR_IMAGE} alt="FLEURA Facebook QR code" className="absolute right-[10%] top-[4%] w-[19%]" />
                        <p className="absolute bottom-[4%] w-full text-[7px]">{FLEURA_QR_CAPTION}</p>
                    </div>}
                </div>
            )}
        </div>
    )
}






