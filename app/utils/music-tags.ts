// Embedded tags are read only when a file is actually imported: music-metadata is
// imported dynamically, so nothing on the reading surface pays for the parser.
export type MusicTags = { title?: string; artist?: string; album?: string; duration?: number; cover?: Blob }

export async function readMusicTags(file: Blob): Promise<MusicTags> {
  const { parseBlob } = await import('music-metadata')
  const meta = await parseBlob(file)
  const picture = meta.common.picture?.[0]
  const duration = meta.format.duration
  return {
    title: meta.common.title?.trim() || undefined,
    artist: meta.common.artist?.trim() || undefined,
    album: meta.common.album?.trim() || undefined,
    duration: typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : undefined,
    cover: picture && picture.data?.length ? new Blob([picture.data as BlobPart], { type: picture.format }) : undefined,
  }
}