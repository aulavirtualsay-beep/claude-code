'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AppSession } from '@/lib/types';

interface SessionCtx {
  session: AppSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  session: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function useAppSession() {
  return useContext(Ctx);
}

// Colegio activo de la profesora (se guarda en localStorage por navegador)
export function useSchoolContext(schools: { id: string }[]) {
  const [schoolId, setSchoolId] = useState<string>('');
  useEffect(() => {
    if (!schools.length) return;
    const saved = typeof window !== 'undefined' ? localStorage.getItem('av_school') : null;
    const valid = saved && schools.some((s) => s.id === saved);
    setSchoolId(valid ? saved! : schools[0].id);
  }, [schools]);
  const change = (id: string) => {
    setSchoolId(id);
    localStorage.setItem('av_school', id);
  };
  return { schoolId, change };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSession(null);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    if (!profile || profile.estado === 'inactivo') {
      await supabase.auth.signOut();
      setSession(null);
      setLoading(false);
      return;
    }
    let student = null;
    let schools: AppSession['schools'] = [];
    if (profile.rol === 'alumno') {
      const { data: st } = await supabase.from('students').select('*').eq('user_id', user.id).maybeSingle();
      student = st;
      if (st?.school_id) {
        const { data: esc } = await supabase
          .from('schools_publicas')
          .select('*')
          .eq('id', st.school_id)
          .maybeSingle();
        if (esc) schools = [esc];
      }
    } else {
      const { data: esc } = await supabase.from('schools').select('*').order('nombre');
      schools = esc ?? [];
    }
    // Estado pendiente: el alumno puede iniciar sesión pero ve aviso de confirmación
    setSession({ profile, student, schools });
    setLoading(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSession(null);
  }

  useEffect(() => {
    loadSession();
  }, []);

  return <Ctx.Provider value={{ session, loading, refresh: loadSession, signOut }}>{children}</Ctx.Provider>;
}
