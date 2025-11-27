create table if not exists public.barcode_catalog (
    ean text primary key,
    brand text,
    product_name text not null,
    default_quantity text,
    shelf_life_days integer
);

create table if not exists public.barcode_scans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    ean text not null references public.barcode_catalog (ean),
    expires_at date,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quick_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    quantity text,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_photos (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.scan_sessions (id) on delete cascade,
    storage_path text not null,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.barcode_scans enable row level security;
alter table public.quick_entries enable row level security;
alter table public.scan_photos enable row level security;

create policy "Barcode scans by owner" on public.barcode_scans
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Quick entries by owner" on public.quick_entries
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Scan photos by owner" on public.scan_photos
    using (
        exists (
            select 1 from public.scan_sessions
            where scan_sessions.id = scan_photos.session_id
              and scan_sessions.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.scan_sessions
            where scan_sessions.id = scan_photos.session_id
              and scan_sessions.user_id = auth.uid()
        )
    );

