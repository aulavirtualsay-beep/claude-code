import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente Supabase para RSC / rutas de API (lee sesión desde cookies)
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: se ignora si hay middleware
            // actualizando la sesión.
          }
        },
      },
    }
  );
}

// Cliente con service_role: SOLO en el servidor. Nunca importar desde
// componentes de cliente ('use client'). Se usa en rutas /api/* para tareas
// administrativas y verificación de códigos de acceso.
export function createAdminClient() {
  const { createClient: createRaw } = require('@supabase/supabase-js');
  return createRaw(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
