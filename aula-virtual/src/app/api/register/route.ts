import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hashearCodigo } from '@/lib/codes';
import { normEmail } from '@/lib/auth';

// Registro de alumnos con código de acceso del colegio.
// El código se verifica en el SERVIDOR contra el hash almacenado.
// La service role key NUNCA llega al navegador.

const esquema = z.object({
  nombre_completo: z.string().min(3, 'Ingrese su nombre completo.'),
  correo: z.string().email('Ingrese un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  school_id: z.string().uuid('Seleccione su colegio.'),
  codigo_acceso: z.string().min(4, 'Ingrese el código de acceso de su colegio.'),
  school_year_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = esquema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos incompletos.' },
        { status: 400 }
      );
    }
    const { nombre_completo, correo, password, school_id, codigo_acceso, school_year_id, group_id } =
      parsed.data;

    const admin = createAdminClient();

    // 1. Verificar código de acceso contra el hash (solo servidor)
    const { data: school } = await admin
      .from('schools')
      .select('id, nombre, codigo_acceso_hash, activo')
      .eq('id', school_id)
      .single();

    if (!school || !school.activo) {
      return NextResponse.json({ error: 'El colegio seleccionado no está disponible.' }, { status: 400 });
    }
    if (!school.codigo_acceso_hash) {
      return NextResponse.json(
        { error: 'Este colegio aún no tiene código de acceso. Solicítelo a la profesora.' },
        { status: 400 }
      );
    }
    if (hashearCodigo(codigo_acceso) !== school.codigo_acceso_hash) {
      return NextResponse.json(
        { error: 'El código de acceso no es válido para este colegio.' },
        { status: 403 }
      );
    }

    // 2. Crear usuario en Supabase Auth
    const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
      email: normEmail(correo),
      password,
      email_confirm: true,
      user_metadata: { nombre_completo },
    });
    if (signUpError || !signUpData.user) {
      const msg = /already/i.test(signUpError?.message ?? '')
        ? 'Ya existe una cuenta con ese correo. Inicie sesión.'
        : 'No se pudo crear la cuenta. Intente de nuevo.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const userId = signUpData.user.id;

    // 3. Crear perfil con rol alumno (el rol NUNCA viene del cliente)
    await admin.from('profiles').insert({
      user_id: userId,
      nombre_completo,
      correo: normEmail(correo),
      rol: 'alumno',
      estado: 'pendiente',
    });

    // 4. Crear registro de alumno pendiente de confirmación de la profesora
    const { data: student } = await admin
      .from('students')
      .insert({
        user_id: userId,
        school_id,
        school_year_id: school_year_id ?? null,
        group_id: group_id ?? null,
        nombre_completo,
        activo: true,
      })
      .select('id')
      .single();

    // 5. Asignar materias del colegio (Matemáticas y Física por defecto)
    const { data: subjects } = await admin
      .from('subjects')
      .select('id')
      .eq('school_id', school_id)
      .eq('activo', true);
    if (student && subjects?.length) {
      await admin
        .from('student_subjects')
        .insert(subjects.map((s: { id: string }) => ({ student_id: student.id, subject_id: s.id })));
    }

    // 6. Auditoría
    await admin.from('activity_logs').insert({
      user_id: userId,
      accion: 'registro_alumno',
      entidad: 'students',
      entidad_id: student?.id ?? null,
      descripcion: `Nuevo alumno registrado en ${school.nombre} (pendiente de confirmación).`,
    });

    return NextResponse.json(
      {
        ok: true,
        pendiente: true,
        mensaje:
          'Registro exitoso. Su cuenta quedará activa cuando la profesora confirme sus datos. Luego podrá iniciar sesión con su correo y contraseña.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error en registro:', (err as Error).message);
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado. Intente nuevamente.' },
      { status: 500 }
    );
  }
}
