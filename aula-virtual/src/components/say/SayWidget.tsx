'use client';

import { useState } from 'react';

// Asistente educativa flotante "Say"
// Se comunica con /api/say (servidor). La API key de Gemini nunca aparece aquí.

interface Mensaje {
  rol: 'user' | 'model';
  texto: string;
}

const AVISO =
  'Say es una herramienta de apoyo educativo. Sus respuestas pueden contener errores. Verifica la información con tu profesora y tus materiales de clase.';

export default function SayWidget() {
  const [abierto, setAbierto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    const texto = entrada.trim();
    if (!texto || cargando) return;
    setError(null);
    const nuevoHistorial: Mensaje[] = [...mensajes, { rol: 'user', texto }];
    setMensajes(nuevoHistorial);
    setEntrada('');
    setCargando(true);
    try {
      const res = await fetch('/api/say', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: texto,
          historial: nuevoHistorial.slice(-10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo obtener respuesta de Say.');
      } else {
        setMensajes([...nuevoHistorial, { rol: 'model', texto: data.respuesta }]);
      }
    } catch {
      setError('Error de conexión con Say. Verifique su internet e intente de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        aria-label="Abrir asistente Say"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-300"
      >
        <span className="text-xl font-bold">Say</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
        minimizado ? 'h-14' : 'h-[70vh] max-h-[560px]'
      }`}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 to-indigo-700 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            Say
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Asistente educativa</p>
            <p className="text-[11px] leading-tight opacity-80">Matemáticas y Física</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimizado((m) => !m)}
            aria-label={minimizado ? 'Expandir chat' : 'Minimizar chat'}
            className="rounded-md px-2 py-1 text-sm hover:bg-white/20"
          >
            {minimizado ? '▢' : '—'}
          </button>
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar chat"
            className="rounded-md px-2 py-1 text-sm hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimizado && (
        <>
          {/* Cuerpo */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {mensajes.length === 0 && !cargando && (
              <div className="rounded-lg bg-white p-3 text-sm text-slate-600 shadow-sm">
                ¡Hola! Soy <strong>Say</strong> 👋. Puedo explicar temas de Matemáticas y Física paso a
                paso, crear ejercicios de práctica y ayudarte a estudiar. ¿Qué quieres aprender hoy?
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.rol === 'user'
                      ? 'rounded-br-sm bg-sky-600 text-white'
                      : 'rounded-bl-sm bg-white text-slate-800'
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-sky-500" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:120ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:240ms]" />
                  Say está pensando…
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
            )}
          </div>

          {/* Aviso */}
          <p className="border-t border-amber-100 bg-amber-50 px-3 py-1.5 text-[10px] leading-snug text-amber-800">
            ⚠️ {AVISO}
          </p>

          {/* Entrada */}
          <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
              placeholder="Escriba su pregunta…"
              className="flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              disabled={cargando}
            />
            <button
              onClick={enviar}
              disabled={cargando || !entrada.trim()}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
