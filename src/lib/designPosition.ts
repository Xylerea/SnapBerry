export function dragPosition(start: { x: number; y: number }, dx: number, dy: number, width: number, height: number) {
    return { x: Math.max(10, Math.min(90, start.x + dx / width * 100)), y: Math.max(10, Math.min(90, start.y + dy / height * 100)) }
}


