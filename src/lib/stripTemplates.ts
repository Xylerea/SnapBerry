import type { StripOptions } from './photoStrip'

export type StripTemplate = {
    id: string
    name: string
    settings: Pick<StripOptions, 'layout' | 'background' | 'backgroundImage' | 'frameColor' | 'design'>
}

function openTemplates(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        let blocked = false
        const request = indexedDB.open('snapberry-templates', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('templates', { keyPath: 'id' })
        request.onerror = () => reject(request.error)
        request.onblocked = () => { blocked = true; reject(new Error('Close other SnapBerry tabs and try again.')) }
        request.onsuccess = () => {
            const database = request.result
            if (blocked) { database.close(); return }
            database.onversionchange = () => database.close()
            resolve(database)
        }
    })
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await openTemplates()
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = database.transaction('templates', mode)
            const request = operation(tx.objectStore('templates'))
            tx.oncomplete = () => resolve(request.result)
            tx.onabort = () => reject(tx.error ?? request.error ?? new Error('Unable to store templates.'))
            tx.onerror = () => reject(tx.error ?? request.error)
        })
    } finally { database.close() }
}

export const listTemplates = () => transaction<StripTemplate[]>('readonly', store => store.getAll())
export const saveTemplate = (template: StripTemplate) => transaction('readwrite', store => store.put(template))
export const deleteTemplate = (id: string) => transaction('readwrite', store => store.delete(id))
