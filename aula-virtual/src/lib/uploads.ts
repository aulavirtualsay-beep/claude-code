import 'server-only';

// Validación de archivos subidos a Supabase Storage.
// Se aplica en la ruta API del servidor ANTES de subir.

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (plan gratuito)

const EXTENSIONES_PERMITIDAS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'md',
  'rtf',
  'ppt',
  'pptx',
  'odp',
  'xls',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'mp4',
  'webm',
];

// Extensiones explícitamente peligrosas/ejecutables
const EXTENSIONES_PROHIBIDAS = [
  'exe', 'bat', 'cmd', 'sh', 'msi', 'apk', 'js', 'jar', 'com', 'scr',
  'ps1', 'vbs', 'wsf', 'dll', 'so', 'app', 'reg', 'py', 'php', 'html', 'htm',
];

const MIMES_PERMITIDOS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain'],
  rtf: ['application/rtf', 'text/rtf'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  odp: ['application/vnd.oasis.opendocument.presentation'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  mp4: ['video/mp4'],
  webm: ['video/webm'],
};

export interface ValidacionArchivo {
  ok: boolean;
  error?: string;
  extension?: string;
}

export function validarArchivo(
  nombreOriginal: string,
  mimeType: string,
  tamano: number
): ValidacionArchivo {
  const ext = nombreOriginal.split('.').pop()?.toLowerCase() ?? '';

  if (!ext) {
    return { ok: false, error: 'El archivo no tiene extensión. Use formatos como PDF, Word, imágenes o videos.' };
  }
  if (EXTENSIONES_PROHIBIDAS.includes(ext)) {
    return { ok: false, error: 'No se permiten archivos ejecutables o de código por seguridad.' };
  }
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
    return {
      ok: false,
      error: `Extensión .${ext} no permitida. Formatos aceptados: PDF, Word, PowerPoint, Excel, texto, imágenes (PNG, JPG, GIF, WEBP) y videos (MP4, WEBM).`,
    };
  }
  if (tamano > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'El archivo supera el límite de 10 MB. Intente con un archivo más pequeño.' };
  }
  const mimes = MIMES_PERMITIDOS[ext] ?? [];
  const mimeLimpio = mimeType.split(';')[0].trim().toLowerCase();
  // Permitir application/octet-stream solo si la extensión es segura (algunos navegadores lo envían así)
  if (mimeLimpio !== 'application/octet-stream' && mimes.length > 0 && !mimes.includes(mimeLimpio)) {
    return { ok: false, error: 'El contenido del archivo no coincide con su extensión. Archivo rechazado.' };
  }
  return { ok: true, extension: ext };
}

// Nombre de archivo seguro: sin caracteres extraños, con prefijo único
export function nombreArchivoSeguro(nombreOriginal: string): string {
  const ext = nombreOriginal.split('.').pop()?.toLowerCase() ?? 'bin';
  const base = nombreOriginal
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'archivo';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}-${base}.${ext}`;
}
