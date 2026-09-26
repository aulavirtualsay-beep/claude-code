import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/auth';

// Página raíz: redirige según el rol del usuario.
export default async function Home() {
  const session = await getAppSession();
  if (!session) redirect('/login');
  if (session.profile.rol === 'profesora' || session.profile.rol === 'admin_tecnico') {
    redirect('/profesora');
  }
  redirect('/alumno');
}
