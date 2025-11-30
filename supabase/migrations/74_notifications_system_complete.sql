-- Complete Notifications System
-- Automatic notification generation, triggers, and improved functions

-- ============================================
-- 1. IMPROVE NOTIFICATIONS TABLE
-- ============================================

-- Add action column to track what action was taken
alter table public.notifications
    add column if not exists action_url text;

-- Add priority for sorting
alter table public.notifications
    add column if not exists priority integer default 0;

-- Create index for unread notifications
create index if not exists idx_notifications_unread 
    on public.notifications(user_id, read, created_at desc) 
    where read = false;

-- ============================================
-- 2. IMPROVED CREATE EXPIRY NOTIFICATIONS FUNCTION
-- ============================================

create or replace function create_expiry_notifications()
returns void
language plpgsql
security definer
as $$
declare
    v_user record;
    v_item record;
    v_days_until integer;
    v_recipes jsonb;
    v_recipe record;
begin
    -- Get all users with expiring items
    for v_user in 
        select distinct user_id 
        from public.inventory 
        where expires_at is not null
        and expires_at <= now() + interval '7 days'
        and expires_at > now()
    loop
        -- Check items expiring in next 7 days
        for v_item in
            select *
            from public.inventory
            where user_id = v_user.user_id
            and expires_at is not null
            and expires_at <= now() + interval '7 days'
            and expires_at > now()
            and not exists (
                select 1 from public.notifications n
                where n.user_id = v_user.user_id
                and n.type in ('expiry_warning', 'expiry_recipe_suggestion')
                and (n.data->>'item_id')::uuid = inventory.id
                and n.created_at > now() - interval '1 day'
            )
        loop
            v_days_until := extract(day from (v_item.expires_at - now()))::integer;
            
            -- Get suggested recipes using leftovers function
            select jsonb_agg(
                jsonb_build_object(
                    'id', r.recipe_id,
                    'title', r.title,
                    'image_url', r.image_url,
                    'total_time_minutes', r.total_time_minutes
                )
            )
            into v_recipes
            from (
                select * from public.generate_leftovers_recipes(
                    v_user.user_id,
                    null,
                    null
                ) limit 3
            ) r;
            
            -- Create expiry warning notification
            insert into public.notifications (user_id, type, title, message, data, priority)
            values (
                v_user.user_id,
                'expiry_warning',
                case 
                    when v_days_until = 0 then 'Vandaag vervalt: ' || v_item.name
                    when v_days_until = 1 then 'Morgen vervalt: ' || v_item.name
                    when v_days_until <= 3 then 'Over ' || v_days_until || ' dagen vervalt: ' || v_item.name
                    else 'Over ' || v_days_until || ' dagen vervalt: ' || v_item.name
                end,
                case 
                    when v_days_until = 0 then 'Je ' || v_item.name || ' vervalt vandaag! Gebruik het snel om verspilling te voorkomen.'
                    when v_days_until = 1 then 'Je ' || v_item.name || ' vervalt morgen. Plan een recept om het op te gebruiken!'
                    when v_days_until <= 3 then 'Je ' || v_item.name || ' vervalt over ' || v_days_until || ' dagen. Bekijk recept suggesties.'
                    else 'Je ' || v_item.name || ' vervalt over ' || v_days_until || ' dagen.'
                end,
                jsonb_build_object(
                    'item_id', v_item.id,
                    'item_name', v_item.name,
                    'expires_at', v_item.expires_at,
                    'days_until_expiry', v_days_until,
                    'suggested_recipes', coalesce(v_recipes, '[]'::jsonb)
                ),
                case 
                    when v_days_until = 0 then 3
                    when v_days_until = 1 then 2
                    else 1
                end
            );
            
            -- Create recipe suggestion notification if we have recipes and item expires within 3 days
            if v_days_until <= 3 and v_recipes is not null and jsonb_array_length(v_recipes) > 0 then
                -- Check if we already sent a recipe suggestion today for this user
                if not exists (
                    select 1 from public.notifications n
                    where n.user_id = v_user.user_id
                    and n.type = 'expiry_recipe_suggestion'
                    and n.created_at > now() - interval '1 day'
                ) then
                    -- Get the best recipe
                    select * into v_recipe
                    from jsonb_array_elements(v_recipes) as r(recipe)
                    limit 1;
                    
                    if v_recipe is not null then
                        insert into public.notifications (user_id, type, title, message, data, priority)
                        values (
                            v_user.user_id,
                            'expiry_recipe_suggestion',
                            'Recept suggestie voor ' || v_item.name,
                            'Gebruik je ' || v_item.name || ' in dit recept: ' || (v_recipe->>'title'),
                            jsonb_build_object(
                                'item_id', v_item.id,
                                'item_name', v_item.name,
                                'suggested_recipe', v_recipe,
                                'expires_at', v_item.expires_at
                            ),
                            2
                        );
                    end if;
                end if;
            end if;
        end loop;
    end loop;
end;
$$;

-- ============================================
-- 3. TRIGGER FOR AUTOMATIC NOTIFICATIONS ON INVENTORY INSERT/UPDATE
-- ============================================

-- Function to check and create notifications when inventory is added/updated
create or replace function check_and_create_expiry_notification()
returns trigger
language plpgsql
security definer
as $$
declare
    v_days_until integer;
    v_recipes jsonb;
begin
    -- Only create notification if expires_at is set and in the future
    if NEW.expires_at is not null and NEW.expires_at > now() and NEW.expires_at <= now() + interval '7 days' then
        v_days_until := extract(day from (NEW.expires_at - now()))::integer;
        
        -- Only create notification if item expires within 3 days
        if v_days_until <= 3 then
            -- Check if notification already exists for this item
            if not exists (
                select 1 from public.notifications n
                where n.user_id = NEW.user_id
                and n.type = 'expiry_warning'
                and (n.data->>'item_id')::uuid = NEW.id
                and n.created_at > now() - interval '1 day'
            ) then
                -- Create notification
                insert into public.notifications (user_id, type, title, message, data, priority)
                values (
                    NEW.user_id,
                    'expiry_warning',
                    case 
                        when v_days_until = 0 then 'Vandaag vervalt: ' || NEW.name
                        when v_days_until = 1 then 'Morgen vervalt: ' || NEW.name
                        else 'Over ' || v_days_until || ' dagen vervalt: ' || NEW.name
                    end,
                    case 
                        when v_days_until = 0 then 'Je ' || NEW.name || ' vervalt vandaag! Gebruik het snel.'
                        when v_days_until = 1 then 'Je ' || NEW.name || ' vervalt morgen. Plan een recept!'
                        else 'Je ' || NEW.name || ' vervalt over ' || v_days_until || ' dagen.'
                    end,
                    jsonb_build_object(
                        'item_id', NEW.id,
                        'item_name', NEW.name,
                        'expires_at', NEW.expires_at,
                        'days_until_expiry', v_days_until
                    ),
                    case 
                        when v_days_until = 0 then 3
                        when v_days_until = 1 then 2
                        else 1
                    end
                );
            end if;
        end if;
    end if;
    
    return NEW;
end;
$$;

-- Create trigger
drop trigger if exists trigger_check_expiry_notification on public.inventory;
create trigger trigger_check_expiry_notification
    after insert or update of expires_at on public.inventory
    for each row
    execute function check_and_create_expiry_notification();

-- ============================================
-- 4. FUNCTION TO GET USER NOTIFICATIONS WITH PAGINATION
-- ============================================

create or replace function get_user_notifications(
    p_user_id uuid,
    p_limit integer default 50,
    p_offset integer default 0,
    p_unread_only boolean default false
)
returns table (
    id uuid,
    type text,
    title text,
    message text,
    data jsonb,
    read boolean,
    priority integer,
    created_at timestamptz
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        n.id,
        n.type,
        n.title,
        n.message,
        n.data,
        n.read,
        n.priority,
        n.created_at
    from public.notifications n
    where n.user_id = p_user_id
    and (not p_unread_only or n.read = false)
    order by 
        n.read asc,
        n.priority desc,
        n.created_at desc
    limit p_limit
    offset p_offset;
end;
$$;

-- Grant execute permissions
grant execute on function get_user_notifications(uuid, integer, integer, boolean) to authenticated;
grant execute on function get_user_notifications(uuid, integer, integer, boolean) to anon;

-- ============================================
-- 5. FUNCTION TO MARK ALL NOTIFICATIONS AS READ
-- ============================================

create or replace function mark_all_notifications_read(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
    v_count integer;
begin
    update public.notifications
    set read = true
    where user_id = p_user_id
    and read = false;
    
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

grant execute on function mark_all_notifications_read(uuid) to authenticated;

-- ============================================
-- 6. FUNCTION TO GET UNREAD COUNT
-- ============================================

create or replace function get_unread_notification_count(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
    v_count integer;
begin
    select count(*) into v_count
    from public.notifications
    where user_id = p_user_id
    and read = false;
    
    return v_count;
end;
$$;

grant execute on function get_unread_notification_count(uuid) to authenticated;
grant execute on function get_unread_notification_count(uuid) to anon;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

grant usage on schema public to authenticated;
grant all on public.notifications to authenticated;
grant execute on function create_expiry_notifications() to authenticated;
grant execute on function create_expiry_notifications() to service_role;

-- Ensure insert policy exists
drop policy if exists "Users can insert their own notifications" on public.notifications;
create policy "Users can insert their own notifications" on public.notifications
    for insert with check (auth.uid() = user_id);

-- Ensure delete policy exists
drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications" on public.notifications
    for delete using (auth.uid() = user_id);

-- Comments
comment on function create_expiry_notifications is 'Creates expiry notifications for all users with items expiring soon. Run as cron job.';
comment on function check_and_create_expiry_notification is 'Trigger function to automatically create notifications when inventory items are added/updated with expiry dates.';
comment on function get_user_notifications is 'Get user notifications with pagination and filtering options.';
comment on function mark_all_notifications_read is 'Mark all unread notifications as read for a user.';
comment on function get_unread_notification_count is 'Get count of unread notifications for a user.';

