-- =====================================================================
-- Aula virtual - Migración 0001: Esquema base
-- Ejecutar en Supabase (SQL Editor o `supabase db push`)
-- =====================================================================

-- ---------- Tablas ----------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre_completo text not null default '',
  correo text not null,
  rol text not null check (rol in ('profesora', 'alumno', 'admin_tecnico')) default 'alumno',
  estado text not null check (estado in ('pendiente', 'activo', 'inactivo')) default 'pendiente',
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#2563eb',
  codigo_acceso_hash text,
  codigo_anterior_hash text, -- se conserva brevemente para auditoría, nunca se valida
  codigo_actualizado_en timestamptz,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  unique (school_id, nombre)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  unique (school_year_id, nombre)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year_id uuid references public.school_years (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  nombre_completo text not null,
  codigo_estudiante text,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  nombre text not null,
  descripcion text,
  color text not null default '#2563eb',
  activo boolean not null default true,
  unique (school_id, nombre)
);

create table if not exists public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  unique (student_id, subject_id)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year_id uuid references public.school_years (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  titulo text not null,
  descripcion text,
  tipo text not null check (tipo in ('archivo', 'enlace')),
  categoria text not null,
  file_path text,
  external_url text,
  tags text[] default '{}',
  estado text not null check (estado in ('borrador', 'publicado')) default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year_id uuid references public.school_years (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  titulo text not null,
  descripcion text,
  tipo text not null check (tipo in ('examen','tarea','proyecto','laboratorio','participacion','quiz','trabajo_clase','recuperacion')),
  puntuacion_maxima numeric not null default 20 check (puntuacion_maxima > 0),
  porcentaje numeric check (porcentaje is null or (porcentaje >= 0 and porcentaje <= 100)),
  fecha_evaluacion date not null default current_date,
  estado text not null check (estado in ('borrador', 'publicada')) default 'borrador',
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  nota_obtenida numeric not null check (nota_obtenida >= 0),
  comentario text,
  observacion_privada text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

-- La nota no puede superar la puntuación máxima (verificación cruzada)
create or replace function public.check_grade_max()
returns trigger language plpgsql as $$
begin
  if (select puntuacion_maxima from public.assessments where id = new.assessment_id) < new.nota_obtenida then
    raise exception 'La nota no puede superar la puntuación máxima de la evaluación.';
  end if;
  return new;
end $$;

drop trigger if exists grades_max_check on public.grades;
create trigger grades_max_check before insert or update on public.grades
for each row execute function public.check_grade_max();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists resources_touch on public.resources;
create trigger resources_touch before update on public.resources
for each row execute function public.touch_updated_at();

drop trigger if exists grades_touch on public.grades;
create trigger grades_touch before update on public.grades
for each row execute function public.touch_updated_at();

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  school_year_id uuid references public.school_years (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  titulo text not null,
  contenido text not null,
  publicado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id uuid,
  descripcion text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_students_school on public.students (school_id);
create index if not exists idx_resources_school on public.resources (school_id, estado);
create index if not exists idx_assessments_school on public.assessments (school_id);
create index if not exists idx_grades_student on public.grades (student_id);
create index if not exists idx_announcements_school on public.announcements (school_id, publicado);
