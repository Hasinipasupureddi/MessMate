import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';

const PUBLIC_PATH_PREFIXES = [
  '/api/auth',
  '/guide',
  '/login',
  '/privacy-policy',
  '/sign-up-login-screen',
  '/terms',
  '/_next',
  '/favicon.ico',
];

const ROLE_GATES: Array<{ prefix: string; role: 'student' | 'staff' | 'warden' }> = [
  { prefix: '/student-dashboard', role: 'student' },
  { prefix: '/mess-staff-dashboard', role: 'staff' },
  { prefix: '/warden-analytics', role: 'warden' },
];

const PROTECTED_PREFIXES = ['/profile'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV === 'production' && pathname === '/dev/socket-test') {
    return new NextResponse(null, { status: 404 });
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const gatedRole = ROLE_GATES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  const needsAuth =
    Boolean(gatedRole) ||
    PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get('messmate_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/sign-up-login-screen', request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const response = NextResponse.redirect(new URL('/sign-up-login-screen', request.url));
    response.cookies.delete('messmate_session');
    return response;
  }

  if (gatedRole && session.role !== gatedRole.role) {
    const targetByRole: Record<'student' | 'staff' | 'warden', string> = {
      student: '/student-dashboard',
      staff: '/mess-staff-dashboard',
      warden: '/warden-analytics',
    };
    return NextResponse.redirect(new URL(targetByRole[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
