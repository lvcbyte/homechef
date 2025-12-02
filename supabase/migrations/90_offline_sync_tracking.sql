-- Offline Sync Tracking Migration
-- Adds tables and functions for tracking offline sync operations

-- ============================================
-- 1. OFFLINE SYNC LOG TABLE
-- ============================================
create table if not exists public.offline_sync_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    table_name text not null,
    operation text not null check (operation in ('insert', 'update', 'delete')),
    item_id uuid,
    data jsonb,
    synced_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_offline_sync_log_user_id on public.offline_sync_log(user_id);
create index if not exists idx_offline_sync_log_synced_at on public.offline_sync_log(synced_at desc);

alter table public.offline_sync_log enable row level security;

create policy "Users can view their own sync logs" on public.offline_sync_log
    for select using (auth.uid() = user_id);

-- ============================================
-- 2. FUNCTION TO LOG SYNC OPERATION
-- ============================================
create or replace function log_sync_operation(
    p_user_id uuid,
    p_table_name text,
    p_operation text,
    p_item_id uuid,
    p_data jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_log_id uuid;
begin
    insert into public.offline_sync_log (
        user_id,
        table_name,
        operation,
        item_id,
        data
    )
    values (
        p_user_id,
        p_table_name,
        p_operation,
        p_item_id,
        p_data
    )
    returning id into v_log_id;
    
    return v_log_id;
end;
$$;

-- ============================================
-- 3. GRANT PERMISSIONS
-- ============================================
grant execute on function log_sync_operation(uuid, text, text, uuid, jsonb) to authenticated;

