-- Improve Zero-Waste Badges and Challenges
-- Enhanced badge unlock logic and progress tracking

-- ============================================
-- 1. IMPROVE BADGE CHECK FUNCTION
-- ============================================
-- Drop existing function first to change return type
drop function if exists check_and_award_badges(uuid);

create or replace function check_and_award_badges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_badge record;
    v_progress integer;
    v_earned_count integer := 0;
    v_result jsonb := '[]'::jsonb;
    v_item_count integer;
    v_days_without_waste integer;
    v_consecutive_days integer;
    v_total_items_used integer;
    v_recipes_created integer;
    v_current_value integer;
begin
    -- Zero waste badges (based on days without expired items)
    for v_badge in select * from public.badges where category = 'zero_waste' loop
        -- Calculate consecutive days without expired items
        select count(distinct date(created_at))
        into v_consecutive_days
        from public.inventory
        where user_id = p_user_id
        and expires_at is not null
        and expires_at > now()
        and created_at >= now() - interval '90 days';
        
        -- Calculate days without waste (no expired items)
        select count(distinct date_trunc('day', expires_at))
        into v_days_without_waste
        from public.inventory
        where user_id = p_user_id
        and expires_at is not null
        and expires_at < now()
        and expires_at >= now() - interval '90 days';
        
        -- Calculate progress based on requirement
        if v_badge.requirement_value is not null then
            v_progress := least(100, (v_consecutive_days * 100) / v_badge.requirement_value);
        else
            v_progress := 0;
        end if;
        
        -- Check if badge should be awarded
        if v_consecutive_days >= coalesce(v_badge.requirement_value, 0) then
            -- Award badge
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, 100, now())
            on conflict (user_id, badge_id) do update
            set progress = 100, earned_at = now()
            where user_badges.progress < 100;
            
            -- Only create notification if badge was just earned (not already earned)
            if not exists (
                select 1 from public.user_badges
                where user_id = p_user_id
                and badge_id = v_badge.id
                and progress = 100
                and earned_at < now() - interval '1 minute'
            ) then
                insert into public.notifications (user_id, type, title, message, data)
                values (
                    p_user_id,
                    'badge_earned',
                    'Badge verdiend',
                    'Je hebt de badge "' || v_badge.name || '" verdiend!',
                    jsonb_build_object('badge_id', v_badge.id, 'badge_name', v_badge.name, 'badge_category', v_badge.category)
                );
                v_earned_count := v_earned_count + 1;
            end if;
        else
            -- Update progress even if not earned yet
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, v_progress, null)
            on conflict (user_id, badge_id) do update
            set progress = v_progress
            where user_badges.progress < 100;
        end if;
        
        -- Add to result
        v_result := v_result || jsonb_build_object(
            'badge_id', v_badge.id,
            'badge_name', v_badge.name,
            'progress', v_progress,
            'earned', v_consecutive_days >= coalesce(v_badge.requirement_value, 0)
        );
    end loop;
    
    -- Ingredient master badges (based on total items used)
    for v_badge in select * from public.badges where category = 'ingredient_master' loop
        -- Count total items that have been used (deleted from inventory)
        -- This is tracked via inventory deletions or expiry
        select count(*)
        into v_total_items_used
        from public.inventory
        where user_id = p_user_id
        and (expires_at < now() or expires_at is null)
        and created_at >= now() - interval '365 days';
        
        if v_badge.requirement_value is not null then
            v_progress := least(100, (v_total_items_used * 100) / v_badge.requirement_value);
        else
            v_progress := 0;
        end if;
        
        if v_total_items_used >= coalesce(v_badge.requirement_value, 0) then
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, 100, now())
            on conflict (user_id, badge_id) do update
            set progress = 100, earned_at = now()
            where user_badges.progress < 100;
            
            if not exists (
                select 1 from public.user_badges
                where user_id = p_user_id
                and badge_id = v_badge.id
                and progress = 100
                and earned_at < now() - interval '1 minute'
            ) then
                insert into public.notifications (user_id, type, title, message, data)
                values (
                    p_user_id,
                    'badge_earned',
                    'Badge verdiend',
                    'Je hebt de badge "' || v_badge.name || '" verdiend!',
                    jsonb_build_object('badge_id', v_badge.id, 'badge_name', v_badge.name, 'badge_category', v_badge.category)
                );
                v_earned_count := v_earned_count + 1;
            end if;
        else
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, v_progress, null)
            on conflict (user_id, badge_id) do update
            set progress = v_progress
            where user_badges.progress < 100;
        end if;
    end loop;
    
    -- Recipe creator badges (based on recipes created/saved)
    for v_badge in select * from public.badges where category = 'recipe_creator' loop
        if v_badge.code = 'leftovers_chef' then
            -- Count leftovers recipes used (recipes generated from expiring items)
            select count(*)
            into v_recipes_created
            from public.recipes r
            where r.author = (select email from auth.users where id = p_user_id)
            and r.tags::text ilike '%restjes%'
            or exists (
                select 1 from public.saved_recipes sr
                where sr.user_id = p_user_id
                and sr.recipe_payload->>'tags'::text ilike '%restjes%'
            );
        else
            -- Count all recipes created/saved
            select count(*)
            into v_recipes_created
            from public.recipes
            where author = (select email from auth.users where id = p_user_id)
            or id in (
                select recipe_id from public.saved_recipes
                where user_id = p_user_id
            );
        end if;
        
        if v_badge.requirement_value is not null then
            v_progress := least(100, (v_recipes_created * 100) / v_badge.requirement_value);
        else
            v_progress := 0;
        end if;
        
        if v_recipes_created >= coalesce(v_badge.requirement_value, 0) then
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, 100, now())
            on conflict (user_id, badge_id) do update
            set progress = 100, earned_at = now()
            where user_badges.progress < 100;
            
            if not exists (
                select 1 from public.user_badges
                where user_id = p_user_id
                and badge_id = v_badge.id
                and progress = 100
                and earned_at < now() - interval '1 minute'
            ) then
                insert into public.notifications (user_id, type, title, message, data)
                values (
                    p_user_id,
                    'badge_earned',
                    'Badge verdiend',
                    'Je hebt de badge "' || v_badge.name || '" verdiend!',
                    jsonb_build_object('badge_id', v_badge.id, 'badge_name', v_badge.name, 'badge_category', v_badge.category)
                );
                v_earned_count := v_earned_count + 1;
            end if;
        else
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, v_progress, null)
            on conflict (user_id, badge_id) do update
            set progress = v_progress
            where user_badges.progress < 100;
        end if;
    end loop;
    
    -- Special badges (barcode scanner, first scan, etc.)
    for v_badge in select * from public.badges where category = 'community' or code in ('barcode_scanner', 'first_scan', 'inventory_master', 'expiry_avoider') loop
        if v_badge.code = 'barcode_scanner' then
            -- Count barcode scans
            select count(*)
            into v_current_value
            from public.barcode_scans
            where user_id = p_user_id
            and created_at >= now() - interval '365 days';
            
        elsif v_badge.code = 'first_scan' then
            -- Check if user has scanned at least one barcode
            select count(*)
            into v_current_value
            from public.barcode_scans
            where user_id = p_user_id;
            
        elsif v_badge.code = 'inventory_master' then
            -- Count total items ever added to inventory
            select count(distinct name)
            into v_current_value
            from public.inventory
            where user_id = p_user_id;
            
        elsif v_badge.code = 'expiry_avoider' then
            -- Count items used before expiry
            select count(*)
            into v_current_value
            from public.inventory
            where user_id = p_user_id
            and expires_at is not null
            and expires_at > now()
            and created_at >= now() - interval '365 days';
            
        else
            v_current_value := 0;
        end if;
        
        if v_badge.requirement_value is not null then
            v_progress := least(100, (v_current_value * 100) / v_badge.requirement_value);
        else
            if v_current_value > 0 then
                v_progress := 100;
            else
                v_progress := 0;
            end if;
        end if;
        
        if v_current_value >= coalesce(v_badge.requirement_value, 1) then
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, 100, now())
            on conflict (user_id, badge_id) do update
            set progress = 100, earned_at = now()
            where user_badges.progress < 100;
            
            if not exists (
                select 1 from public.user_badges
                where user_id = p_user_id
                and badge_id = v_badge.id
                and progress = 100
                and earned_at < now() - interval '1 minute'
            ) then
                insert into public.notifications (user_id, type, title, message, data)
                values (
                    p_user_id,
                    'badge_earned',
                    'Badge verdiend',
                    'Je hebt de badge "' || v_badge.name || '" verdiend!',
                    jsonb_build_object('badge_id', v_badge.id, 'badge_name', v_badge.name, 'badge_category', v_badge.category)
                );
                v_earned_count := v_earned_count + 1;
            end if;
        else
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, v_progress, null)
            on conflict (user_id, badge_id) do update
            set progress = v_progress
            where user_badges.progress < 100;
        end if;
    end loop;
    
    return jsonb_build_object(
        'earned_count', v_earned_count,
        'badges_checked', jsonb_array_length(v_result),
        'results', v_result
    );
end;
$$;

-- ============================================
-- 2. FUNCTION TO GET ALL BADGES WITH PROGRESS
-- ============================================
create or replace function get_all_badges_with_progress(p_user_id uuid)
returns table (
    badge_id uuid,
    badge_code text,
    badge_name text,
    badge_description text,
    badge_icon text,
    badge_category text,
    requirement_value integer,
    user_progress integer,
    user_earned_at timestamptz,
    is_earned boolean
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        b.id as badge_id,
        b.code as badge_code,
        b.name as badge_name,
        b.description as badge_description,
        b.icon as badge_icon,
        b.category as badge_category,
        b.requirement_value,
        coalesce(ub.progress, 0) as user_progress,
        ub.earned_at as user_earned_at,
        (ub.progress >= 100) as is_earned
    from public.badges b
    left join public.user_badges ub on b.id = ub.badge_id and ub.user_id = p_user_id
    order by 
        case b.category
            when 'zero_waste' then 1
            when 'ingredient_master' then 2
            when 'recipe_creator' then 3
            when 'streak' then 4
            when 'community' then 5
            else 6
        end,
        b.requirement_value nulls last,
        b.name;
end;
$$;

-- ============================================
-- 3. FUNCTION TO TRACK ZERO WASTE PROGRESS
-- ============================================
-- Drop existing function first to change return type
drop function if exists track_zero_waste_progress(uuid);

create or replace function track_zero_waste_progress(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_days_without_waste integer;
    v_items_saved integer;
    v_total_items integer;
    v_waste_percentage numeric;
    v_streak_days integer;
begin
    -- Calculate days without waste (no expired items in last 30 days)
    select count(distinct date_trunc('day', expires_at))
    into v_days_without_waste
    from public.inventory
    where user_id = p_user_id
    and expires_at is not null
    and expires_at < now()
    and expires_at >= now() - interval '30 days';
    
    -- Calculate items saved (items that expired but were used before expiry)
    -- This is approximated by items that were deleted before expiry
    select count(*)
    into v_items_saved
    from public.inventory
    where user_id = p_user_id
    and expires_at is not null
    and expires_at > now()
    and created_at >= now() - interval '30 days';
    
    -- Calculate total items
    select count(*)
    into v_total_items
    from public.inventory
    where user_id = p_user_id
    and created_at >= now() - interval '30 days';
    
    -- Calculate waste percentage
    if v_total_items > 0 then
        v_waste_percentage := ((v_total_items - v_items_saved)::numeric / v_total_items::numeric) * 100;
    else
        v_waste_percentage := 0;
    end if;
    
    -- Calculate current streak (consecutive days without expired items)
    select count(distinct date(created_at))
    into v_streak_days
    from public.inventory
    where user_id = p_user_id
    and expires_at is not null
    and expires_at > now()
    and created_at >= now() - interval '90 days';
    
    -- Trigger badge check
    perform check_and_award_badges(p_user_id);
    
    return jsonb_build_object(
        'days_without_waste', v_days_without_waste,
        'items_saved', v_items_saved,
        'total_items', v_total_items,
        'waste_percentage', round(v_waste_percentage, 2),
        'streak_days', v_streak_days
    );
end;
$$;

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
grant execute on function check_and_award_badges(uuid) to authenticated;
grant execute on function get_all_badges_with_progress(uuid) to authenticated;
grant execute on function track_zero_waste_progress(uuid) to authenticated;

