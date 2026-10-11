import { saveMoneyEntry, saveSettings } from '@/app/(app)/admin/actions'

// Forms that carry a photo post here as an ordinary browser form, not as a server action:
// on the live host the page did not move on after a server action with a file, so the entry
// looked unsaved. The same functions do the work; this only turns their redirect into a 303.
const FORMS: Record<string, (form: FormData) => Promise<void>> = { money: saveMoneyEntry, settings: saveSettings }

export async function POST(req: Request, ctx: RouteContext<'/api/form/[name]'>) {
  const { name } = await ctx.params
  const save = FORMS[name]
  if (!save) return new Response('Not found', { status: 404 })
  // Only this site's own pages may post here.
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new Response('Not allowed', { status: 403 })
  try {
    await save(await req.formData())
  } catch (e) {
    // redirect() throws an error whose digest is "NEXT_REDIRECT;<type>;<url>;<status>;"
    const digest = (e as { digest?: string }).digest ?? ''
    if (!digest.startsWith('NEXT_REDIRECT;')) throw e
    return new Response(null, { status: 303, headers: { Location: digest.split(';').slice(2, -2).join(';') } })
  }
  return new Response(null, { status: 303, headers: { Location: '/' } })
}
