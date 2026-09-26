'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface ColegioOpcion {
  id: string;
  nombre: string;
}

export default function RegistroPage() {
  const [colegios, setColegios] = useState<ColegioOpcion[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [years, setYears] = useState<{ id: string; nombre: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; nombre: string }[]>([]);
  const [yearId, setYearId] = useState('');
  const [groupId, setGroupId] = useState('');

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Los alumnos pueden listar colegios públicos (sin códigos) para seleccionar el suyo.
  useEffect(() => {
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase.from('schools_publicas').select('id, nombre').eq('activo', true);
      if (data?.length) setColegios(data as ColegioOpcion[]);
      else {
        // Fallback: lista pública mínima definida por la profesora en configuración
        setColegios([]);
      }
    }
    cargar();
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    async function cargar() {
      const supabase = createClient();
      const { data: ys } = await supabase
        .from('school_years')
        .select('id, nombre')
        .eq('school_id', schoolId)
        .eq('activo', true)
        .order('nombre');
      setYears(ys ?? []);
      setGroups([]);
      setYearId('');
      setGroupId('');
    }
    cargar();
  }, [schoolId]);

  useEffect(() => {
    if (!yearId) return;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from('groups')
        .select('id, nombre')
        .eq('school_year_id', yearId)
        .eq('activo', true)
        .order('nombre');
      setGroups(data ?? []);
      setGroupId('');
    }
    cargar();
  }, [yearId]);

  async function registrarse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setCargando(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: nombre,
          correo: correo.trim().toLowerCase(),
          password,
          school_id: schoolId,
          codigo_acceso: codigo,
          school_year_id: yearId || null,
          group_id: groupId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar el registro.');
        return;
      }
      setExito(data.mensaje ?? 'Registro exitoso.');
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-6 text-center">
        <span className="text-3xl">🎓</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">Aula virtual</h1>
        <p className="text-sm text-slate-500">Registro de nuevos alumnos</p>
      </div>

      {exito ? (
        <div className="space-y-4 text-center">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            ✅ {exito}
          </div>
          <Link href="/login" className="btn-primary w-full">
            Ir a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={registrarse} className="space-y-4">
          <div>
            <label className="label">1. Seleccione su colegio</label>
            <select required className="input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">—Seleccione un colegio—</option>
              {colegios.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {colegios.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No hay colegios disponibles todavía. Pregunte a su profesora.
              </p>
            )}
          </div>

          <div>
            <label className="label">2. Código de acceso del colegio</label>
            <input
              required
              className="input uppercase"
              placeholder="Código entregado por la profesora"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Año o grado (opcional)</label>
              <select className="input" value={yearId} onChange={(e) => setYearId(e.target.value)} disabled={!schoolId}>
                <option value="">Pendiente de asignación</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Grupo (opcional)</label>
              <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={!yearId}>
                <option value="">Pendiente de asignación</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Nombre completo</label>
            <input
              required
              minLength={3}
              className="input"
              placeholder="Nombres y apellidos"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input
              required
              type="email"
              className="input"
              placeholder="ejemplo@correo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contraseña (mínimo 8 caracteres)</label>
            <input
              required
              type="password"
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={cargando || !colegios.length} className="btn-primary w-full">
            {cargando ? 'Registrando…' : 'Crear cuenta'}
          </button>

          <p className="text-center text-xs text-slate-500">
            La profesora revisará y confirmará sus datos antes de activar su cuenta.
          </p>
          <p className="text-center text-sm text-slate-500">
            ¿Ya tiene cuenta?{' '}
            <Link href="/login" className="font-medium text-sky-600 hover:underline">Iniciar sesión</Link>
          </p>
        </form>
      )}
    </div>
  );
}
