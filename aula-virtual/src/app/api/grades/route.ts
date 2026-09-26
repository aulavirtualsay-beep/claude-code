import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeacher, logActivity } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

// Registro y edición de calificaciones (solo profesora).
// Validaciones: nota >= 0, nota <= puntuación máxima, alumno existe.

const esquema = z.object({
  assessment_id: z.string().uuid(),
  student_id: z.string().uuid(),
  nota_obtenida: z.coerce.number().min(0, 'La nota no puede ser negativa.'),
  comentario: z.string().max(500).optional().nullable(),
  observacion_privada: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireTeacher();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = esquema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' },
      { status: 400 }
    );
  }
  const { assessment_id, student_id, nota_obtenida, comentario, observacion_privada } = parsed.data;

  const admin = createAdminClient();

  // Verificar puntuación máxima en el servidor
  const { data: evaluacion } = await admin
    .from('assessments')
    .select('id, titulo, puntuacion_maxima, school_id')
    .eq('id', assessment_id)
    .single();

  if (!evaluacion) {
    return NextResponse.json({ error: 'La evaluación no existe.' }, { status: 404 });
  }
  if (nota_obtenida > Number(evaluacion.puntuacion_maxima)) {
    return NextResponse.json(
      { error: `La nota no puede superar la puntuación máxima (${evaluacion.puntuacion_maxima}).` },
      { status: 400 }
    );
  }

  const { data: alumno } = await admin
    .from('students')
    .select('id, nombre_completo, school_id')
    .eq('id', student_id)
    .single();
  if (!alumno) {
    return NextResponse.json({ error: 'El alumno no existe.' }, { status: 404 });
  }
  if (alumno.school_id !== evaluacion.school_id) {
    return NextResponse.json(
      { error: 'El alumno no pertenece al colegio de esta evaluación.' },
      { status: 400 }
    );
  }

  const { data: grade, error } = await admin
    .from('grades')
    .upsert(
      {
        assessment_id,
        student_id,
        nota_obtenida,
        comentario: comentario ?? null,
        observacion_privada: observacion_privada ?? null,
      },
      { onConflict: 'assessment_id,student_id' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('Error guardando nota:', error.message);
    return NextResponse.json({ error: 'No se pudo registrar la calificación.' }, { status: 500 });
  }

  await logActivity(
    auth.profile.user_id,
    'registrar_calificacion',
    'grades',
    grade?.id ?? null,
    `Nota ${nota_obtenida}/${evaluacion.puntuacion_maxima} para ${alumno.nombre_completo} en "${evaluacion.titulo}"`
  );

  return NextResponse.json({ ok: true, grade });
}
