-- Fix household functions - Add missing GRANT EXECUTE and set search_path
-- This migration fixes the remove_household_member function and ensures proper permissions

-- Fix remove_household_member function
create or replace function remove_household_member(
    p_household_id uuid,
    p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_user_id uuid;
    v_is_owner_or_admin boolean;
    v_target_role text;
    v_owner_count integer;
begin
    v_current_user_id := auth.uid();
    
    if v_current_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Get target user's role
    select role into v_target_role
    from public.household_members
    where household_id = p_household_id
    and user_id = p_user_id;
    
    if v_target_role is null then
        raise exception 'User is not a member of this household';
    end if;
    
    -- Check if current user is owner/admin
    select exists (
        select 1 from public.household_members hm
        where hm.household_id = p_household_id
        and hm.user_id = v_current_user_id
        and hm.role in ('owner', 'admin')
    ) into v_is_owner_or_admin;
    
    -- Allow if user is removing themselves or is owner/admin
    if v_current_user_id != p_user_id and not v_is_owner_or_admin then
        raise exception 'Only owners and admins can remove members';
    end if;
    
    -- Prevent removing the last owner
    if v_target_role = 'owner' then
        select count(*) into v_owner_count
        from public.household_members
        where household_id = p_household_id
        and role = 'owner';
        
        if v_owner_count <= 1 then
            raise exception 'Cannot remove the last owner of a household';
        end if;
    end if;
    
    -- Remove member
    delete from public.household_members
    where household_id = p_household_id
    and user_id = p_user_id;
    
    return true;
end;
$$;

-- Grant execute permission
grant execute on function remove_household_member(uuid, uuid) to authenticated;

-- Also ensure get_household_members has proper permissions
grant execute on function get_household_members(uuid) to authenticated;

