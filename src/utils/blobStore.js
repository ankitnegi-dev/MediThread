// Attachments live in IndexedDB — localStorage caps out around 5 MB and is
// synchronous, which would freeze the UI. Records keep only a fileId pointer.

const DB_NAME = 'medithread-files'
const DB_VERSION = 1
const STORE = 'files'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB, so files cannot be stored.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Could not open the file store.'))
  })
  return dbPromise
}

function tx(mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        let result
        try {
          result = run(store)
        } catch (e) {
          reject(e)
          return
        }
        t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error || new Error('File store transaction aborted.'))
      })
  )
}

const newId = () => `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Store a File/Blob. Returns the metadata that goes on the record. */
export async function putFile(file) {
  const id = newId()
  const meta = { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, blob: file }
  await tx('readwrite', (store) => {
    store.put(meta)
    return meta
  })
  return { id, name: meta.name, type: meta.type, size: meta.size }
}

export async function getFile(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const req = t.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFile(id) {
  await tx('readwrite', (store) => { store.delete(id) })
}

export async function listFiles() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const req = t.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result || []).map(({ id, name, type, size }) => ({ id, name, type, size })))
    req.onerror = () => reject(req.error)
  })
}

export async function totalBytes() {
  const files = await listFiles()
  return files.reduce((n, f) => n + (f.size || 0), 0)
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

export async function getFileDataUrl(id) {
  const rec = await getFile(id)
  if (!rec) return null
  return blobToDataUrl(rec.blob)
}