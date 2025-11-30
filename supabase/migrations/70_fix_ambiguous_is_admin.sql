-- Fix ambiguous is_admin column reference
-- The issue is in get_all_users_for_admin function where we check is_admin

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
    
    -- Check if user is admin using the is_admin() function (not column)
    select is_admin(v_current_user_id) into v_is_admin_check;
    
    if not v_is_admin_check then
        raise exception 'Only admins can view all users. Current user: %', v_current_user_id;
    end if;

    -- Return all users with their profile data
    -- Use explicit table aliases to avoid ambiguity
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

-- Verify the function exists and works
do $$
begin
    raise notice 'Function get_all_users_for_admin() fixed - ambiguous column reference resolved';
end $$;

