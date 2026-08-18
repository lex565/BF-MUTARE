import { mobileFail, mobileOk, mobileOptions, mobileUser } from '@/app/api/mobile/_lib'
import {
  DocumentError,
  uploadDocument,
  type DocumentKind,
} from '@/lib/platform/documents'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

/**
 * A photograph of an ID, taken on the phone that is uploading it.
 *
 * MULTIPART, NOT BASE64 IN JSON. Base64 inflates a photo by a third, and these
 * are being sent over mobile data in Mutare by somebody paying per megabyte.
 * The app also downscales before sending, so a 4MB camera photo arrives as a
 * few hundred KB.
 *
 * It goes to the same private bucket through the same `uploadDocument` as the
 * website, so the atomic-replacement guarantee and the audit trail apply
 * identically. There is deliberately no separate mobile path that could get
 * those wrong.
 */
export async function POST(request: Request) {
  const user = await mobileUser(request)
  if (!user) return mobileFail('UNAUTHENTICATED', 'Sign in first.', 401)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return mobileFail('BAD_REQUEST', 'Send the file as multipart form data.', 400)
  }

  const file = form.get('file')
  const applicationId = String(form.get('applicationId') ?? '')
  const kind = String(form.get('kind') ?? '') as DocumentKind

  if (!(file instanceof File) || file.size === 0) {
    return mobileFail('BAD_REQUEST', 'No file arrived.', 400)
  }

  try {
    await uploadDocument({ userId: user.id, applicationId, kind, file })
    return mobileOk({ uploaded: true, kind })
  } catch (error) {
    if (error instanceof DocumentError) {
      return mobileFail(
        error.code,
        error.message,
        error.code === 'NOT_FOUND' ? 404 : 400,
      )
    }
    throw error
  }
}
