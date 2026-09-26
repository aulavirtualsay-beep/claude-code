'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Option {
  id: string;
  nombre: string;
}

export function useOptions(schoolId: string) {
  const [years, setYears] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<(Option & { color: string })[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const supabase = createClient();
    (async () => {
      const { data: ys } = await supabase
        .from('school_years')
        .select('id, nombre')
        .eq('school_id', schoolId)
        .eq('activo', true)
        .order('nombre');
      setYears(ys ?? []);
      const ids = (ys ?? []).map((y) => y.id);
      if (ids.length) {
        const { data: gs } = await supabase
          .from('groups')
          .select('id, nombre')
          .in('school_year_id', ids)
          .eq('activo', true)
          .order('nombre');
        setGroups(gs ?? []);
      } else setGroups([]);
      const { data: ss } = await supabase
        .from('subjects')
        .select('id, nombre, color')
        .eq('school_id', schoolId)
        .eq('activo', true);
      setSubjects(ss ?? []);
    })();
  }, [schoolId]);

  return { years, groups, subjects };
}

// Estado global simple para notificaciones ("toast")
export function useNotificacion() {
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, notify: setMsg };
}

export function Notificacion({ msg }: { msg: { texto: string; tipo: 'ok' | 'error' } | null }) {
  if (!msg) return null;
  return (
    <div
      role="status"
      className={`fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
        msg.tipo === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {msg.texto}
    </div>
  );
}

export function PantallaVacia({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-3xl">🗒️</p>
      <h3 className="mt-2 font-semibold text-slate-700">{titulo}</h3>
      <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      {texto}
    </div>
  );
}
