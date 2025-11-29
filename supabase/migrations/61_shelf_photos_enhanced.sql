-- Enhanced shelf photos table with notes and analysis status
-- This replaces the basic scan_photos approach with a dedicated shelf system

-- Create shelf_photos table
create table if not exists public.shelf_photos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    storage_path text not null,
    file_size_bytes bigint not null default 0,
    notes text,
    analysis_status text not null default 'pending' check (analysis_status in ('pending', 'processing', 'completed', 'failed')),
    analyzed_at timestamptz,
    items_detected_count integer default 0,
    items_matched_count integer default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Create index for faster queries
create index if not exists idx_shelf_photos_user_created on public.shelf_photos(user_id, created_at desc);
create index if not exists idx_shelf_photos_analysis_status on public.shelf_photos(analysis_status);

-- Create shelf_photo_analysis table to store AI analysis results
create table if not exists public.shelf_photo_analysis (
    id uuid primary key default gen_random_uuid(),
    shelf_photo_id uuid not null references public.shelf_photos (id) on delete cascade,
    detected_item_name text not null,
    detected_quantity text,
    confidence_score numeric(5, 2) default 0.0,
    matched_product_id uuid references public.product_catalog (id),
    matched_product_name text,
    inventory_item_id uuid references public.inventory (id),
    created_at timestamptz not null default timezone('utc', now())
);

-- Create index for analysis queries
create index if not exists idx_shelf_photo_analysis_photo on public.shelf_photo_analysis(shelf_photo_id);
create index if not exists idx_shelf_photo_analysis_matched on public.shelf_photo_analysis(matched_product_id);

-- Enable RLS
alter table public.shelf_photos enable row level security;
alter table public.shelf_photo_analysis enable row level security;

-- RLS policies for shelf_photos
create policy "Users can view their own shelf photos"
    on public.shelf_photos
    for select
    using (auth.uid() = user_id);

create policy "Users can insert their own shelf photos"
    on public.shelf_photos
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own shelf photos"
    on public.shelf_photos
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own shelf photos"
    on public.shelf_photos
    for delete
    using (auth.uid() = user_id);

-- RLS policies for shelf_photo_analysis
create policy "Users can view analysis of their shelf photos"
    on public.shelf_photo_analysis
    for select
    using (
        exists (
            select 1 from public.shelf_photos
            where shelf_photos.id = shelf_photo_analysis.shelf_photo_id
            and shelf_photos.user_id = auth.uid()
        )
    );

create policy "System can insert analysis results"
    on public.shelf_photo_analysis
    for insert
    with check (
        exists (
            select 1 from public.shelf_photos
            where shelf_photos.id = shelf_photo_analysis.shelf_photo_id
            and shelf_photos.user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
create or replace function update_shelf_photos_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_shelf_photos_updated_at_trigger
    before update on public.shelf_photos
    for each row
    execute function update_shelf_photos_updated_at();

-- Function to check and enforce 10 photo limit per user
create or replace function check_shelf_photo_limit()
returns trigger as $$
declare
    photo_count integer;
begin
    -- Count existing photos for this user
    select count(*) into photo_count
    from public.shelf_photos
    where user_id = new.user_id;
    
    -- If already at limit, delete oldest photo
    if photo_count >= 10 then
        delete from public.shelf_photos
        where id = (
            select id
            from public.shelf_photos
            where user_id = new.user_id
            order by created_at asc
            limit 1
        );
    end if;
    
    return new;
end;
$$ language plpgsql;

-- Trigger to enforce 10 photo limit
create trigger check_shelf_photo_limit_trigger
    before insert on public.shelf_photos
    for each row
    execute function check_shelf_photo_limit();

-- Function to get total storage used by user (in MB)
create or replace function get_user_shelf_storage_mb(p_user_id uuid)
returns numeric(10, 2) as $$
declare
    total_bytes bigint;
begin
    select coalesce(sum(file_size_bytes), 0) into total_bytes
    from public.shelf_photos
    where user_id = p_user_id;
    
    return round((total_bytes::numeric / 1024 / 1024), 2);
end;
$$ language plpgsql security definer;

-- Function to clean up old photos and free storage (keeps last 10)
create or replace function cleanup_old_shelf_photos(p_user_id uuid)
returns integer as $$
declare
    deleted_count integer;
begin
    -- Delete photos beyond the 10 most recent
    with ranked_photos as (
        select id, storage_path
        from public.shelf_photos
        where user_id = p_user_id
        order by created_at desc
        offset 10
    )
    delete from public.shelf_photos
    where id in (select id from ranked_photos);
    
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$ language plpgsql security definer;

-- Function to update analysis status and counts
create or replace function update_shelf_photo_analysis(
    p_shelf_photo_id uuid,
    p_status text,
    p_items_detected integer default null,
    p_items_matched integer default null
)
returns void as $$
begin
    update public.shelf_photos
    set 
        analysis_status = p_status,
        analyzed_at = case when p_status = 'completed' then timezone('utc', now()) else analyzed_at end,
        items_detected_count = coalesce(p_items_detected, items_detected_count),
        items_matched_count = coalesce(p_items_matched, items_matched_count),
        updated_at = timezone('utc', now())
    where id = p_shelf_photo_id;
end;
$$ language plpgsql security definer;

-- Function to match detected items with product catalog
create or replace function match_shelf_item_to_catalog(
    p_item_name text,
    p_user_id uuid
)
returns table (
    product_id uuid,
    product_name text,
    match_score numeric
) as $$
begin
    return query
    select 
        pc.id as product_id,
        pc.name as product_name,
        -- Simple text similarity matching (can be improved with pg_trgm)
        case 
            when lower(pc.name) = lower(p_item_name) then 100.0
            when lower(pc.name) like '%' || lower(p_item_name) || '%' then 80.0
            when lower(p_item_name) like '%' || lower(pc.name) || '%' then 70.0
            else 50.0
        end as match_score
    from public.product_catalog pc
    where 
        lower(pc.name) like '%' || lower(p_item_name) || '%'
        or lower(p_item_name) like '%' || lower(pc.name) || '%'
    order by match_score desc
    limit 5;
end;
$$ language plpgsql security definer;

-- View for shelf photos grouped by week
create or replace view shelf_photos_by_week as
select 
    sp.id,
    sp.user_id,
    sp.storage_path,
    sp.notes,
    sp.analysis_status,
    sp.items_detected_count,
    sp.items_matched_count,
    sp.created_at,
    sp.updated_at,
    date_trunc('week', sp.created_at) as week_start,
    to_char(date_trunc('week', sp.created_at), 'YYYY-"W"IW') as week_label,
    extract(week from sp.created_at) as week_number,
    extract(year from sp.created_at) as year
from public.shelf_photos sp;

-- Grant permissions
grant select, insert, update, delete on public.shelf_photos to authenticated;
grant select, insert on public.shelf_photo_analysis to authenticated;
grant select on shelf_photos_by_week to authenticated;

