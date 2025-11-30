-- Fix admin_grant_admin_rights function
-- Ensure it works correctly with existing profiles

-- Drop existing function first (to change return type)
drop function if exists admin_grant_admin_rights(uuid, text);

-- Create improved function with jsonb return type
create or replace function admin_grant_admin_rights(
    p_user_id uuid,
    p_role text default 'admin'
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid := auth.uid();
    v_profile_exists boolean;
    v_result jsonb;
begin
    -- Check if current user is admin
    if not is_admin(v_current_user_id) then
        raise exception 'Only admins can grant admin rights';
    end if;
    
    -- Validate role
    if p_role not in ('owner', 'admin', 'moderator', 'viewer') then
        raise exception 'Invalid admin role: %. Must be one of: owner, admin, moderator, viewer', p_role;
    end if;
    
    -- Check if profile exists
    select exists(select 1 from public.profiles where id = p_user_id) into v_profile_exists;
    
    if v_profile_exists then
        -- Update existing profile
        update public.profiles
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
            )
        where id = p_user_id;
    else
        -- Insert new profile
        insert into public.profiles (
            id,
            archetype,
            dietary_restrictions,
            cooking_skill,
            is_admin,
            admin_role,
            admin_permissions
        )
        values (
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
        );
    end if;
    
    -- Log action
    perform log_admin_action(
        'grant_admin_rights',
        'user',
        p_user_id,
        jsonb_build_object('role', p_role, 'action', 'granted')
    );
    
    -- Return success
    return jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'role', p_role,
        'message', 'Admin rights granted successfully'
    );
    
exception
    when others then
        raise exception 'Error granting admin rights: %', SQLERRM;
end;
$$;

-- Grant permissions
grant execute on function admin_grant_admin_rights(uuid, text) to authenticated;

-- Test the function (commented out - uncomment to test)
-- SELECT admin_grant_admin_rights('USER_ID_HERE', 'admin');

