-- Function to get all users for admin dashboard
-- This function allows admins to view all users with their emails

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
begin
    -- Check if user is admin
    if not is_admin(auth.uid()) then
        raise exception 'Only admins can view all users';
    end if;

    return query
    select
        u.id as user_id,
        u.email,
        u.created_at,
        coalesce(p.is_admin, false) as is_admin,
        p.admin_role,
        p.archetype,
        (select count(*) from public.recipes where author = u.email) as total_recipes,
        (select count(*) from public.inventory where user_id = u.id) as total_inventory_items
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

grant execute on function get_all_users_for_admin() to authenticated;

