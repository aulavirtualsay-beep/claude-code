import { NextResponse } from 'next/server';
import { getAppSession, requireTeacher, logActivity } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

// Rutas de archivos: subida (solo profesora) y descarga firmada (usuarios autorizados).

// POST /api/files  - Sube un archivo a Supabase Storage (bucket privado 'recursos')
export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get('archivo');
  const schoolId = String(form?.get('school_id') ?? '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }

  // Validación dinámica para no importar el módulo en runtime edge si falla
  const { validarArchivo, nombreArchivoSeguro } = await import('@/lib/uploads');
  const validacion = validarArchivo(file.name, file.type, file.size);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(schoolId)) {
    return NextResponse.json({ error: 'Colegio no válido.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const ruta = `${schoolId}/${nombreArchivoSeguro(file.name)}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from('recursos').upload(ruta, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    console.error('Error subiendo archivo:', error.message);
    return NextResponse.json(
      { error: 'No se pudo subir el archivo. Intente nuevamente.' },
      { status: 500 }
    );
  }

  await logActivity(auth.profile.user_id, 'subir_archivo', 'storage', null, `Archivo subido: ${ruta}`);
  return NextResponse.json({ ok: true, file_path: ruta, nombre_original: file.name });
}

// GET /api/files?path=...  - Devuelve URL firmada de descarga si el usuario está autorizado
export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: 'Debe iniciar sesión.' }, { status: 401 });

  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';
  if (!path || path.includes('..')) {
    return NextResponse.json({ error: 'Ruta no válida.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verificar que exista un recurso PUBLICADO con esa ruta al cual el usuario tiene acceso
  const { data: recursos } = await admin
    .from('resources')
    .select('id, school_id, school_year_id, group_id, subject_id, estado')
    .eq('file_path', path);

  const visibles = (recursos ?? []).filter((r) => {
    if (session.profile.rol !== 'alumno') return true; // profesora/admin
    if (r.estado !== 'publicado') return false;
    const st = session.student;
    if (!st) return false;
    if (r.school_id !== st.school_id) return false;
    if (r.school_year_id && r.school_year_id !== st.school_year_id) return false;
    if (r.group_id && r.group_id !== st.group_id) return false;
    return true; // la materia se filtra además por student_subjects en la UI y RLS
  });

  if (visibles.length === 0) {
    return NextResponse.json(
      { error: 'No tiene permiso para descargar este archivo.' },
      { status: 403 }
    );
  }

  const { data: signed, error } = await admin.storage
    .from('recursos')
    .createSignedUrl(path, 60 * 10, { download: path.split('/').pop() ?? undefined });

  if (error || !signed) {
    return NextResponse.json({ error: 'No se pudo generar el enlace de descarga.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: signed.signedUrl, expira_en: 600 });
}
