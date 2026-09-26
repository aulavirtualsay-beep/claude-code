import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, logActivity } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { generarCodigoAcceso, hashearCodigo } from '@/lib/codes';

// Gestión de códigos de acceso de colegios (SOLO profesora).
// POST { school_id, accion: 'generar' | 'definir', codigo? }
// El código anterior se invalida automáticamente al guardarse el nuevo hash.

const esquema = z.object({
  school_id: z.string().uuid(),
  accion: z.enum(['generar', 'definir']),
  codigo: z.string().min(6).max(40).optional(),
});

export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = esquema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  }
  const { school_id, accion, codigo } = parsed.data;

  const admin = createAdminClient();
  const { data: school } = await admin.from('schools').select('id, nombre, codigo_acceso_hash').eq('id', school_id).single();
  if (!school) return NextResponse.json({ error: 'El colegio no existe.' }, { status: 404 });

  let codigoEnClaro: string;
  if (accion === 'generar') {
    codigoEnClaro = generarCodigoAcceso();
  } else {
    if (!codigo) return NextResponse.json({ error: 'Ingrese el nuevo código.' }, { status: 400 });
    codigoEnClaro = codigo.trim().toUpperCase();
  }

  // Invalidación del código anterior: se reemplaza el hash y se conserva el
  // anterior solo para auditoría (nunca vuelve a validarse).
  const { error } = await admin
    .from('schools')
    .update({
      codigo_anterior_hash: school.codigo_acceso_hash ?? null,
      codigo_acceso_hash: hashearCodigo(codigoEnClaro),
      codigo_actualizado_en: new Date().toISOString(),
    })
    .eq('id', school_id);

  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar el código.' }, { status: 500 });
  }

  await logActivity(
    auth.profile.user_id,
    'cambiar_codigo_acceso',
    'schools',
    school_id,
    `Código de acceso de ${school.nombre} regenerado.`
  );

  // La respuesta llega SOLO a la profesora autenticada; los alumnos no pueden
  // llamar esta ruta porque requireTeacher lo impide en el servidor.
  return NextResponse.json({ ok: true, codigo: codigoEnClaro, actualizado_en: new Date().toISOString() });
}
