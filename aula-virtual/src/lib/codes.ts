import 'server-only';
import crypto from 'crypto';

// Generación de códigos de acceso legibles para la profesora.
// Se guardan SOLO como hash SHA-256 en Supabase; el código en claro
// nunca se persiste ni se muestra a los alumnos.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos

export function generarCodigoAcceso(longitud = 10): string {
  const bytes = crypto.randomBytes(longitud);
  let out = '';
  for (let i = 0; i < longitud; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  // Formato XXXX-XXXX-XX para facilitar lectura en voz alta
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

export function hashearCodigo(codigo: string): string {
  return crypto.createHash('sha256').update(codigo.trim().toUpperCase()).digest('hex');
}

export function verificarCodigo(codigo: string, hash: string | null): boolean {
  if (!hash) return false;
  const candidate = hashearCodigo(codigo);
  if (candidate.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}
