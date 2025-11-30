-- Household Invitations System
-- Allows users to invite others to join their household

-- ============================================
-- 1. HOUSEHOLD INVITATIONS TABLE
-- ============================================

create table if not exists public.household_invitations (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    inviter_id uuid not null references auth.users (id) on delete cascade,
    invitee_id uuid not null references auth.users (id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at timestamptz not null default timezone('utc', now()),
    responded_at timestamptz,
    unique(household_id, invitee_id, status) -- One pending invitation per household per user
);

create index if not exists idx_household_invitations_invitee on public.household_invitations(invitee_id, status);
create index if not exists idx_household_invitations_household on public.household_invitations(household_id, status);

alter table public.household_invitations enable row level security;

-- RLS Policies for invitations
create policy "Users can view invitations sent to them" on public.household_invitations
    for select using (
        invitee_id = auth.uid()
        or
        inviter_id = auth.uid()
    );

create policy "Owners can create invitations" on public.household_invitations
    for insert with check (
        -- User must be owner/admin of the household
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
        and inviter_id = auth.uid()
    );

create policy "Users can update their invitations" on public.household_invitations
    for update using (
        invitee_id = auth.uid() -- Only invitee can accept/reject
        or
        inviter_id = auth.uid() -- Or inviter can cancel
    );

-- ============================================
-- 2. UPDATE NOTIFICATIONS TABLE
-- ============================================

-- Add household_invitation to notification types
alter table public.notifications
    drop constraint if exists notifications_type_check;

alter table public.notifications
    add constraint notifications_type_check check (type in (
        'expiry_warning', 
        'expiry_recipe_suggestion', 
        'badge_earned', 
        'challenge_completed',
        'family_inventory_update',
        'shopping_list_reminder',
        'household_invitation'
    ));

-- ============================================
-- 3. HELPER FUNCTIONS
-- ============================================

-- Function to search users by email or name
create or replace function search_users(p_search_term text, p_limit integer default 10)
returns table (
    id uuid,
    email text,
    full_name text,
    avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Only return users that are not already members of any household with the current user
    return query
    select 
        u.id,
        u.email,
        coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as full_name,
        p.avatar_url
    from auth.users u
    left join public.profiles p on p.id = u.id
    where (
        u.email ilike '%' || p_search_term || '%'
        or u.raw_user_meta_data->>'full_name' ilike '%' || p_search_term || '%'
    )
    and u.id != auth.uid() -- Don't return current user
    and u.id not in (
        -- Don't return users already in a household with current user
        select distinct hm2.user_id
        from public.household_members hm1
        join public.household_members hm2 on hm2.household_id = hm1.household_id
        where hm1.user_id = auth.uid()
        and hm2.user_id != auth.uid()
    )
    limit p_limit;
end;
$$;

-- Function to send household invitation
create or replace function send_household_invitation(
    p_household_id uuid,
    p_invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invitation_id uuid;
    v_inviter_id uuid;
    v_household_name text;
    v_invitee_email text;
    v_inviter_name text;
begin
    v_inviter_id := auth.uid();
    
    if v_inviter_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Check if inviter is owner/admin of household
    if not exists (
        select 1 from public.household_members hm
        where hm.household_id = p_household_id
        and hm.user_id = v_inviter_id
        and hm.role in ('owner', 'admin')
    ) then
        raise exception 'Only owners and admins can send invitations';
    end if;
    
    -- Check if invitee is already a member
    if exists (
        select 1 from public.household_members hm
        where hm.household_id = p_household_id
        and hm.user_id = p_invitee_id
    ) then
        raise exception 'User is already a member of this household';
    end if;
    
    -- Check if there's already a pending invitation
    if exists (
        select 1 from public.household_invitations hi
        where hi.household_id = p_household_id
        and hi.invitee_id = p_invitee_id
        and hi.status = 'pending'
    ) then
        raise exception 'Invitation already sent to this user';
    end if;
    
    -- Get household name
    select name into v_household_name
    from public.households
    where id = p_household_id;
    
    -- Get invitee email
    select email into v_invitee_email
    from auth.users
    where id = p_invitee_id;
    
    -- Get inviter name
    select coalesce(
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1)
    ) into v_inviter_name
    from auth.users u
    where u.id = v_inviter_id;
    
    -- Create invitation
    insert into public.household_invitations (household_id, inviter_id, invitee_id, status)
    values (p_household_id, v_inviter_id, p_invitee_id, 'pending')
    returning id into v_invitation_id;
    
    -- Create notification for invitee
    insert into public.notifications (user_id, type, title, message, data, priority)
    values (
        p_invitee_id,
        'household_invitation',
        'Uitnodiging voor gezin: ' || v_household_name,
        v_inviter_name || ' heeft je uitgenodigd om lid te worden van het gezin "' || v_household_name || '".',
        jsonb_build_object(
            'invitation_id', v_invitation_id,
            'household_id', p_household_id,
            'household_name', v_household_name,
            'inviter_id', v_inviter_id,
            'inviter_name', v_inviter_name
        ),
        5 -- High priority
    );
    
    return v_invitation_id;
end;
$$;

-- Function to accept household invitation
create or replace function accept_household_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invitation record;
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Get invitation
    select * into v_invitation
    from public.household_invitations
    where id = p_invitation_id
    and invitee_id = v_user_id
    and status = 'pending';
    
    if not found then
        raise exception 'Invitation not found or already processed';
    end if;
    
    -- Add user to household
    insert into public.household_members (household_id, user_id, role)
    values (v_invitation.household_id, v_user_id, 'member')
    on conflict (household_id, user_id) do nothing;
    
    -- Update invitation status
    update public.household_invitations
    set status = 'accepted',
        responded_at = timezone('utc', now())
    where id = p_invitation_id;
    
    -- Create notification for inviter
    insert into public.notifications (user_id, type, title, message, data, priority)
    select 
        v_invitation.inviter_id,
        'household_invitation',
        'Uitnodiging geaccepteerd',
        coalesce(
            u.raw_user_meta_data->>'full_name',
            split_part(u.email, '@', 1)
        ) || ' heeft je uitnodiging voor het gezin geaccepteerd.',
        jsonb_build_object(
            'household_id', v_invitation.household_id,
            'invitee_id', v_user_id
        ),
        3
    from auth.users u
    where u.id = v_user_id;
    
    return true;
end;
$$;

-- Function to reject household invitation
create or replace function reject_household_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invitation record;
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Get invitation
    select * into v_invitation
    from public.household_invitations
    where id = p_invitation_id
    and invitee_id = v_user_id
    and status = 'pending';
    
    if not found then
        raise exception 'Invitation not found or already processed';
    end if;
    
    -- Update invitation status
    update public.household_invitations
    set status = 'rejected',
        responded_at = timezone('utc', now())
    where id = p_invitation_id;
    
    return true;
end;
$$;

-- Function to cancel invitation (by inviter)
create or replace function cancel_household_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invitation record;
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Get invitation
    select * into v_invitation
    from public.household_invitations
    where id = p_invitation_id
    and inviter_id = v_user_id
    and status = 'pending';
    
    if not found then
        raise exception 'Invitation not found or already processed';
    end if;
    
    -- Update invitation status
    update public.household_invitations
    set status = 'cancelled',
        responded_at = timezone('utc', now())
    where id = p_invitation_id;
    
    return true;
end;
$$;

-- Function to get pending invitations for a user
create or replace function get_pending_invitations(p_user_id uuid)
returns table (
    id uuid,
    household_id uuid,
    household_name text,
    inviter_id uuid,
    inviter_name text,
    inviter_email text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    select 
        hi.id,
        hi.household_id,
        h.name as household_name,
        hi.inviter_id,
        coalesce(
            u.raw_user_meta_data->>'full_name',
            split_part(u.email, '@', 1)
        ) as inviter_name,
        u.email as inviter_email,
        hi.created_at
    from public.household_invitations hi
    join public.households h on h.id = hi.household_id
    join auth.users u on u.id = hi.inviter_id
    where hi.invitee_id = p_user_id
    and hi.status = 'pending'
    order by hi.created_at desc;
end;
$$;

-- Grant execute permissions
grant execute on function search_users(text, integer) to authenticated;
grant execute on function send_household_invitation(uuid, uuid) to authenticated;
grant execute on function accept_household_invitation(uuid) to authenticated;
grant execute on function reject_household_invitation(uuid) to authenticated;
grant execute on function cancel_household_invitation(uuid) to authenticated;
grant execute on function get_pending_invitations(uuid) to authenticated;

-- Comments
comment on table public.household_invitations is 'Invitations to join households';
comment on function search_users is 'Search for users by email or name (excludes users already in same households)';
comment on function send_household_invitation is 'Send an invitation to join a household';
comment on function accept_household_invitation is 'Accept a household invitation';
comment on function reject_household_invitation is 'Reject a household invitation';
comment on function cancel_household_invitation is 'Cancel a sent invitation';
comment on function get_pending_invitations is 'Get all pending invitations for a user';

