// Tipos de dominio de "Aula virtual"

export type Rol = 'profesora' | 'alumno' | 'admin_tecnico';
export type EstadoPerfil = 'pendiente' | 'activo' | 'inactivo';

export interface Profile {
  id: string;
  user_id: string;
  nombre_completo: string;
  correo: string;
  rol: Rol;
  estado: EstadoPerfil;
  fecha_creacion: string;
}

export interface School {
  id: string;
  nombre: string;
  color: string;
  codigo_acceso_hash: string | null;
  codigo_actualizado_en: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface SchoolYear {
  id: string;
  school_id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface Group {
  id: string;
  school_year_id: string;
  nombre: string;
  activo: boolean;
}

export interface Student {
  id: string;
  user_id: string | null;
  school_id: string;
  school_year_id: string | null;
  group_id: string | null;
  nombre_completo: string;
  codigo_estudiante: string | null;
  activo: boolean;
}

export interface Subject {
  id: string;
  school_id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  activo: boolean;
}

export type CategoriaRecurso =
  | 'guia_matematicas'
  | 'guia_fisica'
  | 'ejercicios'
  | 'tareas'
  | 'simuladores'
  | 'videos'
  | 'enlaces_educativos'
  | 'documentos_pdf'
  | 'presentaciones'
  | 'imagenes'
  | 'investigaciones'
  | 'datos_curiosos'
  | 'repaso'
  | 'preparacion_examenes'
  | 'avisos';

export const CATEGORIAS_RECURSOS: { valor: CategoriaRecurso; etiqueta: string }[] = [
  { valor: 'guia_matematicas', etiqueta: 'Guías de Matemáticas' },
  { valor: 'guia_fisica', etiqueta: 'Guías de Física' },
  { valor: 'ejercicios', etiqueta: 'Ejercicios' },
  { valor: 'tareas', etiqueta: 'Tareas' },
  { valor: 'simuladores', etiqueta: 'Simuladores' },
  { valor: 'videos', etiqueta: 'Videos' },
  { valor: 'enlaces_educativos', etiqueta: 'Enlaces educativos' },
  { valor: 'documentos_pdf', etiqueta: 'Documentos PDF' },
  { valor: 'presentaciones', etiqueta: 'Presentaciones' },
  { valor: 'imagenes', etiqueta: 'Imágenes' },
  { valor: 'investigaciones', etiqueta: 'Investigaciones recientes' },
  { valor: 'datos_curiosos', etiqueta: 'Datos curiosos' },
  { valor: 'repaso', etiqueta: 'Material de repaso' },
  { valor: 'preparacion_examenes', etiqueta: 'Preparación para exámenes' },
  { valor: 'avisos', etiqueta: 'Avisos' },
];

export function etiquetaCategoria(valor: string): string {
  return CATEGORIAS_RECURSOS.find((c) => c.valor === valor)?.etiqueta ?? valor;
}

export interface Resource {
  id: string;
  school_id: string;
  school_year_id: string | null;
  group_id: string | null;
  subject_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: 'archivo' | 'enlace';
  categoria: CategoriaRecurso;
  file_path: string | null;
  external_url: string | null;
  tags: string[] | null;
  estado: 'borrador' | 'publicado';
  created_at: string;
  updated_at: string;
}

export type TipoEvaluacion =
  | 'examen'
  | 'tarea'
  | 'proyecto'
  | 'laboratorio'
  | 'participacion'
  | 'quiz'
  | 'trabajo_clase'
  | 'recuperacion';

export const TIPOS_EVALUACION: { valor: TipoEvaluacion; etiqueta: string }[] = [
  { valor: 'examen', etiqueta: 'Examen' },
  { valor: 'tarea', etiqueta: 'Tarea' },
  { valor: 'proyecto', etiqueta: 'Proyecto' },
  { valor: 'laboratorio', etiqueta: 'Laboratorio' },
  { valor: 'participacion', etiqueta: 'Participación' },
  { valor: 'quiz', etiqueta: 'Quiz' },
  { valor: 'trabajo_clase', etiqueta: 'Trabajo en clase' },
  { valor: 'recuperacion', etiqueta: 'Recuperación' },
];

export function etiquetaTipoEvaluacion(v: string): string {
  return TIPOS_EVALUACION.find((t) => t.valor === v)?.etiqueta ?? v;
}

export interface Assessment {
  id: string;
  school_id: string;
  school_year_id: string | null;
  group_id: string | null;
  subject_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoEvaluacion;
  puntuacion_maxima: number;
  porcentaje: number | null;
  fecha_evaluacion: string;
  estado: 'borrador' | 'publicada';
  created_at: string;
}

export interface Grade {
  id: string;
  assessment_id: string;
  student_id: string;
  nota_obtenida: number;
  comentario: string | null;
  observacion_privada: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  school_id: string;
  school_year_id: string | null;
  group_id: string | null;
  subject_id: string | null;
  titulo: string;
  contenido: string;
  publicado: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  descripcion: string;
  created_at: string;
}

// Sesión enriquecida para la aplicación
export interface AppSession {
  profile: Profile;
  student: Student | null;
  schools: School[]; // colegios disponibles según rol
}
