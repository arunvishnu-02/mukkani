import { NextResponse, type NextRequest } from 'next/server'

// Optimistic check only: pages verify the session and role themselves.
export function proxy(request: NextRequest) {
  if (!request.cookies.has('mk_session')) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|loc/|api/health|_next/|favicon.ico|icon|.*\\.(?:png|svg|jpg|ico)$).*)'],
}
