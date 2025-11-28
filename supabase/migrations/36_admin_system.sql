-- Admin System Setup
-- This migration creates the admin infrastructure

-- Admin users table (extends profiles)
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists admin_role text check (admin_role in ('owner', 'admin', 'moderator', 'viewer'));
alter table public.profiles add column if not exists admin_permissions jsonb default '{}'::jsonb;

-- Create admin user (ADMINDIETMAR)
-- Note: You'll need to create the auth user first, then update the profile
-- This is a helper function to set admin status
create or replace function set_admin_user(p_user_id uuid, p_role text default 'owner')
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set 
    is_admin = true,
    admin_role = p_role,
    admin_permissions = jsonb_build_object(
      'can_manage_users', true,
      'can_manage_recipes', true,
      'can_manage_inventory', true,
      'can_view_logs', true,
      'can_modify_database', true,
      'can_access_api', true
    )
  where id = p_user_id;
end;
$$;

-- Admin activity logs
create table if not exists public.admin_logs (
    id uuid primary key default gen_random_uuid(),
    admin_user_id uuid references auth.users(id) on delete set null,
    action text not null,
    resource_type text,
    resource_id uuid,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_logs_admin_user_id_idx on public.admin_logs(admin_user_id);
create index if not exists admin_logs_created_at_idx on public.admin_logs(created_at desc);
create index if not exists admin_logs_action_idx on public.admin_logs(action);

-- RLS for admin_logs
alter table public.admin_logs enable row level security;

create policy "Admins can view all logs"
    on public.admin_logs
    for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and is_admin = true
        )
    );

create policy "Admins can insert logs"
    on public.admin_logs
    for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and is_admin = true
        )
    );

-- API keys table for external integrations
create table if not exists public.api_keys (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    key_hash text not null unique,
    created_by uuid references auth.users(id) on delete set null,
    permissions jsonb default '{}'::jsonb,
    expires_at timestamptz,
    last_used_at timestamptz,
    is_active boolean default true,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);
create index if not exists api_keys_created_by_idx on public.api_keys(created_by);

alter table public.api_keys enable row level security;

create policy "Admins can manage API keys"
    on public.api_keys
    for all
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and is_admin = true
        )
    );

-- System metrics table
create table if not exists public.system_metrics (
    id uuid primary key default gen_random_uuid(),
    metric_type text not null,
    metric_value numeric,
    metric_data jsonb,
    recorded_at timestamptz not null default timezone('utc', now())
);

create index if not exists system_metrics_type_idx on public.system_metrics(metric_type);
create index if not exists system_metrics_recorded_at_idx on public.system_metrics(recorded_at desc);

alter table public.system_metrics enable row level security;

create policy "Admins can view metrics"
    on public.system_metrics
    for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and is_admin = true
        )
    );

-- Function to check if user is admin
create or replace function is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1 from public.profiles
        where id = p_user_id and is_admin = true
    );
$$;

-- Function to log admin activity
create or replace function log_admin_action(
    p_action text,
    p_resource_type text default null,
    p_resource_id uuid default null,
    p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can log actions';
    end if;
    
    insert into public.admin_logs (
        admin_user_id,
        action,
        resource_type,
        resource_id,
        details
    ) values (
        v_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details
    );
end;
$$;

-- Grant permissions
grant execute on function is_admin(uuid) to authenticated;
grant execute on function log_admin_action(text, text, uuid, jsonb) to authenticated;
grant execute on function set_admin_user(uuid, text) to authenticated;

-- Helper: Create admin user after auth signup
-- You'll need to run this manually after creating the auth user:
-- SELECT set_admin_user('USER_ID_HERE', 'owner');

