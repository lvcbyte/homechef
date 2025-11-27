create table if not exists public.saved_recipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    recipe_name text not null,
    recipe_payload jsonb not null,
    saved_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shopping_lists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shopping_list_items (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null references public.shopping_lists (id) on delete cascade,
    name text not null,
    quantity text,
    completed boolean not null default false,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    provider text not null,
    status text not null default 'pending',
    auth_metadata jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.receipt_uploads (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    source text not null,
    storage_path text,
    parsed_payload jsonb,
    status text not null default 'processing',
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.saved_recipes enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.commerce_connections enable row level security;
alter table public.receipt_uploads enable row level security;

create policy "Saved recipes by owner" on public.saved_recipes
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Shopping lists by owner" on public.shopping_lists
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Shopping list items by owner" on public.shopping_list_items
    using (exists (
        select 1 from public.shopping_lists
        where shopping_lists.id = shopping_list_items.list_id
          and shopping_lists.user_id = auth.uid()
    )) with check (exists (
        select 1 from public.shopping_lists
        where shopping_lists.id = shopping_list_items.list_id
          and shopping_lists.user_id = auth.uid()
    ));

create policy "Commerce connections by owner" on public.commerce_connections
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Receipt uploads by owner" on public.receipt_uploads
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

