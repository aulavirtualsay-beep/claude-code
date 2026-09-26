import { NextResponse } from 'next/server';
import { requireTeacher, logActivity } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

// GET /api/export-grades?school_id=&subject_id=&year_id=&group_id=
// Exporta calificaciones a CSV (solo profesora).

export async function GET(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const schoolId = url.searchParams.get('school_id');
  if (!schoolId) {
    return NextResponse.json({ error: 'Seleccione un colegio.' }, { status: 400 });
  }
  const subjectId = url.searchParams.get('subject_id');
  const yearId = url.searchParams.get('year_id');
  const groupId = url.searchParams.get('group_id');

  const admin = createAdminClient();

  // Alumnos con año y grupo
  const { data: students } = await admin
    .from('students')
    .select('id, nombre_completo, codigo_estudiante, school_year_id, group_id')
    .eq('school_id', schoolId)
    .eq('activo', true);

  const { data: years } = await admin.from('school_years').select('id, nombre').eq('school_id', schoolId);
  const { data: groups } = await admin
    .from('groups')
    .select('id, nombre, school_year_id')
    .in('school_year_id', (years ?? []).map((y: { id: string }) => y.id));
  const yearNombre = new Map<string, string>((years ?? []).map((y: { id: string; nombre: string }) => [y.id, y.nombre]));
  const groupNombre = new Map<string, string>((groups ?? []).map((g: { id: string; nombre: string }) => [g.id, g.nombre]));

  // Materias de cada alumno
  const { data: studentSubjects } = await admin
    .from('student_subjects')
    .select('student_id, subject_id');
  const { data: subjects } = await admin.from('subjects').select('id, nombre').eq('school_id', schoolId);
  const subjectNombre = new Map<string, string>(
    (subjects ?? []).map((s: { id: string; nombre: string }) => [s.id, s.nombre])
  );
  const materiasAlumno = new Map<string, Set<string>>();
  for (const ss of studentSubjects ?? []) {
    if (!materiasAlumno.has(ss.student_id)) materiasAlumno.set(ss.student_id, new Set());
    materiasAlumno.get(ss.student_id)!.add(ss.subject_id);
  }

  let aq = admin
    .from('assessments')
    .select('id, titulo, tipo, fecha_evaluacion, puntuacion_maxima, subject_id, school_year_id, group_id')
    .eq('school_id', schoolId)
    .eq('estado', 'publicada')
    .order('fecha_evaluacion');
  if (subjectId) aq = aq.eq('subject_id', subjectId);
  if (yearId) aq = aq.or(`school_year_id.is.null,school_year_id.eq.${yearId}`);
  if (groupId) aq = aq.or(`group_id.is.null,group_id.eq.${groupId}`);

  const { data: assessments } = await aq;

  const { data: grades } = await admin
    .from('grades')
    .select('assessment_id, student_id, nota_obtenida, comentario');

  const mapaNotas = new Map<string, { nota: number; comentario: string | null }>();
  for (const g of grades ?? []) {
    mapaNotas.set(`${g.assessment_id}|${g.student_id}`, {
      nota: Number(g.nota_obtenida),
      comentario: g.comentario,
    });
  }

  const csvEscape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const filas: string[] = [];
  const cabeceras = ['Alumno', 'Año', 'Grupo', 'Materia', 'Evaluación', 'Tipo', 'Fecha', 'Nota', 'Máximo', 'Comentario'];
  filas.push(cabeceras.map(csvEscape).join(','));

  for (const st of students ?? []) {
    const materias = materiasAlumno.get(st.id) ?? new Set<string>();
    for (const as of assessments ?? []) {
      if (!materias.has(as.subject_id)) continue;
      // Respetar alcance año/grupo de la evaluación
      if (as.school_year_id && as.school_year_id !== st.school_year_id) continue;
      if (as.group_id && as.group_id !== st.group_id) continue;
      const registro = mapaNotas.get(`${as.id}|${st.id}`);
      filas.push(
        [
          st.nombre_completo,
          yearNombre.get(st.school_year_id ?? '') ?? '',
          groupNombre.get(st.group_id ?? '') ?? '',
          subjectNombre.get(as.subject_id) ?? '',
          as.titulo,
          as.tipo,
          as.fecha_evaluacion,
          registro ? String(registro.nota) : '',
          String(as.puntuacion_maxima),
          registro?.comentario ?? '',
        ]
          .map((c) => csvEscape(String(c)))
          .join(',')
      );
    }
  }

  await logActivity(auth.profile.user_id, 'exportar_csv', 'grades', null, `Exportación CSV de colegio ${schoolId}`);

  const csv = '\uFEFF' + filas.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="calificaciones-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
