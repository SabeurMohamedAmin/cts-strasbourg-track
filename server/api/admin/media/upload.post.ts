import type { H3Event } from 'h3'
import { createHash } from 'node:crypto'
import { z } from 'zod'

/**
 * POST /api/admin/media/upload — hosts an image on Cloudinary and
 * returns its https delivery URL (res.cloudinary.com, allowlisted in
 * shared/schemas/admin-blog.ts).
 *
 * Two input shapes, one endpoint:
 *   - multipart/form-data with a `file` part → upload from the device
 *   - JSON { url }                           → Cloudinary fetches the
 *     remote image itself (no download through our server)
 *
 * Why the signature is computed here: signed uploads require the API
 * secret, which must never reach the browser — so the editor talks to
 * this endpoint only, and this endpoint talks to Cloudinary.
 * https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 Mo

/** JSON body of the remote-import variant. */
const importSchema = z.object({
  url: z.string().url('URL invalide').startsWith('https://', 'URL https requise'),
})

/** The only fields we read from Cloudinary's response. */
interface CloudinaryUploadResponse {
  secure_url: string
  width: number
  height: number
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig(event)
  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    // Deployment error, not a user error — surface it in the server logs.
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary n’est pas configuré' })
  }

  // Data URI (local file) or remote URL — the same Cloudinary call for both.
  const file = await readUploadSource(event)

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = config.cloudinaryFolder

  // Signature: sha1 of the alphabetically sorted params + the API secret.
  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${config.cloudinaryApiSecret}`)
    .digest('hex')

  const body = new FormData()
  body.append('file', file)
  body.append('api_key', config.cloudinaryApiKey)
  body.append('timestamp', String(timestamp))
  body.append('folder', folder)
  body.append('signature', signature)

  try {
    const uploaded = await $fetch<CloudinaryUploadResponse>(
      `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`,
      { method: 'POST', body },
    )
    return { url: uploaded.secure_url, width: uploaded.width, height: uploaded.height }
  }
  catch (error) {
    console.error('[admin] cloudinary upload failed:', error)
    throw createError({ statusCode: 502, statusMessage: 'L’envoi vers Cloudinary a échoué' })
  }
})

/**
 * Extracts what Cloudinary should ingest: a base64 data URI when a
 * file was posted, or the remote URL from the JSON body otherwise.
 */
async function readUploadSource(event: H3Event): Promise<string> {
  const contentType = getHeader(event, 'content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const filePart = parts?.find(part => part.name === 'file')

    if (!filePart?.data?.length) {
      throw createError({ statusCode: 400, statusMessage: 'Aucun fichier reçu' })
    }
    if (!filePart.type?.startsWith('image/')) {
      throw createError({ statusCode: 400, statusMessage: 'Seules les images sont acceptées' })
    }
    if (filePart.data.length > MAX_FILE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Image trop lourde (10 Mo maximum)' })
    }

    return `data:${filePart.type};base64,${filePart.data.toString('base64')}`
  }

  const { url } = await readValidatedBody(event, importSchema.parse)
  return url
}
