import { beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryCreateSchema, categoryDeleteQuerySchema } from '~~/shared/schemas/admin-blog'

/**
 * POST /api/admin/categories — handler behaviour (401, 409, happy path)
 * and the category Zod schemas (validation errors).
 *
 * Nitro auto-imports (requireAdmin, readValidatedBody…) are stubbed as
 * globals and the drizzle `db` is replaced by a tiny in-memory fake,
 * following the same pattern as require-admin.test.ts.
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
    slug: 'nouvelle-categorie',
    icon: 'mdi-tram',
    position: 3,
    translations: [{ locale: 'fr', name: 'Nouvelle catégorie' }],
  }
}

async function callCreate(body: unknown) {
  mocks.readValidatedBody.mockImplementation(async (_event: unknown, parse: (raw: unknown) => unknown) => parse(body))
  const { default: handler } = await import('~~/server/api/admin/categories/index.post')
  return (handler as unknown as (event: unknown) => Promise<unknown>)({})
}

describe('POST /api/admin/categories', () => {
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

  it('rejects invalid payloads (empty name)', async () => {
    const body = validBody()
    body.translations[0]!.name = ''

    await expect(callCreate(body)).rejects.toThrow()
    expect(mocks.inserted).toHaveLength(0)
  })

  it('returns 409 when the slug already exists', async () => {
    mocks.selectResults.push([{ id: 7 }]) // conflict check finds a row

    await expect(callCreate(validBody())).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.inserted).toHaveLength(0)
  })

  it('creates the parent row and its translations (happy path)', async () => {
    mocks.selectResults.push([]) // conflict check finds nothing

    await expect(callCreate(validBody())).resolves.toEqual({ slug: 'nouvelle-categorie' })
    expect(mocks.setResponseStatus).toHaveBeenCalledWith({}, 201)
    expect(mocks.inserted).toHaveLength(2) // parent + translations
    expect(mocks.inserted[1]).toEqual([{ categoryId: 1, locale: 'fr', name: 'Nouvelle catégorie' }])
  })
})

describe('category Zod schemas', () => {
  it('rejects an uppercase or accented slug', () => {
    expect(categoryCreateSchema.safeParse({ ...validBody(), slug: 'Musées' }).success).toBe(false)
  })

  it('rejects the reserved slug "new"', () => {
    expect(categoryCreateSchema.safeParse({ ...validBody(), slug: 'new' }).success).toBe(false)
  })

  it('rejects a non-MDI icon name', () => {
    expect(categoryCreateSchema.safeParse({ ...validBody(), icon: 'fa-tram' }).success).toBe(false)
  })

  it('rejects two translations for the same locale', () => {
    const body = {
      ...validBody(),
      translations: [
        { locale: 'fr', name: 'A' },
        { locale: 'fr', name: 'B' },
      ],
    }
    expect(categoryCreateSchema.safeParse(body).success).toBe(false)
  })

  it('accepts an optional reassignTo slug on delete', () => {
    expect(categoryDeleteQuerySchema.safeParse({}).success).toBe(true)
    expect(categoryDeleteQuerySchema.safeParse({ reassignTo: 'musees' }).success).toBe(true)
    expect(categoryDeleteQuerySchema.safeParse({ reassignTo: 'Bad Slug' }).success).toBe(false)
  })
})
