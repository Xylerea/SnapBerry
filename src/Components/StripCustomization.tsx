import { CAPTION_LIMIT, FRAME_COLORS, type StripOptions } from '../lib/photoStrip'

type Props = {
    options: StripOptions
    onChange: (options: StripOptions) => void
}

const choiceClass = 'min-h-12 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600'

export default function StripCustomization({ options, onChange }: Props) {
    return (
        <section aria-labelledby="customize-heading" className="min-w-0 rounded-2xl bg-white p-3 sm:p-5">
            <h2 id="customize-heading" className="text-lg font-bold text-pink-600">Make it yours</h2>
            <fieldset className="mt-4">
                <legend className="mb-2 font-semibold">Frame Color</legend>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(FRAME_COLORS).map(([name, color]) => (
                        <button key={name} type="button" aria-pressed={options.frameColor === name}
                            onClick={() => onChange({ ...options, frameColor: name as StripOptions['frameColor'] })}
                            className={`${choiceClass} ${options.frameColor === name ? 'border-pink-600 ring-2 ring-pink-100' : 'border-gray-200'}`}
                            style={{ backgroundColor: color, color: name === 'Black' ? 'white' : '#342b31' }}>{name}</button>
                    ))}
                </div>
            </fieldset>
            <label htmlFor="strip-caption" className="mt-4 block font-semibold">Caption <span className="text-xs font-normal text-gray-500">(optional)</span></label>
            <input id="strip-caption" value={options.caption} maxLength={CAPTION_LIMIT} placeholder="A sweet memory"
                onChange={event => onChange({ ...options, caption: event.target.value })}
                aria-describedby="caption-help" className="mt-2 min-h-12 w-full rounded-xl border border-pink-200 px-3 text-base focus:outline-pink-600" />
            <p id="caption-help" className="mt-1 text-xs text-gray-500">Up to {CAPTION_LIMIT} characters.</p>
        </section>
    )
}
