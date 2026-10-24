import { Hono } from 'hono';
import { and, count, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  albumInputSchema,
  completeUploadSchema,
  createUploadSchema,
  MEDIA_LIMITS,
  mediaListQuerySchema,
  MULTIPART_PART_SIZE,
  MULTIPART_THRESHOLD,
  multipartPartsSchema,
  storyInputSchema,
  updateMediaSchema,
  type AlbumDto,
  type CreateUploadResponse,
  type StoryDto,
} from '@super-project/types';
import type { AppEnv } from '../env';
import type { Database } from '../db';
import { albums, media, mediaPersons, persons, stories, type MediaRow } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { auditQuery } from '../lib/audit';
import { badRequest, conflict, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { dateCols, toPartialDate } from '../lib/mappers';
import { toMediaDto } from '../lib/media-dto';
import { createStorage } from '../lib/storage';
import { requireTree } from '../lib/tree-access';
import { v } from '../lib/validate';

export const mediaRoutes = new Hono<AppEnv>();

function safeName(name: string) {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  return ext ? `original.${ext}` : 'original';
}

async function personIdsFor(db: Database, mediaIds: string[]) {
  const map = new Map<string, string[]>();
  // stay under D1's 100-parameter limit
  for (let i = 0; i < mediaIds.length; i += 90) {
    const chunk = mediaIds.slice(i, i + 90);
    const rows = await db.select().from(mediaPersons).where(inArray(mediaPersons.mediaId, chunk));
    for (const r of rows) map.set(r.mediaId, [...(map.get(r.mediaId) ?? []), r.personId]);
  }
  return map;
}

async function validPersonIds(db: Database, treeId: string, ids: string[]) {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  let found = 0;
  for (let i = 0; i < unique.length; i += 90) {
    const rows = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.treeId, treeId), inArray(persons.id, unique.slice(i, i + 90))));
    found += rows.length;
  }
  if (found !== unique.length) throw badRequest('Some tagged people are not in this tree');
  return unique;
}

async function requireMedia(db: Database, treeId: string, id: string): Promise<MediaRow> {
  const m = await db.query.media.findFirst({ where: and(eq(media.id, id), eq(media.treeId, treeId)) });
  if (!m) throw notFound('Media');
  return m;
}

mediaRoutes.get('/trees/:treeId/media', v('query', mediaListQuerySchema), async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const q = c.req.valid('query');
  const [curAt, curId] = q.cursor?.split(':') ?? [];
  const rows = await db
    .select()
    .from(media)
    .where(
      and(
        eq(media.treeId, tree.id),
        eq(media.status, 'ready'),
        q.kind ? eq(media.kind, q.kind) : undefined,
        q.albumId ? eq(media.albumId, q.albumId) : undefined,
        q.category ? eq(media.category, q.category) : undefined,
        q.personId ? sql`${media.id} in (select ${mediaPersons.mediaId} from ${mediaPersons} where ${mediaPersons.personId} = ${q.personId})` : undefined,
        q.cursor ? or(lt(media.createdAt, Number(curAt)), and(eq(media.createdAt, Number(curAt)), lt(media.id, curId))) : undefined,
      ),
    )
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const tags = await personIdsFor(db, page.map((m) => m.id));
  const storage = createStorage(c.env);
  const items = await Promise.all(page.map((m) => toMediaDto(m, tags.get(m.id) ?? [], storage)));
  const last = page[page.length - 1];
  return c.json({ items, nextCursor: rows.length > q.limit && last ? `${last.createdAt}:${last.id}` : null });
});

mediaRoutes.post('/trees/:treeId/media/uploads', requireAuth, rateLimit('UPLOAD_LIMITER'), v('json', createUploadSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const body = c.req.valid('json');
  const limits = MEDIA_LIMITS[body.kind];
  const mime = body.mimeType.split(';')[0].trim().toLowerCase();
  if (!limits.mime.includes(mime)) throw badRequest(`File type ${mime} is not allowed for ${body.kind}`);
  if (body.size > limits.maxBytes) throw badRequest(`File is too large (max ${Math.round(limits.maxBytes / 1024 / 1024)} MB)`);
  if (body.albumId && !(await db.query.albums.findFirst({ where: and(eq(albums.id, body.albumId), eq(albums.treeId, tree.id)) }))) {
    throw badRequest('albumId is not in this tree');
  }
  const tagged = await validPersonIds(db, tree.id, body.personIds);

  const id = newId();
  const prefix = `trees/${tree.id}/${id}`;
  const r2Key = `${prefix}/${safeName(body.fileName)}`;
  const thumbKey = body.withThumbnail ? `${prefix}/thumb.webp` : null;
  const storage = createStorage(c.env);
  const multipart = body.size > MULTIPART_THRESHOLD;
  const uploadId = multipart ? await storage.createMultipart(r2Key, mime) : null;

  const [[row]] = await db.batch([
    db
      .insert(media)
      .values({
        id,
        treeId: tree.id,
        albumId: body.albumId ?? null,
        kind: body.kind,
        r2Key,
        thumbKey,
        mimeType: mime,
        size: body.size,
        originalName: body.fileName.slice(0, 255),
        title: body.title ?? null,
        description: body.description ?? null,
        category: body.category,
        ...dateCols('date', body.date),
        place: body.place ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        durationSec: body.durationSec ?? null,
        status: 'pending',
        uploadId,
        uploadedBy: me,
      })
      .returning(),
    ...tagged.map((personId) => db.insert(mediaPersons).values({ mediaId: id, personId })),
  ]);

  const res: CreateUploadResponse = {
    media: await toMediaDto(row, tagged, storage),
    upload: multipart ? null : await storage.putTarget(r2Key, mime),
    multipart: uploadId ? { uploadId, partSize: MULTIPART_PART_SIZE, partCount: Math.ceil(body.size / MULTIPART_PART_SIZE) } : null,
    thumbnail: thumbKey ? await storage.putTarget(thumbKey, 'image/webp') : null,
  };
  return c.json(res, 201);
});

mediaRoutes.post('/trees/:treeId/media/:mediaId/parts', requireAuth, v('json', multipartPartsSchema), async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'edit');
  const m = await requireMedia(db, tree.id, c.req.param('mediaId'));
  const { uploadId, partNumbers } = c.req.valid('json');
  if (m.status !== 'pending' || m.uploadId !== uploadId) throw conflict('No such upload in progress');
  const storage = createStorage(c.env);
  const parts = await Promise.all(partNumbers.map(async (n) => ({ partNumber: n, ...(await storage.partTarget(m.r2Key, uploadId, n)) })));
  return c.json({ parts });
});

mediaRoutes.post('/trees/:treeId/media/:mediaId/complete', requireAuth, v('json', completeUploadSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const m = await requireMedia(db, tree.id, c.req.param('mediaId'));
  if (m.status === 'ready') return c.json(await toMediaDto(m, [], createStorage(c.env)));
  const body = c.req.valid('json');
  const storage = createStorage(c.env);
  if (m.uploadId) {
    if (body.uploadId !== m.uploadId || !body.parts?.length) throw badRequest('uploadId and parts are required');
    await storage.completeMultipart(m.r2Key, m.uploadId, body.parts);
  }
  const head = await c.env.MEDIA.head(m.r2Key);
  if (!head) throw conflict('The file has not been uploaded yet');
  if (head.size > MEDIA_LIMITS[m.kind].maxBytes) {
    await c.env.MEDIA.delete(m.r2Key);
    throw badRequest('Uploaded file exceeds the size limit');
  }
  const thumbExists = m.thumbKey ? !!(await c.env.MEDIA.head(m.thumbKey)) : false;
  const [[row]] = await db.batch([
    db
      .update(media)
      .set({ status: 'ready', size: head.size, uploadId: null, thumbKey: thumbExists ? m.thumbKey : null })
      .where(eq(media.id, m.id))
      .returning(),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'media', entityId: m.id, action: 'create', after: { kind: m.kind, title: m.title, originalName: m.originalName }, summary: m.title ?? m.originalName }),
  ]);
  const tags = await personIdsFor(db, [m.id]);
  return c.json(await toMediaDto(row, tags.get(m.id) ?? [], storage));
});

mediaRoutes.get('/trees/:treeId/media/:mediaId', async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const m = await requireMedia(db, tree.id, c.req.param('mediaId'));
  const tags = await personIdsFor(db, [m.id]);
  return c.json(await toMediaDto(m, tags.get(m.id) ?? [], createStorage(c.env)));
});

/** Redirect to a short-lived download URL (keeps the original file name). */
mediaRoutes.get('/trees/:treeId/media/:mediaId/download', async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const m = await requireMedia(db, tree.id, c.req.param('mediaId'));
  if (m.status !== 'ready') throw conflict('Upload not finished');
  const url = await createStorage(c.env).getUrl(m.r2Key, { download: m.originalName });
  // browsers can't attach the bearer token to a plain link, so the web app asks for JSON and navigates itself
  return c.req.query('format') === 'json' ? c.json({ url }) : c.redirect(url, 302);
});

mediaRoutes.patch('/trees/:treeId/media/:mediaId', requireAuth, v('json', updateMediaSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const m = await requireMedia(db, tree.id, c.req.param('mediaId'));
  const body = c.req.valid('json');
  const { personIds, date, ...rest } = body;
  if (rest.albumId && !(await db.query.albums.findFirst({ where: and(eq(albums.id, rest.albumId), eq(albums.treeId, tree.id)) }))) {
    throw badRequest('albumId is not in this tree');
  }
  const tagged = personIds ? await validPersonIds(db, tree.id, personIds) : null;
  const before = { title: m.title, description: m.description, category: m.category, place: m.place, albumId: m.albumId, date: toPartialDate({ year: m.dateYear, month: m.dateMonth, day: m.dateDay, qualifier: m.dateQualifier }) };
  await db.batch([
    db.update(media).set({ ...rest, ...('date' in body ? dateCols('date', date) : {}) }).where(eq(media.id, m.id)),
    ...(tagged
      ? [db.delete(mediaPersons).where(eq(mediaPersons.mediaId, m.id)), ...tagged.map((personId) => db.insert(mediaPersons).values({ mediaId: m.id, personId }))]
      : []),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'media', entityId: m.id, action: 'update', before, after: body }),
  ]);
  const fresh = await requireMedia(db, tree.id, m.id);
  const tags = await personIdsFor(db, [m.id]);
  return c.json(await toMediaDto(fresh, tags.get(m.id) ?? [], createStorage(c.env)));
});

mediaRoutes.delete('/trees/:treeId/media/:mediaId', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const m = await requireMedia(db, tree.id, c.req.param('mediaId'));
  await db.batch([
    db.delete(media).where(eq(media.id, m.id)),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'media', entityId: m.id, action: 'delete', before: { title: m.title, originalName: m.originalName, kind: m.kind } }),
  ]);
  const storage = createStorage(c.env);
  c.executionCtx.waitUntil(
    (async () => {
      if (m.uploadId) await storage.abortMultipart(m.r2Key, m.uploadId).catch(() => undefined);
      await c.env.MEDIA.delete([m.r2Key, ...(m.thumbKey ? [m.thumbKey] : [])]);
    })(),
  );
  return c.body(null, 204);
});

// ── Albums ───────────────────────────────────────────────────────────

mediaRoutes.get('/trees/:treeId/albums', async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const rows = await db
    .select({
      a: albums,
      n: sql<number>`(select count(*) from ${media} where ${media.albumId} = ${albums.id} and ${media.status} = 'ready')`,
      cover: sql<string | null>`coalesce(
        (select coalesce(${media.thumbKey}, ${media.r2Key}) from ${media} where ${media.id} = ${albums.coverMediaId} and ${media.kind} = 'photo'),
        (select coalesce(${media.thumbKey}, ${media.r2Key}) from ${media} where ${media.albumId} = ${albums.id} and ${media.kind} = 'photo' and ${media.status} = 'ready' order by ${media.createdAt} desc limit 1))`,
    })
    .from(albums)
    .where(eq(albums.treeId, tree.id))
    .orderBy(desc(albums.createdAt));
  const storage = createStorage(c.env);
  const out: AlbumDto[] = await Promise.all(
    rows.map(async ({ a, n, cover }) => ({
      id: a.id,
      treeId: a.treeId,
      title: a.title,
      description: a.description,
      coverMediaId: a.coverMediaId,
      coverUrl: cover ? await storage.getUrl(cover) : null,
      mediaCount: n,
      createdAt: a.createdAt,
    })),
  );
  return c.json(out);
});

mediaRoutes.post('/trees/:treeId/albums', requireAuth, v('json', albumInputSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const body = c.req.valid('json');
  const [row] = await db.insert(albums).values({ ...body, treeId: tree.id, createdBy: me }).returning();
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'album', entityId: row.id, action: 'create', after: body, summary: body.title });
  return c.json(row, 201);
});

mediaRoutes.patch('/trees/:treeId/albums/:id', requireAuth, v('json', albumInputSchema.partial()), async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'edit');
  const [row] = await db
    .update(albums)
    .set(c.req.valid('json'))
    .where(and(eq(albums.id, c.req.param('id')), eq(albums.treeId, tree.id)))
    .returning();
  if (!row) throw notFound('Album');
  return c.json(row);
});

/** Deleting an album keeps its media (they become unfiled). */
mediaRoutes.delete('/trees/:treeId/albums/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const res = await db.delete(albums).where(and(eq(albums.id, c.req.param('id')), eq(albums.treeId, tree.id))).returning();
  if (!res.length) throw notFound('Album');
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'album', entityId: res[0].id, action: 'delete', before: { title: res[0].title } });
  return c.body(null, 204);
});

// ── Stories (audio / written) ────────────────────────────────────────

async function toStoryDtos(c: { env: AppEnv['Bindings'] }, db: Database, rows: (typeof stories.$inferSelect)[]): Promise<StoryDto[]> {
  const mediaIds = rows.map((r) => r.mediaId).filter((x): x is string => !!x);
  const mediaRows = mediaIds.length ? await db.select().from(media).where(inArray(media.id, mediaIds.slice(0, 90))) : [];
  const storage = createStorage(c.env);
  const byId = new Map(await Promise.all(mediaRows.map(async (m) => [m.id, await toMediaDto(m, [], storage)] as const)));
  return rows.map((s) => ({
    id: s.id,
    treeId: s.treeId,
    personId: s.personId,
    title: s.title,
    description: s.description,
    body: s.body,
    mediaId: s.mediaId,
    media: s.mediaId ? (byId.get(s.mediaId) ?? null) : null,
    date: toPartialDate({ year: s.dateYear, month: s.dateMonth, day: s.dateDay, qualifier: s.dateQualifier }),
    createdBy: s.createdBy,
    createdAt: s.createdAt,
  }));
}

mediaRoutes.get('/trees/:treeId/stories', async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const personId = c.req.query('personId');
  const rows = await db
    .select()
    .from(stories)
    .where(and(eq(stories.treeId, tree.id), personId ? eq(stories.personId, personId) : undefined))
    .orderBy(desc(stories.createdAt))
    .limit(60);
  return c.json(await toStoryDtos(c, db, rows));
});

async function checkStoryRefs(db: Database, treeId: string, personId?: string | null, mediaId?: string | null) {
  if (personId && !(await db.query.persons.findFirst({ where: and(eq(persons.id, personId), eq(persons.treeId, treeId)) }))) {
    throw badRequest('personId is not in this tree');
  }
  if (mediaId && !(await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.treeId, treeId)) }))) {
    throw badRequest('mediaId is not in this tree');
  }
}

mediaRoutes.post('/trees/:treeId/stories', requireAuth, v('json', storyInputSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const { date, ...body } = c.req.valid('json');
  await checkStoryRefs(db, tree.id, body.personId, body.mediaId);
  const [row] = await db.insert(stories).values({ ...body, ...dateCols('date', date), treeId: tree.id, createdBy: me }).returning();
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'story', entityId: row.id, action: 'create', after: { title: body.title }, summary: body.title });
  return c.json((await toStoryDtos(c, db, [row]))[0], 201);
});

mediaRoutes.patch('/trees/:treeId/stories/:id', requireAuth, v('json', storyInputSchema.partial()), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const body = c.req.valid('json');
  const { date, ...rest } = body;
  await checkStoryRefs(db, tree.id, rest.personId, rest.mediaId);
  const [row] = await db
    .update(stories)
    .set({ ...rest, ...('date' in body ? dateCols('date', date) : {}) })
    .where(and(eq(stories.id, c.req.param('id')), eq(stories.treeId, tree.id)))
    .returning();
  if (!row) throw notFound('Story');
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'story', entityId: row.id, action: 'update', after: body });
  return c.json((await toStoryDtos(c, db, [row]))[0]);
});

mediaRoutes.delete('/trees/:treeId/stories/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const res = await db.delete(stories).where(and(eq(stories.id, c.req.param('id')), eq(stories.treeId, tree.id))).returning();
  if (!res.length) throw notFound('Story');
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'story', entityId: res[0].id, action: 'delete', before: { title: res[0].title } });
  return c.body(null, 204);
});

/** Media count per person, for profile badges. */
mediaRoutes.get('/trees/:treeId/persons/:personId/media-count', async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const [{ n }] = await db
    .select({ n: count() })
    .from(mediaPersons)
    .innerJoin(media, eq(media.id, mediaPersons.mediaId))
    .where(and(eq(mediaPersons.personId, c.req.param('personId')), eq(media.treeId, tree.id), eq(media.status, 'ready')));
  return c.json({ count: n });
});
