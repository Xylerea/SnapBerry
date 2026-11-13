import { useEffect, useRef } from 'react'

type Props = { onKeep: () => void; onExit: () => void }

export default function ExitSessionDialog({ onKeep, onExit }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        const focus = document.activeElement
        const overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog?.showModal()
        return () => {
            dialog?.close()
            document.body.style.overflow = overflow
            if (focus instanceof HTMLElement && focus.isConnected) focus.focus()
        }
    }, [])

    return <dialog ref={dialogRef} className="exit-session-dialog" aria-labelledby="exit-session-title"
        aria-describedby="exit-session-description" onCancel={event => { event.preventDefault(); onKeep() }}>
        <h2 id="exit-session-title">Exit photo session?</h2>
        <p id="exit-session-description">Your captured photos will be lost.</p>
        <div className="exit-session-actions">
            <button type="button" className="exit-session-keep" autoFocus onClick={onKeep}>Keep Taking Photos</button>
            <button type="button" className="exit-session-confirm" onClick={onExit}>Exit Session</button>
        </div>
    </dialog>
}
