import type { PaperSize } from '../lib/photoStrip'

type Props = { value?: PaperSize; onChange: (size: PaperSize) => void; disabled?: boolean }

export default function PaperSizeSelect({ value = '4R', onChange, disabled }: Props) {
    return <label className="paper-size-control">
        <span className="sr-only">Photo paper size</span>
        <select value={value} onChange={event => onChange(event.target.value === '3R' ? '3R' : '4R')} disabled={disabled}>
            <option value="4R">4R</option>
            <option value="3R">3R</option>
        </select>
    </label>
}
