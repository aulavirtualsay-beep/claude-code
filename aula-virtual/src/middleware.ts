import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Protege las rutas privadas: requiere sesión iniciada.
const RUTAS_PROTEGIDAS = ['/profesora', '/alumno'];
const RUTAS_AUTH = ['/login', '/registro'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const esProtegida = RUTAS_PROTEGIDAS.some((r) => pathname === r || pathname.startsWith(r + '/'));
  const esAuth = RUTAS_AUTH.some((r) => pathname === r || pathname.startsWith(r + '/'));
  if (!esProtegida && !esAuth) return NextResponse.next();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (esProtegida && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (esAuth && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/profesora/:path*', '/alumno/:path*', '/login', '/registro'],
};
