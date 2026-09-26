-- =====================================================================
-- Aula virtual - Migración 0003: Datos iniciales y Storage
-- =====================================================================

-- ---------- Colegios iniciales ----------
-- Los códigos de acceso NO se escriben aquí: la profesora los genera desde
-- Configuración (se guardan como hash SHA-256). El backend usa
-- hashearCodigo() en src/lib/codes.ts.

insert into public.schools (nombre, color)
values ('Colegio Isabel de Jesús Chacón', '#0ea5e9')
on conflict (nombre) do nothing;

insert into public.schools (nombre, color)
values ('Colegio Panchita Soublette', '#f59e0b')
on conflict (nombre) do nothing;

-- ---------- Materias por colegio (Matemáticas azul, Física morado) ----------
insert into public.subjects (school_id, nombre, descripcion, color)
select s.id, 'Matemáticas', 'Pensamiento lógico y numérico', '#2563eb'
from public.schools s
on conflict (school_id, nombre) do nothing;

insert into public.subjects (school_id, nombre, descripcion, color)
select s.id, 'Física', 'Materia, energía y universo', '#7c3aed'
from public.schools s
on conflict (school_id, nombre) do nothing;

-- ---------- Años y grupos de ejemplo (configurables por la profesora) ----------
insert into public.school_years (school_id, nombre, descripcion)
select s.id, y.nombre, y.descripcion
from public.schools s
cross join (values
  ('Primer año', 'Primer año de educación media general'),
  ('Segundo año', 'Segundo año de educación media general'),
  ('Tercer año', 'Tercer año de educación media general'),
  ('Cuarto año', 'Cuarto año de educación media general'),
  ('Quinto año', 'Quinto año de educación media general')
) as y(nombre, descripcion)
on conflict (school_id, nombre) do nothing;

insert into public.groups (school_year_id, nombre)
select y.id, g.nombre
from public.school_years y
cross join (values ('Grupo A'), ('Grupo B'), ('Grupo C')) as g(nombre)
on conflict (school_year_id, nombre) do nothing;

-- ---------- Perfiles iniciales ----------
-- IMPORTANTE: reemplace los UUIDs por los IDs reales de auth.users después de
-- crear las cuentas (Autenticación > Usuarios) o ejecute la ruta /api/seed
-- descrita en el README. Los correos deben coincidir con TEACHER_EMAIL y
-- DEVELOPER_EMAIL.

-- Perfil de la profesora (se crea automáticamente al registrarse vía /auth/profesora
-- o manualmente):
-- insert into public.profiles (user_id, nombre_completo, correo, rol, estado)
-- values ('<uuid-profesora>', 'Profesora', '<TEACHER_EMAIL>', 'profesora', 'activo');

-- ---------- Storage: bucket privado de recursos ----------
-- Bucket PRIVADO: la descarga se hace con URLs firmadas emitidas por rutas
-- del servidor que verifican sesión y permisos.
insert into storage.buckets (id, name, public)
values ('recursos', 'recursos', false)
on conflict (id) do nothing;

-- Solo la profesora/admin autenticada puede gestionar objetos (RLS de storage).
drop policy if exists "storage_profesora_escribe" on storage.objects;
create policy "storage_profesora_escribe" on storage.objects
for all to authenticated
using (bucket_id = 'recursos' and public.is_teacher())
with check (bucket_id = 'recursos' and public.is_teacher());

-- Los alumnos pueden LEER objetos del bucket (la validación fina de a qué
-- recurso tienen acceso ocurre en la ruta /api/files/[id], que emite URLs
-- firmadas solo si el recurso corresponde a su colegio/año/grupo/materia).
drop policy if exists "storage_alumnos_leen" on storage.objects;
create policy "storage_alumnos_leen" on storage.objects
for select to authenticated
using (bucket_id = 'recursos');
