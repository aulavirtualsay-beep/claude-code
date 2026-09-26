import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppSession } from '@/lib/auth';

// Asistente educativa "Say" - Ruta segura del servidor.
// La GOOGLE_GEMINI_API_KEY SOLO se usa aquí; nunca llega al navegador.

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

const INSTRUCCIONES_SAY = `Tu nombre es Say. Eres una asistente educativa especializada en Matemáticas y Física. Responde en español claro, paciente y apropiado para estudiantes. Explica los procedimientos paso a paso. No inventes fuentes ni presentes datos dudosos como hechos. Ayuda a aprender, no solamente a copiar respuestas. No puedes modificar calificaciones, acceder a datos privados, tomar decisiones académicas ni realizar acciones administrativas. Cuando hables de experimentos, recomienda supervisión de la profesora y medidas de seguridad. Si no sabes algo, dilo claramente y recomienda consultar a la profesora.`;

const AVISO =
  'Say es una herramienta de apoyo educativo. Sus respuestas pueden contener errores. Verifica la información con tu profesora y tus materiales de clase.';

const esquema = z.object({
  mensaje: z.string().min(1, 'Escriba un mensaje.').max(4000, 'El mensaje es demasiado largo.'),
  historial: z
    .array(z.object({ rol: z.enum(['user', 'model']), texto: z.string().max(8000) }))
    .max(20)
    .default([]),
});

export async function POST(request: Request) {
  // 1. Validar sesión activa
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: 'Debe iniciar sesión para usar a Say.' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Say no está configurada todavía. Falta la clave de Gemini en el servidor.' },
      { status: 503 }
    );
  }

  const parsed = esquema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mensaje no válido.' }, { status: 400 });
  }
  const { mensaje, historial } = parsed.data;

  // Contexto breve según rol (sin datos privados de otros alumnos)
  const rolCtx =
    session.profile.rol === 'alumno'
      ? `El usuario es un alumno de "${session.schools[0]?.nombre ?? 'su colegio'}"${
          session.student?.nombre_completo ? '' : ' aún sin asignación de año o grupo'
        }. Adapta el nivel de las explicaciones a educación media general.`
      : 'El usuario es la profesora. Puedes ayudarle a crear borradores de guías, ejercicios, rúbricas, avisos y actividades. Recuerda: ella siempre revisa y confirma antes de publicar nada.';

  const contents = [
    ...historial.map((h) => ({
      role: h.rol,
      parts: [{ text: h.texto }],
    })),
    { role: 'user', parts: [{ text: mensaje }] },
  ];

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${INSTRUCCIONES_SAY}\n\n${rolCtx}` }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      // No registrar la API key en logs; solo el estado
      console.error(`Say: Gemini respondió ${res.status}`);
      if (res.status === 429) {
        return NextResponse.json(
          { error: 'Say está procesando muchas solicitudes ahora. Espere un momento e intente de nuevo.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'No se pudo obtener respuesta de Say en este momento. Intente nuevamente.' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const texto: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim();

    if (!texto) {
      return NextResponse.json(
        { error: 'Say no pudo generar una respuesta válida. Reformule su pregunta.' },
        { status: 502 }
      );
    }

    // Devolver solo lo necesario
    return NextResponse.json({ respuesta: texto, aviso: AVISO });
  } catch (err) {
    console.error('Say: error de red', (err as Error).name);
    return NextResponse.json(
      { error: 'Error de conexión con Say. Verifique su internet e intente de nuevo.' },
      { status: 502 }
    );
  }
}
