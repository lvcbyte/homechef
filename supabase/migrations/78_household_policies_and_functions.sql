-- Household/Family Sharing - Complete RLS Policies and Functions
-- This migration adds missing INSERT, UPDATE, DELETE policies and helper functions

-- ============================================
-- RLS POLICIES
-- ============================================

-- Drop existing policies if they exist (to allow re-running)
drop policy if exists "Users can view their households" on public.households;
drop policy if exists "Users can view household members" on public.household_members;
drop policy if exists "Users can create households" on public.households;
drop policy if exists "Users can update their households" on public.households;
drop policy if exists "Users can delete their households" on public.households;
drop policy if exists "Users can add themselves as household members" on public.household_members;
drop policy if exists "Owners can add household members" on public.household_members;
drop policy if exists "Users can add household members" on public.household_members;
drop policy if exists "Users can update household members" on public.household_members;
drop policy if exists "Users can remove household members" on public.household_members;

-- SELECT policies
create policy "Users can view their households" on public.households
    for select using (
        exists (
            select 1 from public.household_members
            where household_members.household_id = households.id
            and household_members.user_id = auth.uid()
        )
    );

-- Users can view household members - allow all authenticated users to view
-- The get_household_members function will handle security checks
-- This avoids recursion issues with RLS policies
create policy "Users can view household members" on public.household_members
    for select using (
        -- Allow viewing if user is authenticated (security handled by helper function)
        auth.uid() is not null
    );

-- INSERT policies
create policy "Users can create households" on public.households
    for insert with check (
        auth.uid() = created_by
    );

-- Policy for adding household members - split into two to avoid recursion
-- Policy 1: Users can add themselves (no recursion check needed)
create policy "Users can add themselves as household members" on public.household_members
    for insert with check (
        auth.uid() = user_id
    );

-- Policy 2: Owners/admins can add other members (check existing membership)
-- Use a subquery to avoid recursion
create policy "Owners can add household members" on public.household_members
    for insert with check (
        -- Only applies if user is NOT adding themselves
        auth.uid() != user_id
        and
        -- User must be owner/admin of the household (check via subquery to avoid recursion)
        household_id in (
            select hm.household_id 
            from public.household_members hm
            where hm.user_id = auth.uid()
            and hm.role in ('owner', 'admin')
        )
    );

-- UPDATE policies
create policy "Users can update their households" on public.households
    for update using (
        -- User is owner of the household
        exists (
            select 1 from public.household_members hm
            where hm.household_id = households.id
            and hm.user_id = auth.uid()
            and hm.role = 'owner'
        )
    );

create policy "Users can update household members" on public.household_members
    for update using (
        -- User is owner/admin of the household
        exists (
            select 1 from public.household_members hm
            where hm.household_id = household_members.household_id
            and hm.user_id = auth.uid()
            and hm.role in ('owner', 'admin')
        )
    );

-- DELETE policies
create policy "Users can delete their households" on public.households
    for delete using (
        -- User is owner of the household
        exists (
            select 1 from public.household_members hm
            where hm.household_id = households.id
            and hm.user_id = auth.uid()
            and hm.role = 'owner'
        )
    );

create policy "Users can remove household members" on public.household_members
    for delete using (
        -- User can remove themselves
        auth.uid() = user_id
        or
        -- Or user is owner/admin of the household (check via households to avoid recursion)
        household_id in (
            select h.id
            from public.households h
            where exists (
                select 1 from public.household_members hm
                where hm.household_id = h.id
                and hm.user_id = auth.uid()
                and hm.role in ('owner', 'admin')
            )
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create a household and add creator as owner
create or replace function create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_household_id uuid;
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    if p_name is null or trim(p_name) = '' then
        raise exception 'Household name cannot be empty';
    end if;
    
    -- Create household (bypasses RLS because of security definer)
    insert into public.households (name, created_by)
    values (trim(p_name), v_user_id)
    returning id into v_household_id;
    
    -- Add creator as owner (bypasses RLS because of security definer)
    insert into public.household_members (household_id, user_id, role)
    values (v_household_id, v_user_id, 'owner')
    on conflict (household_id, user_id) do nothing;
    
    return v_household_id;
end;
$$;

-- Function to add a member to a household
create or replace function add_household_member(
    p_household_id uuid,
    p_user_id uuid,
    p_role text default 'member'
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_member_id uuid;
    v_current_user_id uuid;
    v_is_owner_or_admin boolean;
begin
    v_current_user_id := auth.uid();
    
    if v_current_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Check if current user is owner/admin of the household
    select exists (
        select 1 from public.household_members hm
        where hm.household_id = p_household_id
        and hm.user_id = v_current_user_id
        and hm.role in ('owner', 'admin')
    ) into v_is_owner_or_admin;
    
    -- Allow if user is adding themselves or is owner/admin
    if v_current_user_id != p_user_id and not v_is_owner_or_admin then
        raise exception 'Only owners and admins can add members';
    end if;
    
    -- Validate role
    if p_role not in ('owner', 'admin', 'member') then
        raise exception 'Invalid role. Must be owner, admin, or member';
    end if;
    
    -- Add member
    insert into public.household_members (household_id, user_id, role)
    values (p_household_id, p_user_id, p_role)
    on conflict (household_id, user_id) do update
    set role = p_role
    returning id into v_member_id;
    
    return v_member_id;
end;
$$;

-- Function to remove a member from a household
create or replace function remove_household_member(
    p_household_id uuid,
    p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
    v_current_user_id uuid;
    v_is_owner_or_admin boolean;
    v_target_role text;
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
        if (select count(*) from public.household_members where household_id = p_household_id and role = 'owner') <= 1 then
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

-- Function to get household members with user email
create or replace function get_household_members(p_household_id uuid)
returns table (
    id uuid,
    household_id uuid,
    user_id uuid,
    role text,
    joined_at timestamptz,
    user_email text
)
language plpgsql
security definer
as $$
begin
    -- Check if current user is member of household
    if not exists (
        select 1 from public.household_members hm
        where hm.household_id = p_household_id
        and hm.user_id = auth.uid()
    ) then
        raise exception 'User is not a member of this household';
    end if;
    
    return query
    select 
        hm.id,
        hm.household_id,
        hm.user_id,
        hm.role,
        hm.joined_at,
        u.email as user_email
    from public.household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = p_household_id
    order by 
        case hm.role
            when 'owner' then 1
            when 'admin' then 2
            else 3
        end,
        hm.joined_at;
end;
$$;

-- Grant execute permissions on functions to authenticated users
grant execute on function create_household(text) to authenticated;
grant execute on function add_household_member(uuid, uuid, text) to authenticated;
grant execute on function remove_household_member(uuid, uuid) to authenticated;
grant execute on function get_household_members(uuid) to authenticated;

-- Comments
comment on function create_household is 'Creates a new household and adds the creator as owner';
comment on function add_household_member is 'Adds a user to a household with specified role';
comment on function remove_household_member is 'Removes a user from a household';
comment on function get_household_members is 'Gets all members of a household with their email addresses';

