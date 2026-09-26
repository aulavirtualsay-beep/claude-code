'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: correo.trim().toLowerCase(),
        password,
      });
      if (err) {
        setError(
          /invalid login/i.test(err.message)
            ? 'Correo o contraseña incorrectos. Verifique sus datos.'
            : 'No se pudo iniciar sesión. Intente nuevamente.'
        );
        return;
      }
      // Conocer el rol para redirigir
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol, estado')
        .eq('user_id', data.user.id)
        .single();

      if (!profile || profile.estado === 'inactivo') {
        await supabase.auth.signOut();
        setError('Su cuenta está inactiva. Contacte a la profesora.');
        return;
      }
      if (profile.rol === 'alumno' && profile.estado === 'pendiente') {
        // Permitido: verá aviso de confirmación pendiente en su panel
        router.replace('/alumno');
        return;
      }
      router.replace(profile.rol === 'alumno' ? '/alumno' : '/profesora');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-6 text-center">
        <span className="text-3xl">🎓</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">Aula virtual</h1>
        <p className="text-sm text-slate-500">Inicie sesión para continuar</p>
      </div>

      <form onSubmit={iniciarSesion} className="space-y-4">
        <div>
          <label className="label" htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            type="email"
            required
            className="input"
            placeholder="ejemplo@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button type="submit" disabled={cargando} className="btn-primary w-full">
          {cargando ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        ¿Es su primera vez?{' '}
        <Link href="/registro" className="font-medium text-sky-600 hover:underline">
          Registrarse como alumno
        </Link>
      </p>
    </div>
  );
}
