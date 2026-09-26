import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { AppSession, Profile, Rol, School } from '@/lib/types';

export const COLEGIO_ISABEL = 'Colegio Isabel de Jesús Chacón';
export const COLEGIO_PANCHITA = 'Colegio Panchita Soublette';

// Normaliza correos para comparaciones seguras
export function normEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

// Determina el rol esperado según los correos autorizados por variables de entorno.
// La verificación definitiva ocurre en el servidor + RLS; aquí solo se clasifica.
export function rolEsperadoPorCorreo(email: string): Rol | null {
  const e = normEmail(email);
  if (!e) return null;
  if (e === normEmail(process.env.TEACHER_EMAIL)) return 'profesora';
  if (e === normEmail(process.env.DEVELOPER_EMAIL)) return 'admin_tecnico';
  return null;
}

/**
 * Obtiene la sesión enriquecida del usuario autenticado.
 * Devuelve null si no hay sesión. Lanza redirección en las rutas que la usen.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  const p = profile as Profile;

  // El administrador técnico y la profesora ven ambos colegios;
  // el alumno solo ve su colegio.
  let schools: School[] = [];
  if (p.rol === 'alumno') {
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (student) {
      const { data: school } = await supabase
        .from('schools')
        .select('*')
        .eq('id', student.school_id)
        .single();
      if (school) schools = [school as School];
      return { profile: p, student: student as AppSession['student'], schools };
    }
    return { profile: p, student: null, schools: [] };
  }

  const { data: allSchools } = await supabase
    .from('schools')
    .select('*')
    .order('nombre');
  schools = (allSchools ?? []) as School[];
  return { profile: p, student: null, schools };
}

/**
 * Verificación estricta de que el usuario actual es la profesora autorizada.
 * Se usa en TODAS las rutas API administrativas (no basta con ocultar botones).
 */
export async function requireTeacher(): Promise<
  { ok: true; profile: Profile } | { ok: false; error: string; status: number }
> {
  const session = await getAppSession();
  if (!session) return { ok: false, error: 'Debe iniciar sesión.', status: 401 };
  if (session.profile.rol !== 'profesora' && session.profile.rol !== 'admin_tecnico') {
    return { ok: false, error: 'No tiene permisos para esta acción.', status: 403 };
  }
  // Doble verificación en servidor: el rol debe coincidir con el correo autorizado
  // o ser admin_tecnico con DEVELOPER_EMAIL. Un alumno nunca puede autoasignarse rol.
  const expected = rolEsperadoPorCorreo(session.profile.correo);
  if (session.profile.rol === 'profesora' && expected !== 'profesora' && expected !== 'admin_tecnico') {
    return { ok: false, error: 'Cuenta no autorizada como profesora.', status: 403 };
  }
  return { ok: true, profile: session.profile };
}

/** Registra una acción importante en activity_logs (fire and forget seguro). */
export async function logActivity(
  userId: string,
  accion: string,
  entidad: string,
  entidadId: string | null,
  descripcion: string
) {
  try {
    const admin = createAdminClient();
    await admin.from('activity_logs').insert({
      user_id: userId,
      accion,
      entidad,
      entidad_id: entidadId,
      descripcion,
    });
  } catch {
    // No interrumpir la operación principal si falla el registro
  }
}
