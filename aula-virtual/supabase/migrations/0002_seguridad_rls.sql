-- =====================================================================
-- Aula virtual - Migración 0002: Funciones auxiliares y Row Level Security
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_years enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.student_subjects enable row level security;
alter table public.resources enable row level security;
alter table public.assessments enable row level security;
alter table public.grades enable row level security;
alter table public.announcements enable row level security;
alter table public.activity_logs enable row level security;

-- ---------- Funciones auxiliares (SECURITY DEFINER para evitar recursión de RLS) ----------

create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
$$;

create or replace function public.my_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_rol() in ('profesora', 'admin_tecnico'), false)
$$;

create or replace function public.my_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() limit 1
$$;

create or replace function public.my_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.students where user_id = auth.uid() limit 1
$$;

create or replace function public.my_group_id()
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.students where user_id = auth.uid() limit 1
$$;

create or replace function public.my_year_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_year_id from public.students where user_id = auth.uid() limit 1
$$;

revoke all on function public.my_rol() from public;
grant execute on function public.my_rol(), public.is_teacher(), public.my_student_id(),
  public.my_school_id(), public.my_group_id(), public.my_year_id() to authenticated;

-- ---------- profiles ----------
-- El usuario ve su propio perfil. La profesora ve todos. Nadie actualiza su rol
-- (protegido además por trigger). Solo el servicio (backend) crea perfiles.

create policy "perfil_lectura_propia" on public.profiles
for select using (user_id = auth.uid() or public.is_teacher());

create policy "perfil_actualizacion_propia_sin_rol" on public.profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trigger: impedir cambiar el propio rol fuera de la ruta de servicio
create or replace function public.protect_profile_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() and new.rol is distinct from old.rol then
    raise exception 'No puede cambiar su propio rol.';
  end if;
  return new;
end $$;

drop trigger if exists protect_rol on public.profiles;
create trigger protect_rol before update on public.profiles
for each row execute function public.protect_profile_rol();

-- ---------- schools ----------
-- Los alumnos ven el nombre/color de SU colegio, nunca los hashes de códigos.
-- Vista sin código: se usa una vista dedicada.

create view public.schools_publicas as
select id, nombre, color, activo, fecha_creacion from public.schools;

alter table public.schools_publicas enable row level security;
create policy "escuelas_publicas_lectura" on public.schools_publicas
for select using (
  public.is_teacher()
  or id = public.my_school_id()
);

create policy "colegios_lectura_maestra" on public.schools
for select using (public.is_teacher());

create policy "colegios_alumno_sin_codigo" on public.schools
for select using (id = public.my_school_id())
; -- NOTA: esta política expondría codigo_acceso_hash al alumno; se desactiva abajo.
drop policy "colegios_alumno_sin_codigo" on public.schools;
-- El alumno accede a su colegio SOLO a través de schools_publicas (sin columnas sensibles).

create policy "colegios_escritura_maestra" on public.schools
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- school_years / groups / subjects ----------
create policy "anios_lectura" on public.school_years
for select using (public.is_teacher() or school_id = public.my_school_id());
create policy "anios_escritura" on public.school_years
for all using (public.is_teacher()) with check (public.is_teacher());

create policy "grupos_lectura" on public.groups
for select using (
  public.is_teacher()
  or school_year_id in (select id from public.school_years where school_id = public.my_school_id())
);
create policy "grupos_escritura" on public.groups
for all using (public.is_teacher()) with check (public.is_teacher());

create policy "materias_lectura" on public.subjects
for select using (public.is_teacher() or school_id = public.my_school_id());
create policy "materias_escritura" on public.subjects
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- students ----------
-- El alumno ve su propio registro; la profesora ve todo.
-- El alumno NO puede actualizar colegio/año/grupo por cuenta propia:
-- solo permite actualización de sí mismo mediante rutas del servidor (service role),
-- por lo que aquí no se concede update al alumno.
create policy "alumnos_lectura" on public.students
for select using (public.is_teacher() or user_id = auth.uid());

create policy "alumnos_escritura" on public.students
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- student_subjects ----------
create policy "materias_alumno_lectura" on public.student_subjects
for select using (
  public.is_teacher()
  or student_id = public.my_student_id()
  or subject_id in (select id from public.subjects where school_id = public.my_school_id())
);
create policy "materias_alumno_escritura" on public.student_subjects
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- resources ----------
-- Publicado + pertenece al colegio del alumno + aplica a su año/grupo/materia
-- (NULL en año/grupo/materia significa "todos").
create policy "recursos_lectura" on public.resources
for select using (
  public.is_teacher()
  or (
    estado = 'publicado'
    and school_id = public.my_school_id()
    and (school_year_id is null or school_year_id = public.my_year_id())
    and (group_id is null or group_id = public.my_group_id())
    and (subject_id is null or subject_id in (
      select subject_id from public.student_subjects where student_id = public.my_student_id()
    ))
  )
);
create policy "recursos_escritura" on public.resources
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- assessments ----------
create policy "evaluaciones_lectura" on public.assessments
for select using (
  public.is_teacher()
  or (
    estado = 'publicada'
    and school_id = public.my_school_id()
    and (school_year_id is null or school_year_id = public.my_year_id())
    and (group_id is null or group_id = public.my_group_id())
  )
);
create policy "evaluaciones_escritura" on public.assessments
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- grades ----------
-- El alumno SOLO ve sus propias calificaciones. No puede insertar ni actualizar.
create policy "notas_lectura" on public.grades
for select using (public.is_teacher() or student_id = public.my_student_id());
create policy "notas_escritura" on public.grades
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- announcements ----------
create policy "avisos_lectura" on public.announcements
for select using (
  public.is_teacher()
  or (
    publicado = true
    and school_id = public.my_school_id()
    and (school_year_id is null or school_year_id = public.my_year_id())
    and (group_id is null or group_id = public.my_group_id())
    and (subject_id is null or subject_id in (
      select subject_id from public.student_subjects where student_id = public.my_student_id()
    ))
  )
);
create policy "avisos_escritura" on public.announcements
for all using (public.is_teacher()) with check (public.is_teacher());

-- ---------- activity_logs ----------
-- Solo lectura para profesora/admin; escritura exclusiva vía service role.
create policy "logs_lectura" on public.activity_logs
for select using (public.is_teacher());
