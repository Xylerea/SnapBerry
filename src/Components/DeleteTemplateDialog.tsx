import { useEffect, useRef } from 'react'

type Props = { count: number; busy: boolean; onCancel: () => void; onDelete: () => void }

export default function DeleteTemplateDialog({ count, busy, onCancel, onDelete }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        const dialog = dialogRef.current, focus = document.activeElement, overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog?.showModal()
        return () => {
            dialog?.close()
            document.body.style.overflow = overflow
            if (focus instanceof HTMLElement && focus.isConnected) focus.focus()
        }
    }, [])

    return <dialog ref={dialogRef} className="delete-template-dialog" aria-labelledby="delete-template-title" aria-describedby="delete-template-description"
        onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
        <h2 id="delete-template-title" className="text-xl font-bold text-pink-600">{count === 1 ? 'Delete template?' : 'Delete templates?'}</h2>
        <p id="delete-template-description">{count === 1 ? 'This custom template will' : `These ${count} custom templates will`} be permanently deleted from this browser.</p>
        <div className="delete-template-actions">
            <button type="button" className="layout-details-save" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
            <button type="button" className="layout-details-continue" disabled={busy} onClick={onDelete}>{busy ? 'Deleting…' : 'Delete'}</button>
        </div>
    </dialog>
}
