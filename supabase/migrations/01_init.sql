-- HomeChef OS initial schema and seed data
create extension if not exists "pgcrypto";

-- Tables
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    archetype text not null,
    dietary_restrictions jsonb not null default '[]'::jsonb,
    cooking_skill text,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    category text,
    quantity_approx text,
    confidence_score real check (confidence_score between 0 and 1),
    expires_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recipes_cache (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    ingredients_json jsonb not null default '[]'::jsonb,
    steps_json jsonb not null default '[]'::jsonb,
    macros jsonb not null default '{}'::jsonb,
    relevance_score real not null default 0,
    generated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    photo_urls text[] not null default '{}',
    processed_status text not null default 'pending',
    created_at timestamptz not null default timezone('utc', now())
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.inventory enable row level security;
alter table public.recipes_cache enable row level security;
alter table public.scan_sessions enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
    for select using (auth.uid() = id);

create policy "Profiles are maintainable by owner" on public.profiles
    for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Inventory readable by owner" on public.inventory
    for select using (auth.uid() = user_id);

create policy "Inventory maintainable by owner" on public.inventory
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Recipes readable by owner" on public.recipes_cache
    for select using (auth.uid() = user_id);

create policy "Recipes maintainable by owner" on public.recipes_cache
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Scan sessions readable by owner" on public.scan_sessions
    for select using (auth.uid() = user_id);

create policy "Scan sessions maintainable by owner" on public.scan_sessions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed Data
with seed_users as (
    select * from (values
        ('8bb3a2f2-3f3c-4a35-9a3d-7e04bd8c5c10'::uuid, 'minimalist@homechef.dev'),
        ('1c1c134d-4b42-4f37-967b-824e0b59d9c1'::uuid, 'biohacker@homechef.dev'),
        ('c4da5b9f-d5a3-4e4a-8595-0aabd7f3685a'::uuid, 'flavorhunter@homechef.dev'),
        ('4e7c0142-6414-4e93-948c-2c4a6d6db566'::uuid, 'mealprepper@homechef.dev'),
        ('fa1c4f54-2a7c-4c19-8373-7b1f8caf7e61'::uuid, 'familymanager@homechef.dev')
    ) as t(id, email)
)
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, invited_at, confirmation_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role)
select
    id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    email,
    crypt('Password123!', gen_salt('bf')),
    timezone('utc', now()),
    null,
    timezone('utc', now()),
    timezone('utc', now()),
    jsonb_build_object('provider', 'email'),
    '{}'::jsonb,
    'authenticated',
    'authenticated'
from seed_users
on conflict (id) do nothing;

insert into public.profiles (id, archetype, dietary_restrictions, cooking_skill)
values
    ('8bb3a2f2-3f3c-4a35-9a3d-7e04bd8c5c10', 'Minimalist', '["dairy-free"]'::jsonb, 'Beginner'),
    ('1c1c134d-4b42-4f37-967b-824e0b59d9c1', 'Bio-Hacker', '["gluten-free","nut-free"]'::jsonb, 'Advanced'),
    ('c4da5b9f-d5a3-4e4a-8595-0aabd7f3685a', 'Flavor Hunter', '[]'::jsonb, 'Intermediate'),
    ('4e7c0142-6414-4e93-948c-2c4a6d6db566', 'Meal Prepper', '["vegetarian"]'::jsonb, 'Intermediate'),
    ('fa1c4f54-2a7c-4c19-8373-7b1f8caf7e61', 'Family Manager', '["peanut-free"]'::jsonb, 'Beginner')
on conflict (id) do update set
    archetype = excluded.archetype,
    dietary_restrictions = excluded.dietary_restrictions,
    cooking_skill = excluded.cooking_skill;

insert into public.inventory (id, user_id, name, category, quantity_approx, confidence_score, expires_at)
values
    (gen_random_uuid(), '8bb3a2f2-3f3c-4a35-9a3d-7e04bd8c5c10', 'Spinach', 'Produce', '1 bag', 0.92, timezone('utc', now()) + interval '3 days'),
    (gen_random_uuid(), '8bb3a2f2-3f3c-4a35-9a3d-7e04bd8c5c10', 'Almond Milk', 'Dairy Alternatives', '50%', 0.88, timezone('utc', now()) + interval '5 days'),
    (gen_random_uuid(), '8bb3a2f2-3f3c-4a35-9a3d-7e04bd8c5c10', 'Blueberries', 'Produce', '12 oz', 0.81, timezone('utc', now()) + interval '4 days'),
    (gen_random_uuid(), '1c1c134d-4b42-4f37-967b-824e0b59d9c1', 'Chia Seeds', 'Pantry', '1 jar', 0.95, timezone('utc', now()) + interval '90 days'),
    (gen_random_uuid(), '1c1c134d-4b42-4f37-967b-824e0b59d9c1', 'Avocados', 'Produce', '3 items', 0.74, timezone('utc', now()) + interval '2 days'),
    (gen_random_uuid(), '1c1c134d-4b42-4f37-967b-824e0b59d9c1', 'Kombucha', 'Beverages', '2 bottles', 0.77, timezone('utc', now()) + interval '14 days'),
    (gen_random_uuid(), 'c4da5b9f-d5a3-4e4a-8595-0aabd7f3685a', 'Fresh Basil', 'Produce', '1 bunch', 0.84, timezone('utc', now()) + interval '2 days'),
    (gen_random_uuid(), 'c4da5b9f-d5a3-4e4a-8595-0aabd7f3685a', 'Parmigiano Reggiano', 'Dairy', '30%', 0.86, timezone('utc', now()) + interval '20 days'),
    (gen_random_uuid(), 'c4da5b9f-d5a3-4e4a-8595-0aabd7f3685a', 'Cherry Tomatoes', 'Produce', '1 pint', 0.9, timezone('utc', now()) + interval '5 days'),
    (gen_random_uuid(), '4e7c0142-6414-4e93-948c-2c4a6d6db566', 'Brown Rice', 'Pantry', '5 cups', 0.98, timezone('utc', now()) + interval '180 days'),
    (gen_random_uuid(), '4e7c0142-6414-4e93-948c-2c4a6d6db566', 'Chicken Breast', 'Protein', '6 pieces', 0.82, timezone('utc', now()) + interval '2 days'),
    (gen_random_uuid(), '4e7c0142-6414-4e93-948c-2c4a6d6db566', 'Broccoli', 'Produce', '4 crowns', 0.8, timezone('utc', now()) + interval '4 days'),
    (gen_random_uuid(), 'fa1c4f54-2a7c-4c19-8373-7b1f8caf7e61', 'Whole Milk', 'Dairy', '80%', 0.91, timezone('utc', now()) + interval '7 days'),
    (gen_random_uuid(), 'fa1c4f54-2a7c-4c19-8373-7b1f8caf7e61', 'Eggs', 'Protein', '10 items', 0.97, timezone('utc', now()) + interval '14 days'),
    (gen_random_uuid(), 'fa1c4f54-2a7c-4c19-8373-7b1f8caf7e61', 'Cheddar Cheese', 'Dairy', '40%', 0.83, timezone('utc', now()) + interval '21 days'),
    (gen_random_uuid(), 'fa1c4f54-2a7c-4c19-8373-7b1f8caf7e61', 'Baby Carrots', 'Produce', '1 bag', 0.76, timezone('utc', now()) + interval '10 days'),
    (gen_random_uuid(), '1c1c134d-4b42-4f37-967b-824e0b59d9c1', 'Greek Yogurt', 'Dairy', '2 cups', 0.79, timezone('utc', now()) + interval '6 days'),
    (gen_random_uuid(), 'c4da5b9f-d5a3-4e4a-8595-0aabd7f3685a', 'Sourdough Starter', 'Pantry', '1 jar', 0.7, timezone('utc', now()) + interval '12 days'),
    (gen_random_uuid(), '8bb3a2f2-3f3c-4a35-9a3d-7e04bd8c5c10', 'Tofu', 'Protein', '2 blocks', 0.78, timezone('utc', now()) + interval '5 days'),
    (gen_random_uuid(), '4e7c0142-6414-4e93-948c-2c4a6d6db566', 'Roasted Almonds', 'Snacks', '1 jar', 0.75, timezone('utc', now()) + interval '60 days')
on conflict do nothing;

