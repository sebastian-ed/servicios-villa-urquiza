-- Servicios Villa Urquiza - esquema inicial
-- Ejecutar en Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_description text not null,
  description text not null,
  address text,
  neighborhood text not null default 'Villa Urquiza',
  city text not null default 'CABA',
  whatsapp text,
  email text,
  website text,
  image_url text,
  is_active boolean not null default true,
  approved boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_categories (
  provider_id uuid not null references public.providers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (provider_id, category_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  author_name text not null,
  author_email text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) >= 10),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- recrear trigger si ya existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
END $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'providers_set_updated_at'
  ) THEN
    DROP TRIGGER providers_set_updated_at ON public.providers;
  END IF;
END $$;

create trigger providers_set_updated_at
before update on public.providers
for each row execute procedure public.set_updated_at();

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.providers enable row level security;
alter table public.provider_categories enable row level security;
alter table public.reviews enable row level security;

-- profiles
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

-- categories
create policy "categories_public_read"
on public.categories
for select
using (true);

create policy "categories_admin_write"
on public.categories
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- providers
create policy "providers_public_read_visible"
on public.providers
for select
using (is_active = true and approved = true or public.is_admin(auth.uid()));

create policy "providers_admin_write"
on public.providers
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- provider_categories
create policy "provider_categories_public_read"
on public.provider_categories
for select
using (true);

create policy "provider_categories_admin_write"
on public.provider_categories
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- reviews
create policy "reviews_public_read_approved"
on public.reviews
for select
using (status = 'approved' or public.is_admin(auth.uid()));

create policy "reviews_public_insert"
on public.reviews
for insert
with check (status = 'pending');

create policy "reviews_admin_update"
on public.reviews
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "reviews_admin_delete"
on public.reviews
for delete
using (public.is_admin(auth.uid()));

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_providers_created_by on public.providers(created_by);
create index if not exists idx_providers_active_approved on public.providers(is_active, approved);
create index if not exists idx_provider_categories_provider on public.provider_categories(provider_id);
create index if not exists idx_provider_categories_category on public.provider_categories(category_id);
create index if not exists idx_reviews_provider_status on public.reviews(provider_id, status);

-- Datos semilla opcionales
insert into public.categories (name, slug)
values
  ('Electricistas', 'electricistas'),
  ('Plomeros', 'plomeros'),
  ('Peluquerías', 'peluquerias'),
  ('Técnicos de PC', 'tecnicos-de-pc'),
  ('Limpieza', 'limpieza')
on conflict (slug) do nothing;

-- Para promover un usuario existente a admin:
-- update public.profiles set role = 'admin' where id = 'UUID_DEL_USUARIO';
-- o por email:
-- update public.profiles p
-- set role = 'admin'
-- from auth.users u
-- where p.id = u.id and u.email = 'tu-admin@dominio.com';
