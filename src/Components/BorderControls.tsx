import type { StripOptions } from '../lib/photoStrip'

type Props = { options: StripOptions; onChange: (options: StripOptions) => void; disabled?: boolean }

export default function BorderControls({ options, onChange, disabled }: Props) {
    const thickness = options.borderThickness ?? 0
    return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-2xl border border-pink-200 p-4">
        <legend className="px-1 text-sm font-semibold text-pink-700">Photo Frame Borders</legend>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-pink-700">
            Border Color
            <input type="color" value={options.borderColor ?? '#ffffff'}
                onChange={event => onChange({ ...options, borderColor: event.target.value })} className="h-11 w-14 shrink-0 cursor-pointer" />
        </label>
        <label className="block text-sm font-semibold text-pink-700">
            <span className="flex items-center justify-between gap-3">Border Thickness <output>{thickness.toFixed(1)} mm</output></span>
            <input type="range" min="0" max="5" step="0.1" value={thickness}
                onChange={event => onChange({ ...options, borderThickness: Number(event.target.value) })}
                aria-valuetext={`${thickness.toFixed(1)} millimetres`} className="mt-1 min-h-11 w-full accent-pink-600" />
        </label>
        <p className="text-xs font-normal text-gray-500">Applies inside every photo frame. Use 0 for backgrounds with built-in borders.</p>
    </fieldset>
}
