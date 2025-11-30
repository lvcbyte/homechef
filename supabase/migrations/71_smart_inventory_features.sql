-- Smart Inventory Features Migration
-- Adds notifications, badges, family sharing, and price comparison

-- ============================================
-- 1. NOTIFICATIONS SYSTEM
-- ============================================
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    type text not null check (type in (
        'expiry_warning', 
        'expiry_recipe_suggestion', 
        'badge_earned', 
        'challenge_completed',
        'family_inventory_update',
        'shopping_list_reminder'
    )),
    title text not null,
    message text not null,
    data jsonb default '{}'::jsonb, -- Additional data (recipe_id, badge_id, etc.)
    read boolean not null default false,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(user_id, read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications" on public.notifications
    for select using (auth.uid() = user_id);

create policy "Users can update their own notifications" on public.notifications
    for update using (auth.uid() = user_id);

-- ============================================
-- 2. BADGES & ACHIEVEMENTS SYSTEM
-- ============================================
create table if not exists public.badges (
    id uuid primary key default gen_random_uuid(),
    code text not null unique, -- e.g., 'zero_waste_50_days', 'master_tomato_user'
    name text not null,
    description text not null,
    icon text, -- Icon name or emoji
    category text not null check (category in ('zero_waste', 'ingredient_master', 'recipe_creator', 'streak', 'community')),
    requirement_value integer, -- e.g., 50 for "50 days without waste"
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_badges (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    badge_id uuid not null references public.badges (id) on delete cascade,
    earned_at timestamptz not null default timezone('utc', now()),
    progress integer default 0, -- Progress towards badge (0-100)
    unique(user_id, badge_id)
);

create index if not exists idx_user_badges_user_id on public.user_badges(user_id);
create index if not exists idx_user_badges_badge_id on public.user_badges(badge_id);

alter table public.user_badges enable row level security;

create policy "Users can view their own badges" on public.user_badges
    for select using (auth.uid() = user_id);

-- ============================================
-- 3. ZERO-WASTE CHALLENGES
-- ============================================
create table if not exists public.challenges (
    id uuid primary key default gen_random_uuid(),
    code text not null unique, -- e.g., 'zero_waste_week', 'use_all_ingredients'
    name text not null,
    description text not null,
    badge_id uuid references public.badges (id),
    start_date date,
    end_date date,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_challenges (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    challenge_id uuid not null references public.challenges (id) on delete cascade,
    progress integer not null default 0, -- 0-100
    completed boolean not null default false,
    completed_at timestamptz,
    started_at timestamptz not null default timezone('utc', now()),
    unique(user_id, challenge_id)
);

create index if not exists idx_user_challenges_user_id on public.user_challenges(user_id);
create index if not exists idx_user_challenges_challenge_id on public.user_challenges(challenge_id);

alter table public.user_challenges enable row level security;

create policy "Users can view their own challenges" on public.user_challenges
    for select using (auth.uid() = user_id);

create policy "Users can update their own challenges" on public.user_challenges
    for update using (auth.uid() = user_id);

-- ============================================
-- 4. FAMILY/HOUSEHOLD SHARING
-- ============================================
create table if not exists public.households (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by uuid not null references auth.users (id),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.household_members (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null default 'member' check (role in ('owner', 'admin', 'member')),
    joined_at timestamptz not null default timezone('utc', now()),
    unique(household_id, user_id)
);

create index if not exists idx_household_members_household_id on public.household_members(household_id);
create index if not exists idx_household_members_user_id on public.household_members(user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Users can view households they're members of
create policy "Users can view their households" on public.households
    for select using (
        exists (
            select 1 from public.household_members
            where household_members.household_id = households.id
            and household_members.user_id = auth.uid()
        )
    );

-- Users can view household members of their households
create policy "Users can view household members" on public.household_members
    for select using (
        exists (
            select 1 from public.household_members hm
            where hm.household_id = household_members.household_id
            and hm.user_id = auth.uid()
        )
    );

-- ============================================
-- 5. SHOPPING LIST PRICE COMPARISON
-- ============================================
alter table public.shopping_list_items
    add column if not exists catalog_product_id text references public.product_catalog(id),
    add column if not exists estimated_price numeric,
    add column if not exists store_source text,
    add column if not exists price_comparison jsonb default '{}'::jsonb; -- {store: price} mapping

create index if not exists idx_shopping_list_items_catalog_product_id 
    on public.shopping_list_items(catalog_product_id);

-- ============================================
-- 6. RECIPE SCALING TRACKING
-- ============================================
create table if not exists public.recipe_scaling_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    recipe_id uuid not null references public.recipes (id) on delete cascade,
    original_servings integer not null,
    scaled_servings integer not null,
    scaled_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_recipe_scaling_history_user_id on public.recipe_scaling_history(user_id);
create index if not exists idx_recipe_scaling_history_recipe_id on public.recipe_scaling_history(recipe_id);

alter table public.recipe_scaling_history enable row level security;

create policy "Users can view their own recipe scaling history" on public.recipe_scaling_history
    for select using (auth.uid() = user_id);

-- ============================================
-- 7. COOKING MODE SESSIONS
-- ============================================
create table if not exists public.cooking_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    recipe_id uuid not null references public.recipes (id) on delete cascade,
    servings integer not null, -- Scaled servings
    started_at timestamptz not null default timezone('utc', now()),
    completed_at timestamptz,
    duration_minutes integer,
    ingredients_used jsonb default '[]'::jsonb -- Track which inventory items were used
);

create index if not exists idx_cooking_sessions_user_id on public.cooking_sessions(user_id);
create index if not exists idx_cooking_sessions_recipe_id on public.cooking_sessions(recipe_id);

alter table public.cooking_sessions enable row level security;

create policy "Users can view their own cooking sessions" on public.cooking_sessions
    for select using (auth.uid() = user_id);

create policy "Users can insert their own cooking sessions" on public.cooking_sessions
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own cooking sessions" on public.cooking_sessions
    for update using (auth.uid() = user_id);

-- ============================================
-- 8. VOICE COMMANDS LOG
-- ============================================
create table if not exists public.voice_commands (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    command_text text not null,
    parsed_data jsonb, -- Parsed command data
    success boolean not null default false,
    error_message text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_voice_commands_user_id on public.voice_commands(user_id);
create index if not exists idx_voice_commands_created_at on public.voice_commands(created_at desc);

alter table public.voice_commands enable row level security;

create policy "Users can view their own voice commands" on public.voice_commands
    for select using (auth.uid() = user_id);

create policy "Users can insert their own voice commands" on public.voice_commands
    for insert with check (auth.uid() = user_id);

-- ============================================
-- 9. SEED DEFAULT BADGES
-- ============================================
insert into public.badges (code, name, description, icon, category, requirement_value) values
    ('zero_waste_7_days', 'Zero Waste Week', '7 dagen zonder voedselverspilling', '🌱', 'zero_waste', 7),
    ('zero_waste_30_days', 'Zero Waste Maand', '30 dagen zonder voedselverspilling', '🌿', 'zero_waste', 30),
    ('zero_waste_50_days', 'Zero Waste Master', '50 dagen zonder voedselverspilling', '🌳', 'zero_waste', 50),
    ('master_tomato_user', 'Tomaat Meester', '10 recepten gemaakt met tomaten', '🍅', 'ingredient_master', 10),
    ('master_onion_user', 'Ui Meester', '10 recepten gemaakt met uien', '🧅', 'ingredient_master', 10),
    ('recipe_creator_5', 'Recept Maker', '5 recepten gedeeld met de community', '👨‍🍳', 'recipe_creator', 5),
    ('recipe_creator_20', 'Recept Meester', '20 recepten gedeeld met de community', '👨‍🍳', 'recipe_creator', 20),
    ('cooking_streak_7', 'Kook Streak', '7 dagen achter elkaar gekookt', '🔥', 'streak', 7),
    ('cooking_streak_30', 'Kook Meester', '30 dagen achter elkaar gekookt', '🔥', 'streak', 30),
    ('family_collaborator', 'Gezins Samenwerker', 'Deel je voorraad met je gezin', '👨‍👩‍👧‍👦', 'community', 1)
on conflict (code) do nothing;

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================

-- Function to check and award badges
create or replace function check_and_award_badges(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    v_badge record;
    v_progress integer;
    v_earned boolean;
begin
    -- Zero waste badges (based on days without expired items)
    for v_badge in select * from public.badges where category = 'zero_waste' loop
        -- Count consecutive days without expired items
        select count(distinct date(created_at))
        into v_progress
        from public.inventory
        where user_id = p_user_id
        and expires_at is not null
        and expires_at > now()
        and created_at >= now() - interval '60 days';
        
        -- Check if badge should be awarded
        if v_progress >= v_badge.requirement_value then
            insert into public.user_badges (user_id, badge_id, progress, earned_at)
            values (p_user_id, v_badge.id, 100, now())
            on conflict (user_id, badge_id) do update
            set progress = 100, earned_at = now()
            where user_badges.progress < 100;
            
            -- Create notification
            insert into public.notifications (user_id, type, title, message, data)
            values (
                p_user_id,
                'badge_earned',
                'Badge verdiend! 🎉',
                'Je hebt de badge "' || v_badge.name || '" verdiend!',
                jsonb_build_object('badge_id', v_badge.id, 'badge_name', v_badge.name)
            );
        end if;
    end loop;
end;
$$;

-- Function to get expiring items and suggest recipes
create or replace function get_expiring_items_with_recipes(p_user_id uuid, p_days_ahead integer default 3)
returns table (
    item_id uuid,
    item_name text,
    expires_at timestamptz,
    days_until_expiry integer,
    suggested_recipes jsonb
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        i.id as item_id,
        i.name as item_name,
        i.expires_at,
        extract(day from (i.expires_at - now()))::integer as days_until_expiry,
        (
            select jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'title', r.title,
                    'image_url', r.image_url,
                    'total_time_minutes', r.total_time_minutes
                )
            )
            from public.recipes r
            where r.ingredients::text ilike '%' || i.name || '%'
            limit 3
        ) as suggested_recipes
    from public.inventory i
    where i.user_id = p_user_id
    and i.expires_at is not null
    and i.expires_at <= now() + (p_days_ahead || ' days')::interval
    and i.expires_at > now()
    order by i.expires_at asc;
end;
$$;

-- Function to generate shopping list with price comparison
create or replace function generate_shopping_list_with_prices(
    p_user_id uuid,
    p_recipe_ids uuid[] default null
)
returns table (
    item_name text,
    quantity text,
    category text,
    stores jsonb -- {store: {price, product_id, image_url}}
)
language plpgsql
security definer
as $$
declare
    v_recipe record;
    v_ingredient jsonb;
    v_product record;
    v_store_prices jsonb;
begin
    -- If recipe IDs provided, get missing ingredients
    if p_recipe_ids is not null then
        for v_recipe in 
            select * from public.recipes where id = any(p_recipe_ids)
        loop
            for v_ingredient in 
                select * from jsonb_array_elements(v_recipe.ingredients)
            loop
                -- Check if user has this ingredient
                if not exists (
                    select 1 from public.inventory
                    where user_id = p_user_id
                    and name ilike '%' || (v_ingredient->>'name') || '%'
                ) then
                    -- Find products in catalog
                    select jsonb_agg(
                        jsonb_build_object(
                            'store', source,
                            'price', price,
                            'product_id', id,
                            'image_url', image_url
                        )
                    )
                    into v_store_prices
                    from public.product_catalog
                    where product_name ilike '%' || (v_ingredient->>'name') || '%'
                    and is_available = true
                    limit 5;
                    
                    return query select 
                        (v_ingredient->>'name')::text,
                        (v_ingredient->>'quantity' || ' ' || coalesce(v_ingredient->>'unit', ''))::text,
                        'pantry'::text,
                        coalesce(v_store_prices, '[]'::jsonb);
                end if;
            end loop;
        end loop;
    end if;
end;
$$;

-- Function to get household inventory (shared inventory)
create or replace function get_household_inventory(p_household_id uuid)
returns table (
    id uuid,
    name text,
    category text,
    quantity_approx text,
    expires_at timestamptz,
    user_id uuid,
    user_email text
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        i.id,
        i.name,
        i.category,
        i.quantity_approx,
        i.expires_at,
        i.user_id,
        au.email::text as user_email
    from public.inventory i
    join public.household_members hm on hm.user_id = i.user_id
    join auth.users au on au.id = i.user_id
    where hm.household_id = p_household_id
    order by i.expires_at asc nulls last;
end;
$$;

comment on table public.notifications is 'User notifications for expiry warnings, badge earnings, etc.';
comment on table public.badges is 'Available badges and achievements';
comment on table public.user_badges is 'Badges earned by users';
comment on table public.challenges is 'Zero-waste and other challenges';
comment on table public.user_challenges is 'User participation in challenges';
comment on table public.households is 'Household/family groups for shared inventory';
comment on table public.household_members is 'Members of households';
comment on table public.recipe_scaling_history is 'History of recipe scaling by users';
comment on table public.cooking_sessions is 'Cooking mode sessions tracking';
comment on table public.voice_commands is 'Log of voice commands for inventory updates';

