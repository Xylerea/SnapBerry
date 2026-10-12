import { useRef, type PointerEvent } from 'react'
import { DESIGN_FONTS, DESIGN_HEIGHT, designBounds, constrainDesign, type DesignItem } from '../lib/stripDesign'

type Props = { width?: number; height?: number; items: DesignItem[]; selected: string | null; onSelect: (id: string) => void; onChange: (items: DesignItem[]) => void; onEditText?: (id: string) => void }
type Gesture = { item: DesignItem; pointer: number; clientX: number; clientY: number; mode: 'move' | 'resize' | 'rotate'; distance: number; angle: number; moved: boolean }
export default function DragDesignCanvas({ width = 1080, height = DESIGN_HEIGHT, items, selected, onSelect, onChange, onEditText }: Props) {
    const svg = useRef<SVGSVGElement>(null)
    const gesture = useRef<Gesture | null>(null)
    const lastTap = useRef<{ id: string; time: number } | null>(null)
    function point(event: PointerEvent<SVGGElement>) {
        const rect = svg.current!.getBoundingClientRect()
        return { x: (event.clientX - rect.left) / rect.width * width, y: (event.clientY - rect.top) / rect.height * height }
    }
    function start(event: PointerEvent<SVGGElement>, item: DesignItem, mode: Gesture['mode']) {
        if (gesture.current || (event.pointerType === 'mouse' && event.button !== 0)) return
        event.preventDefault(); event.stopPropagation(); onSelect(item.id)
        const p = point(event), dx = p.x - item.x * width / 100, dy = p.y - item.y / 100 * height
        event.currentTarget.setPointerCapture(event.pointerId)
        gesture.current = { item, pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, mode, distance: Math.max(1, Math.hypot(dx, dy)), angle: Math.atan2(dy, dx), moved: false }
    }
    function move(event: PointerEvent<SVGGElement>) {
        const g = gesture.current
        if (!g || g.pointer !== event.pointerId) return
        event.preventDefault()
        const rect = svg.current!.getBoundingClientRect(), p = point(event)
        const dx = p.x - g.item.x * width / 100, dy = p.y - g.item.y / 100 * height
        if (Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) > 5) g.moved = true
        let item = g.item
        if (g.mode === 'move') item = { ...item, x: item.x + (event.clientX - g.clientX) / rect.width * 100, y: item.y + (event.clientY - g.clientY) / rect.height * 100 }
        if (g.mode === 'resize') item = { ...item, size: item.size * Math.hypot(dx, dy) / g.distance }
        if (g.mode === 'rotate') item = { ...item, rotation: (item.rotation ?? 0) + (Math.atan2(dy, dx) - g.angle) * 180 / Math.PI }
        onChange(items.map(value => value.id === item.id ? constrainDesign(item, width, height) : value))
    }
    function finish(event: PointerEvent<SVGGElement>) {
        const g = gesture.current
        if (!g || g.pointer !== event.pointerId) return
        if (!g.moved && g.mode === 'move' && g.item.kind === 'text') {
            const time = event.timeStamp
            if (lastTap.current?.id === g.item.id && time - lastTap.current.time < 350) { onEditText?.(g.item.id); lastTap.current = null }
            else lastTap.current = { id: g.item.id, time }
        }
        gesture.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }
    return <svg ref={svg} viewBox={`0 0 ${width} ${height}`} className="block h-full w-full overflow-hidden" aria-label="Editable strip elements">
        {items.map(raw => {
            const item = constrainDesign(raw, width, height), bounds = designBounds(item), active = selected === item.id
            return <g key={item.id} transform={`translate(${item.x * width / 100} ${item.y / 100 * height}) rotate(${item.rotation ?? 0})`} role="button" tabIndex={0} aria-label={`Select ${item.kind === 'image' ? 'image' : item.value || 'text'}`} aria-pressed={active}
                style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab' }} onPointerDown={event => start(event, item, 'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null }} onLostPointerCapture={() => { gesture.current = null }}
                onKeyDown={event => {
                    if (event.key === 'Enter') { onSelect(item.id); if (item.kind === 'text') onEditText?.(item.id); return }
                    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
                    const delta = moves[event.key]; if (!delta) return
                    event.preventDefault(); onSelect(item.id); onChange(items.map(value => value.id === item.id ? constrainDesign({ ...item, x: item.x + delta[0], y: item.y + delta[1] }, width, height) : value))
                }}>
                <rect x={-Math.max(bounds.width, 160) / 2} y={-Math.max(bounds.height, 160) / 2} width={Math.max(bounds.width, 160)} height={Math.max(bounds.height, 160)} fill="transparent" />
                {item.kind === 'image' ? <image pointerEvents="none" href={item.value} x={-bounds.width / 2} y={-bounds.height / 2} width={bounds.width} height={bounds.height} preserveAspectRatio="xMidYMid meet" />
                    : <text pointerEvents="none" textAnchor="middle" y={item.size * 0.32} fontFamily={DESIGN_FONTS[item.font]} fontSize={item.size} textLength={bounds.width} lengthAdjust="spacingAndGlyphs" fill="#342b31">{item.value}</text>}
                {active && <>
                    <rect x={-bounds.width / 2} y={-bounds.height / 2} width={bounds.width} height={bounds.height} fill="none" stroke="#ec4899" strokeWidth={4} pointerEvents="none" />
                    {(['resize', 'rotate'] as const).map(mode => <g key={mode} role="button" aria-label={mode === 'resize' ? 'Resize element' : 'Rotate element'} onPointerDown={event => start(event, item, mode)} style={{ touchAction: 'none', cursor: mode === 'resize' ? 'nwse-resize' : 'crosshair' }}>
                        <circle cx={mode === 'resize' ? bounds.width / 2 : 0} cy={mode === 'resize' ? bounds.height / 2 : -bounds.height / 2 - 80} r={80} fill="transparent" />
                        <circle cx={mode === 'resize' ? bounds.width / 2 : 0} cy={mode === 'resize' ? bounds.height / 2 : -bounds.height / 2 - 80} r={32} fill="white" stroke="#ec4899" strokeWidth={6} />
                        <text pointerEvents="none" x={mode === 'resize' ? bounds.width / 2 : 0} y={(mode === 'resize' ? bounds.height / 2 : -bounds.height / 2 - 80) + 15} textAnchor="middle" fontSize={48} fill="#9d174d">{mode === 'resize' ? '↔' : '↻'}</text>
                    </g>)}
                </>}
            </g>
        })}
    </svg>
}
