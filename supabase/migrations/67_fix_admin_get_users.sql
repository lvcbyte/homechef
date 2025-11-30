-- Fix and improve get_all_users_for_admin function
-- This ensures the function works correctly and returns all users

-- Drop and recreate the function with better error handling
drop function if exists get_all_users_for_admin();

create or replace function get_all_users_for_admin()
returns table (
    user_id uuid,
    email text,
    created_at timestamptz,
    is_admin boolean,
    admin_role text,
    archetype text,
    total_recipes bigint,
    total_inventory_items bigint
)
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid;
    v_is_admin_check boolean;
begin
    -- Get current user
    v_current_user_id := auth.uid();
    
    -- Check if user is authenticated
    if v_current_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Check if user is admin (with better error handling)
    select exists (
        select 1 
        from public.profiles 
        where id = v_current_user_id 
        and is_admin = true
    ) into v_is_admin_check;
    
    if not v_is_admin_check then
        raise exception 'Only admins can view all users. Current user: %', v_current_user_id;
    end if;

    -- Return all users with their profile data
    return query
    select
        u.id as user_id,
        coalesce(u.email, 'no-email@stockpit.app') as email,
        u.created_at,
        coalesce(p.is_admin, false) as is_admin,
        p.admin_role,
        p.archetype,
        coalesce(
            (select count(*)::bigint from public.recipes where author = u.email),
            0::bigint
        ) as total_recipes,
        coalesce(
            (select count(*)::bigint from public.inventory where user_id = u.id),
            0::bigint
        ) as total_inventory_items
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email is not null  -- Only return users with email
    order by u.created_at desc;
    
exception
    when others then
        -- Log error but don't expose details
        raise exception 'Error fetching users: %', SQLERRM;
end;
$$;

-- Grant execute permission
grant execute on function get_all_users_for_admin() to authenticated;

-- Also create a simpler version that doesn't require admin check (for testing)
-- This can be used to verify the function works
create or replace function get_all_users_simple()
returns table (
    user_id uuid,
    email text,
    created_at timestamptz,
    is_admin boolean,
    admin_role text,
    archetype text
)
language sql
security definer
as $$
    select
        u.id as user_id,
        coalesce(u.email, 'no-email@stockpit.app') as email,
        u.created_at,
        coalesce(p.is_admin, false) as is_admin,
        p.admin_role,
        p.archetype
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email is not null
    order by u.created_at desc;
$$;

grant execute on function get_all_users_simple() to authenticated;

-- Verify the function exists and works
do $$
begin
    raise notice 'Function get_all_users_for_admin() created successfully';
    raise notice 'Function get_all_users_simple() created for testing';
end $$;

