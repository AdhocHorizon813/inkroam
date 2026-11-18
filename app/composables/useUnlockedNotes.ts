import { shallowRef } from 'vue'
import type { PrivateNoteMetadata } from '~/utils/private-note-metadata'

type UnlockedNote = { id: string; path: string; source: string; metadata: PrivateNoteMetadata }
// Client-only writes. Never use useState/useAsyncData or serialize this memory to storage.
const documents = shallowRef<Record<string, UnlockedNote>>({})
let listening = false
let revision = 0

export function useUnlockedNotes() {
  function lockAll() { revision++; documents.value = {} }
  if (import.meta.client && !listening) {
    listening = true
    window.addEventListener('pagehide', lockAll)
  }
  function remember(note: UnlockedNote) {
    if (!import.meta.client) throw new Error('Client-only document')
    documents.value = { ...documents.value, [note.id]: note }
  }
  function lock(id: string) {
    const next = { ...documents.value }
    delete next[id]
    documents.value = next
  }
  function displayEntry<T extends { path: string }>(entry: T): T {
    const note = Object.values(documents.value).find(item => item.path === entry.path)
    return note ? { ...entry, ...note.metadata } : entry
  }
  return { documents, remember, lock, lockAll, displayEntry, revision: () => revision }
}
