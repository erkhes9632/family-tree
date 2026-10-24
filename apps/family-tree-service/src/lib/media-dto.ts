import type { MediaDto } from '@super-project/types';
import type { MediaRow } from '../db/schema';
import { toPartialDate } from './mappers';
import type { Storage } from './storage';

export async function toMediaDto(m: MediaRow, personIds: string[], storage: Storage): Promise<MediaDto> {
  const ready = m.status === 'ready';
  const [url, thumbnailUrl] = await Promise.all([
    ready ? storage.getUrl(m.r2Key) : null,
    ready && m.thumbKey ? storage.getUrl(m.thumbKey) : null,
  ]);
  return {
    id: m.id,
    treeId: m.treeId,
    albumId: m.albumId,
    kind: m.kind,
    mimeType: m.mimeType,
    size: m.size,
    originalName: m.originalName,
    title: m.title,
    description: m.description,
    category: m.category,
    date: toPartialDate({ year: m.dateYear, month: m.dateMonth, day: m.dateDay, qualifier: m.dateQualifier }),
    place: m.place,
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    status: m.status,
    personIds,
    url,
    thumbnailUrl: thumbnailUrl ?? (m.kind === 'photo' ? url : null),
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt,
  };
}
