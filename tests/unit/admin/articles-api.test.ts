import { beforeEach, describe, expect, it, vi } from 'vitest'
import { articleCreateSchema, parseYoutubeId, slugifyTitle } from '~~/shared/schemas/admin-blog'

/**
 * POST /api/admin/articles — handler behaviour (401, 409, unknown
 * category, happy path incl. YouTube id normalisation) and the article
 * Zod schemas (validation errors, media allowlist rejection).
 *
 * Same stubbing pattern as categories-api.test.ts: Nitro auto-imports
 * become globals, the drizzle `db` becomes a tiny in-memory fake.
 */

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  readValidatedBody: vi.fn(),
  setResponseStatus: vi.fn(),
  /** Rows returned by each successive db.select(), in call order. */
  selectResults: [] as unknown[][],
  /** Every payload passed to insert().values(). */
  inserted: [] as unknown[],
}))

vi.mock('~~/server/database', () => {
  function selectChain() {
    const rows = mocks.selectResults.shift() ?? []
    const chain: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'innerJoin', 'leftJoin', 'groupBy']) {
      chain[method] = () => chain
    }
    chain.limit = () => Promise.resolve(rows)
    chain.orderBy = () => Promise.resolve(rows)
    return chain
  }

  const db = {
    select: () => selectChain(),
    insert: () => ({
      values: (rows: unknown) => {
        mocks.inserted.push(rows)
        return Object.assign(Promise.resolve(), {
          returning: () => Promise.resolve([{ id: 1 }]),
          onConflictDoUpdate: () => Promise.resolve(),
        })
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db),
  }
  return { db }
})

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAdmin', mocks.requireAdmin)
vi.stubGlobal('readValidatedBody', mocks.readValidatedBody)
vi.stubGlobal('setResponseStatus', mocks.setResponseStatus)
vi.stubGlobal(
  'createError',
  (input: { statusCode: number, statusMessage?: string }) =>
    Object.assign(new Error(input.statusMessage), input),
)

function validBody() {
  return {
    slug: 'nouvel-article',
    categorySlug: 'musees',
    status: 'draft' as const,
    publishedAt: '2026-07-01',
    readingMinutes: 4,
    heroImageUrl: 'https://picsum.photos/seed/test/1200/675',
    lines: ['A', 'D'],
    nearestStop: 'République',
    translations: [{
      locale: 'fr',
      title: 'Nouvel article',
      excerpt: 'Un extrait court.',
      outroTitle: 'Y aller',
      outroText: 'Descendez à République.',
      sections: [{ title: 'Section 1', body: 'Corps de la section.' }],
    }],
    gallery: [{ type: 'image' as const, src: 'https://picsum.photos/seed/g1/1200/675', alt: 'Vue 1' }],
  }
}

async function callCreate(body: unknown) {
  mocks.readValidatedBody.mockImplementation(async (_event: unknown, parse: (raw: unknown) => unknown) => parse(body))
  const { default: handler } = await import('~~/server/api/admin/articles/index.post')
  return (handler as unknown as (event: unknown) => Promise<unknown>)({})
}

describe('POST /api/admin/articles', () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue(undefined)
    mocks.readValidatedBody.mockReset()
    mocks.setResponseStatus.mockReset()
    mocks.selectResults.length = 0
    mocks.inserted.length = 0
  })

  it('rejects with 401 when the admin guard throws (no session)', async () => {
    mocks.requireAdmin.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))

    await expect(callCreate(validBody())).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.inserted).toHaveLength(0)
  })

  it('rejects with 400 when the category slug is unknown', async () => {
    mocks.selectResults.push([]) // category lookup finds nothing

    await expect(callCreate(validBody())).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.inserted).toHaveLength(0)
  })

  it('returns 409 when the article slug already exists', async () => {
    mocks.selectResults.push([{ id: 2 }]) // category found
    mocks.selectResults.push([{ id: 9 }]) // slug conflict found

    await expect(callCreate(validBody())).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.inserted).toHaveLength(0)
  })

  it('creates parent, translations, sections and media (happy path)', async () => {
    mocks.selectResults.push([{ id: 2 }]) // category found
    mocks.selectResults.push([]) // no slug conflict

    await expect(callCreate(validBody())).resolves.toEqual({ slug: 'nouvel-article' })
    expect(mocks.setResponseStatus).toHaveBeenCalledWith({}, 201)
    // parent + translations + sections + media
    expect(mocks.inserted).toHaveLength(4)
  })

  it('normalises a pasted YouTube URL to its bare video id', async () => {
    mocks.selectResults.push([{ id: 2 }])
    mocks.selectResults.push([])
    const body = validBody()
    body.gallery = [{ type: 'youtube' as never, src: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', alt: null as never }]

    await callCreate(body)

    const mediaRows = mocks.inserted.at(-1) as { src: string }[]
    expect(mediaRows[0]!.src).toBe('M7lc1UVf-VE')
  })
})

describe('article Zod schemas', () => {
  it('rejects an image URL that is not https on an allowlisted host', () => {
    for (const src of [
      'http://picsum.photos/seed/x/1200/675', // not https
      'https://evil.example.com/x.jpg', // host not allowlisted
      'not-a-url',
    ]) {
      const body = { ...validBody(), gallery: [{ type: 'image', src, alt: null }] }
      expect(articleCreateSchema.safeParse(body).success).toBe(false)
    }
  })

  it('rejects a youtube media without a parseable video id', () => {
    const body = { ...validBody(), gallery: [{ type: 'youtube', src: 'https://youtube.com/watch?v=nope' }] }
    expect(articleCreateSchema.safeParse(body).success).toBe(false)
  })

  it('rejects the reserved slug "new" and bad date formats', () => {
    expect(articleCreateSchema.safeParse({ ...validBody(), slug: 'new' }).success).toBe(false)
    expect(articleCreateSchema.safeParse({ ...validBody(), publishedAt: '01/07/2026' }).success).toBe(false)
  })

  it('rejects overlong SEO fields (60 / 160 chars)', () => {
    const body = validBody()
    body.translations[0] = { ...body.translations[0]!, seoTitle: 'x'.repeat(61) } as never
    expect(articleCreateSchema.safeParse(body).success).toBe(false)
  })

  it('parses every usual YouTube URL shape', () => {
    for (const src of [
      'M7lc1UVf-VE',
      'https://youtu.be/M7lc1UVf-VE',
      'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      'https://www.youtube.com/embed/M7lc1UVf-VE',
      'https://www.youtube.com/shorts/M7lc1UVf-VE',
    ]) {
      expect(parseYoutubeId(src)).toBe('M7lc1UVf-VE')
    }
    expect(parseYoutubeId('https://vimeo.com/12345')).toBeNull()
  })

  it('slugifies titles with accents and ligatures', () => {
    expect(slugifyTitle('Musée d’Art moderne — Œuvres !')).toBe('musee-d-art-moderne-oeuvres')
  })
})
