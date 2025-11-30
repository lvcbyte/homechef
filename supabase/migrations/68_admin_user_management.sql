-- Admin User Management Functions
-- Functions for managing users in the admin dashboard

-- Function to grant admin rights to a user
create or replace function admin_grant_admin_rights(
    p_user_id uuid,
    p_role text default 'admin'
)
returns void
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid := auth.uid();
begin
    -- Check if current user is admin
    if not is_admin(v_current_user_id) then
        raise exception 'Only admins can grant admin rights';
    end if;
    
    -- Validate role
    if p_role not in ('owner', 'admin', 'moderator', 'viewer') then
        raise exception 'Invalid admin role: %. Must be one of: owner, admin, moderator, viewer', p_role;
    end if;
    
    -- Ensure profile exists
    insert into public.profiles (
        id,
        archetype,
        dietary_restrictions,
        cooking_skill,
        is_admin,
        admin_role,
        admin_permissions
    )
    select
        p_user_id,
        'Minimalist',
        '[]'::jsonb,
        'Advanced',
        true,
        p_role,
        jsonb_build_object(
            'can_manage_users', p_role in ('owner', 'admin'),
            'can_manage_recipes', true,
            'can_manage_inventory', true,
            'can_view_logs', true,
            'can_modify_database', p_role = 'owner',
            'can_access_api', true
        )
    where not exists (select 1 from public.profiles where id = p_user_id)
    on conflict (id) do update
    set
        is_admin = true,
        admin_role = p_role,
        admin_permissions = jsonb_build_object(
            'can_manage_users', p_role in ('owner', 'admin'),
            'can_manage_recipes', true,
            'can_manage_inventory', true,
            'can_view_logs', true,
            'can_modify_database', p_role = 'owner',
            'can_access_api', true
        );
    
    -- Log action
    perform log_admin_action(
        'grant_admin_rights',
        'user',
        p_user_id,
        jsonb_build_object('role', p_role)
    );
end;
$$;

-- Function to revoke admin rights from a user
create or replace function admin_revoke_admin_rights(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid := auth.uid();
    v_target_is_owner boolean;
begin
    -- Check if current user is admin
    if not is_admin(v_current_user_id) then
        raise exception 'Only admins can revoke admin rights';
    end if;
    
    -- Prevent revoking from yourself
    if v_current_user_id = p_user_id then
        raise exception 'Cannot revoke admin rights from yourself';
    end if;
    
    -- Check if target is owner
    select admin_role = 'owner' into v_target_is_owner
    from public.profiles
    where id = p_user_id;
    
    -- Prevent revoking from owner (unless you're also owner)
    if v_target_is_owner then
        select admin_role = 'owner' into v_target_is_owner
        from public.profiles
        where id = v_current_user_id;
        
        if not v_target_is_owner then
            raise exception 'Only owners can revoke rights from other owners';
        end if;
    end if;
    
    -- Revoke admin rights
    update public.profiles
    set
        is_admin = false,
        admin_role = null,
        admin_permissions = '{}'::jsonb
    where id = p_user_id;
    
    -- Log action
    perform log_admin_action(
        'revoke_admin_rights',
        'user',
        p_user_id,
        jsonb_build_object('revoked', true)
    );
end;
$$;

-- Function to get detailed user information
create or replace function admin_get_user_details(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid := auth.uid();
    v_user_data jsonb;
begin
    -- Check if current user is admin
    if not is_admin(v_current_user_id) then
        raise exception 'Only admins can view user details';
    end if;
    
    -- Get user data
    select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'email_confirmed_at', u.email_confirmed_at,
        'is_admin', coalesce(p.is_admin, false),
        'admin_role', p.admin_role,
        'archetype', p.archetype,
        'cooking_skill', p.cooking_skill,
        'dietary_restrictions', p.dietary_restrictions,
        'total_recipes', (
            select count(*)::bigint 
            from public.recipes 
            where author = u.email
        ),
        'total_inventory_items', (
            select count(*)::bigint 
            from public.inventory 
            where user_id = u.id
        ),
        'total_saved_recipes', (
            select count(*)::bigint 
            from public.saved_recipes 
            where user_id = u.id
        ),
        'total_likes', (
            select count(*)::bigint 
            from public.recipe_likes 
            where user_id = u.id
        ),
        'recent_activity', (
            select jsonb_agg(jsonb_build_object(
                'action', action,
                'created_at', created_at,
                'resource_type', resource_type
            ) order by created_at desc)
            from public.admin_logs
            where admin_user_id = u.id
            limit 10
        )
    ) into v_user_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = p_user_id;
    
    if v_user_data is null then
        raise exception 'User not found';
    end if;
    
    return v_user_data;
end;
$$;

-- Function to update user profile (admin)
create or replace function admin_update_user_profile(
    p_user_id uuid,
    p_archetype text default null,
    p_cooking_skill text default null,
    p_dietary_restrictions jsonb default null
)
returns void
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid := auth.uid();
begin
    -- Check if current user is admin
    if not is_admin(v_current_user_id) then
        raise exception 'Only admins can update user profiles';
    end if;
    
    -- Update profile
    update public.profiles
    set
        archetype = coalesce(p_archetype, archetype),
        cooking_skill = coalesce(p_cooking_skill, cooking_skill),
        dietary_restrictions = coalesce(p_dietary_restrictions, dietary_restrictions)
    where id = p_user_id;
    
    -- Log action
    perform log_admin_action(
        'update_user_profile',
        'user',
        p_user_id,
        jsonb_build_object(
            'archetype', p_archetype,
            'cooking_skill', p_cooking_skill
        )
    );
end;
$$;

-- Grant permissions
grant execute on function admin_grant_admin_rights(uuid, text) to authenticated;
grant execute on function admin_revoke_admin_rights(uuid) to authenticated;
grant execute on function admin_get_user_details(uuid) to authenticated;
grant execute on function admin_update_user_profile(uuid, text, text, jsonb) to authenticated;

