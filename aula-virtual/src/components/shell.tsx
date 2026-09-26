'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppSession } from '@/components/session';

const NAV_PROFESORA = [
  { href: '/profesora', etiqueta: 'Inicio', icono: '🏠' },
  { href: '/profesora/alumnos', etiqueta: 'Alumnos', icono: '👥' },
  { href: '/profesora/estructura', etiqueta: 'Años y grupos', icono: '🗂️' },
  { href: '/profesora/recursos', etiqueta: 'Recursos', icono: '📚' },
  { href: '/profesora/evaluaciones', etiqueta: 'Evaluaciones', icono: '📝' },
  { href: '/profesora/calificaciones', etiqueta: 'Calificaciones', icono: '📊' },
  { href: '/profesora/avisos', etiqueta: 'Avisos', icono: '📣' },
  { href: '/profesora/configuracion', etiqueta: 'Configuración', icono: '⚙️' },
];

const NAV_ALUMNO = [
  { href: '/alumno', etiqueta: 'Inicio', icono: '🏠' },
  { href: '/alumno/recursos', etiqueta: 'Recursos', icono: '📚' },
  { href: '/alumno/evaluaciones', etiqueta: 'Evaluaciones', icono: '📝' },
  { href: '/alumno/calificaciones', etiqueta: 'Mis calificaciones', icono: '📊' },
  { href: '/alumno/avisos', etiqueta: 'Avisos', icono: '📣' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Cargando Aula virtual…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.replace('/login');
    return null;
  }

  const esProfesora = session.profile.rol === 'profesora' || session.profile.rol === 'admin_tecnico';
  const nav = esProfesora ? NAV_PROFESORA : NAV_ALUMNO;
  const colegioActivo = esProfesora
    ? localStorage.getItem('av_school')
    : session.schools[0]?.id ?? null;
  const nombreColegio = session.schools.find((s) => s.id === colegioActivo)?.nombre;

  async function salir() {
    await signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Barra lateral en escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-4">
          <Link href="/" className="block">
            <span className="text-lg font-bold text-slate-800">🎓 Aula virtual</span>
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">Plataforma educativa</p>
        </div>
        {nombreColegio && (
          <div className="mx-3 mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
            Trabajando en:
            <br />
            <span className="font-semibold">{nombreColegio}</span>
          </div>
        )}
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                pathname === item.href
                  ? 'bg-sky-600 font-medium text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span aria-hidden>{item.icono}</span>
              {item.etiqueta}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <p className="truncate text-sm font-medium text-slate-700">{session.profile.nombre_completo}</p>
          <p className="truncate text-xs text-slate-400">{session.profile.correo}</p>
          <button
            onClick={salir}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior móvil */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600"
            >
              ☰
            </button>
            <span className="font-semibold text-slate-800">🎓 Aula virtual</span>
          </div>
          <button onClick={salir} className="text-sm text-slate-500">
            Salir
          </button>
        </header>

        {menuAbierto && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-bold text-slate-800">🎓 Aula virtual</span>
                <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="px-2 text-slate-500">
                  ✕
                </button>
              </div>
              {nombreColegio && (
                <div className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
                  Trabajando en: <span className="font-semibold">{nombreColegio}</span>
                </div>
              )}
              <nav className="space-y-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuAbierto(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                      pathname === item.href ? 'bg-sky-600 font-medium text-white' : 'text-slate-600'
                    }`}
                  >
                    <span aria-hidden>{item.icono}</span>
                    {item.etiqueta}
                  </Link>
                ))}
              </nav>
              <p className="mt-4 truncate text-xs text-slate-400">{session.profile.nombre_completo}</p>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
