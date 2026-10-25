// Embedded tags are read only when a file is actually imported: music-metadata is
// imported dynamically, so nothing on the reading surface pays for the parser.
export type MusicTags = { title?: string; artist?: string; album?: string; duration?: number; cover?: Blob }

// Some Chinese-tagged MP3s declare ID3v2.3 frames as ISO-8859-1 while the bytes are
// actually GBK, so the parser returns Latin-1 mojibake. Re-decoding the same bytes as
// GB18030 (which covers GBK) or UTF-8 recovers the original text; anything that
// already contains CJK, or that cannot be decoded either way, is returned untouched.
export function repairTagText(value?: string): string | undefined {
  if (!value) return undefined
  if (!/[\u0080-\u00ff]/.test(value) || /[\u4e00-\u9fff]/.test(value)) return value
  const bytes = Uint8Array.from(value, character => character.charCodeAt(0) & 0xff)
  for (const encoding of ['utf-8', 'gb18030'] as const) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: true }).decode(bytes)
      if (/[\u4e00-\u9fff]/.test(decoded)) return decoded
    } catch { /* Not that encoding; try the next one. */ }
  }
  return value
}

export async function readMusicTags(file: Blob): Promise<MusicTags> {
  const { parseBlob } = await import('music-metadata')
  const meta = await parseBlob(file)
  const picture = meta.common.picture?.[0]
  const duration = meta.format.duration
  return {
    title: repairTagText(meta.common.title?.trim()) || undefined,
    artist: repairTagText(meta.common.artist?.trim()) || undefined,
    album: repairTagText(meta.common.album?.trim()) || undefined,
    duration: typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : undefined,
    cover: picture && picture.data?.length ? new Blob([picture.data as BlobPart], { type: picture.format }) : undefined,
  }
}