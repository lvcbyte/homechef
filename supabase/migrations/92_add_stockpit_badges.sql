-- Add STOCKPIT Badges
-- Professional badges in STOCKPIT branding and theme

-- ============================================
-- 1. INSERT STOCKPIT BADGES
-- ============================================

-- Zero-Waste Badges
insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('zero_waste_7_days', 'Zero-Waste Week', '7 dagen zonder verspilling', 'leaf', 'zero_waste', 7)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('zero_waste_30_days', 'Zero-Waste Maand', '30 dagen zonder verspilling', 'leaf', 'zero_waste', 30)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('zero_waste_90_days', 'Zero-Waste Meester', '90 dagen zonder verspilling', 'leaf', 'zero_waste', 90)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('waste_warrior', 'Waste Warrior', '100 items gebruikt zonder verspilling', 'shield', 'zero_waste', 100)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

-- Ingredient Master Badges
insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('ingredient_novice', 'Ingrediënt Novice', '50 items toegevoegd aan voorraad', 'cube', 'ingredient_master', 50),
    ('ingredient_expert', 'Ingrediënt Expert', '200 items toegevoegd aan voorraad', 'cube', 'ingredient_master', 200),
    ('ingredient_master', 'Ingrediënt Meester', '500 items toegevoegd aan voorraad', 'cube', 'ingredient_master', 500),
    ('barcode_scanner', 'Barcode Scanner', '100 barcodes gescand', 'barcode', 'ingredient_master', 100)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

-- Recipe Creator Badges
insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('recipe_creator', 'Recept Creator', '10 recepten opgeslagen', 'book', 'recipe_creator', 10),
    ('recipe_chef', 'Recept Chef', '25 recepten opgeslagen', 'book', 'recipe_creator', 25),
    ('leftovers_chef', 'Restjes Chef', '50 restjes recepten gebruikt', 'restaurant', 'recipe_creator', 50)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

-- Streak Badges
insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('daily_user_7', 'Dagelijkse Gebruiker', '7 dagen op rij actief', 'flame', 'streak', 7),
    ('daily_user_30', 'Maandelijkse Gebruiker', '30 dagen op rij actief', 'flame', 'streak', 30)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

-- Special Achievement Badges
insert into public.badges (code, name, description, icon, category, requirement_value)
values
    ('first_scan', 'Eerste Scan', 'Je eerste barcode gescand', 'scan', 'community', 1),
    ('inventory_master', 'Voorraad Meester', '100 items in voorraad gehad', 'archive', 'ingredient_master', 100),
    ('expiry_avoider', 'Vervaldatum Vermijder', '50 items gebruikt voor vervaldatum', 'time', 'zero_waste', 50)
on conflict (code) do update set
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    category = excluded.category,
    requirement_value = excluded.requirement_value;

-- ============================================
-- 2. UPDATE BADGE ICONS TO USE IONICONS NAMES
-- ============================================
-- The icon field will store Ionicons name, not emoji

-- ============================================
-- 3. CREATE FUNCTION TO GET BADGE PROGRESS DETAILS
-- ============================================
create or replace function get_badge_progress_details(p_user_id uuid, p_badge_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_badge record;
    v_progress integer := 0;
    v_current_value integer := 0;
    v_result jsonb;
begin
    -- Get badge
    select * into v_badge
    from public.badges
    where code = p_badge_code
    limit 1;
    
    if not found then
        return jsonb_build_object('error', 'Badge not found');
    end if;
    
    -- Calculate current progress based on badge category
    case v_badge.category
        when 'zero_waste' then
            -- Count consecutive days without expired items
            select count(distinct date(created_at))
            into v_current_value
            from public.inventory
            where user_id = p_user_id
            and expires_at is not null
            and expires_at > now()
            and created_at >= now() - interval '90 days';
            
        when 'ingredient_master' then
            -- Count total items added
            select count(*)
            into v_current_value
            from public.inventory
            where user_id = p_user_id
            and created_at >= now() - interval '365 days';
            
        when 'recipe_creator' then
            -- Count recipes created/saved
            select count(*)
            into v_current_value
            from public.recipes
            where author = (select email from auth.users where id = p_user_id)
            or id in (
                select recipe_id from public.saved_recipes
                where user_id = p_user_id
            );
            
        when 'streak' then
            -- Count consecutive days active
            select count(distinct date(created_at))
            into v_current_value
            from public.inventory
            where user_id = p_user_id
            and created_at >= now() - interval '90 days';
            
        else
            v_current_value := 0;
    end case;
    
    -- Calculate progress percentage
    if v_badge.requirement_value is not null and v_badge.requirement_value > 0 then
        v_progress := least(100, (v_current_value * 100) / v_badge.requirement_value);
    else
        v_progress := 0;
    end if;
    
    -- Get user badge record
    declare
        v_user_badge record;
    begin
        select * into v_user_badge
        from public.user_badges
        where user_id = p_user_id
        and badge_id = v_badge.id;
        
        if found and v_user_badge.progress >= 100 then
            v_progress := 100;
        end if;
    end;
    
    return jsonb_build_object(
        'badge_id', v_badge.id,
        'badge_code', v_badge.code,
        'badge_name', v_badge.name,
        'badge_description', v_badge.description,
        'badge_icon', v_badge.icon,
        'badge_category', v_badge.category,
        'requirement_value', v_badge.requirement_value,
        'current_value', v_current_value,
        'progress', v_progress,
        'is_earned', v_progress >= 100
    );
end;
$$;

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
grant execute on function get_badge_progress_details(uuid, text) to authenticated;

