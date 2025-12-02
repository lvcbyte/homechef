-- Baanbrekende STOCKPIT Features Migration
-- Implements: Price monitoring, ingredient substitutions, cooking timers sync, health tracking, ML models

-- ============================================
-- 1. PRICE HISTORY TRACKING
-- ============================================
-- Tracks historical prices for predictive purchase advisor

create table if not exists public.price_history (
    id uuid primary key default gen_random_uuid(),
    product_id text not null references public.product_catalog(id) on delete cascade,
    price numeric not null,
    source text, -- Store source (ah, colruyt, lidl, etc.)
    recorded_at timestamptz not null default timezone('utc', now()),
    user_id uuid references auth.users(id) on delete set null, -- Optional: user-reported price
    metadata jsonb -- Additional data (location, promotion, etc.)
);

create index if not exists price_history_product_id_idx on public.price_history(product_id, recorded_at desc);
create index if not exists price_history_recorded_at_idx on public.price_history(recorded_at desc);
create index if not exists price_history_user_id_idx on public.price_history(user_id) where user_id is not null;

-- Function to get price trends for a product
create or replace function get_price_trend(
    p_product_id text,
    p_days integer default 30
)
returns table (
    date date,
    avg_price numeric,
    min_price numeric,
    max_price numeric,
    price_change_percent numeric
)
language plpgsql
security definer
as $$
begin
    return query
    with daily_prices as (
        select 
            date(recorded_at) as date,
            avg(price) as avg_price,
            min(price) as min_price,
            max(price) as max_price
        from public.price_history
        where product_id = p_product_id
        and recorded_at >= now() - (p_days || ' days')::interval
        group by date(recorded_at)
        order by date(recorded_at)
    ),
    with_change as (
        select 
            date,
            avg_price,
            min_price,
            max_price,
            lag(avg_price) over (order by date) as prev_price
        from daily_prices
    )
    select 
        date,
        avg_price,
        min_price,
        max_price,
        case 
            when prev_price is not null and prev_price > 0 then
                round(((avg_price - prev_price) / prev_price * 100)::numeric, 2)
            else 0
        end as price_change_percent
    from with_change
    order by date;
end;
$$;

-- Trigger to automatically record price changes
create or replace function record_price_change()
returns trigger
language plpgsql
as $$
begin
    -- Only record if price actually changed
    if (old.price is distinct from new.price) and new.price is not null then
        insert into public.price_history (product_id, price, source, metadata)
        values (
            new.id,
            new.price,
            new.source,
            jsonb_build_object(
                'previous_price', old.price,
                'price_change', new.price - coalesce(old.price, 0),
                'updated_at', new.updated_at
            )
        );
    end if;
    return new;
end;
$$;

drop trigger if exists product_catalog_price_change_trigger on public.product_catalog;
create trigger product_catalog_price_change_trigger
    after update of price on public.product_catalog
    for each row
    execute function record_price_change();

-- ============================================
-- 2. INGREDIENT SUBSTITUTIONS & SYNONYMS
-- ============================================
-- Enables adaptive recipe UI with ingredient swapping

create table if not exists public.ingredient_substitutions (
    id uuid primary key default gen_random_uuid(),
    ingredient_name text not null, -- Original ingredient (normalized)
    substitute_name text not null, -- Substitute ingredient (normalized)
    substitution_type text not null check (substitution_type in ('synonym', 'alternative', 'category_match')),
    confidence_score real default 0.8 check (confidence_score between 0 and 1),
    category text, -- Ingredient category for grouping
    notes text, -- Usage notes (e.g., "Use 1:1 ratio")
    created_at timestamptz not null default timezone('utc', now()),
    unique(ingredient_name, substitute_name)
);

create index if not exists ingredient_substitutions_ingredient_idx on public.ingredient_substitutions(ingredient_name);
create index if not exists ingredient_substitutions_substitute_idx on public.ingredient_substitutions(substitute_name);
create index if not exists ingredient_substitutions_category_idx on public.ingredient_substitutions(category);

-- Seed common ingredient substitutions
insert into public.ingredient_substitutions (ingredient_name, substitute_name, substitution_type, confidence_score, category, notes)
values
    -- Onions (synonyms)
    ('rode ui', 'gele ui', 'synonym', 0.95, 'groenten', 'Directe vervanging, zelfde smaakprofiel'),
    ('gele ui', 'rode ui', 'synonym', 0.95, 'groenten', 'Directe vervanging, zelfde smaakprofiel'),
    ('ui', 'sjalot', 'alternative', 0.85, 'groenten', 'Sjalot is milder, gebruik iets meer'),
    ('sjalot', 'ui', 'alternative', 0.85, 'groenten', 'Ui is sterker, gebruik iets minder'),
    
    -- Dairy
    ('boter', 'margarine', 'alternative', 0.80, 'zuivel', 'Gebruik 1:1 ratio'),
    ('boter', 'olijfolie', 'alternative', 0.75, 'zuivel', 'Gebruik 3/4 van de hoeveelheid boter'),
    ('room', 'kokosmelk', 'alternative', 0.70, 'zuivel', 'Voor vegan opties'),
    ('melk', 'amandelmelk', 'alternative', 0.75, 'zuivel', 'Voor vegan opties'),
    
    -- Flour
    ('tarwebloem', 'volkorenmeel', 'alternative', 0.85, 'bakken', 'Volkorenmeel is gezonder'),
    ('tarwebloem', 'speltmeel', 'alternative', 0.80, 'bakken', 'Speltmeel is gezonder alternatief'),
    
    -- Herbs
    ('verse basilicum', 'gedroogde basilicum', 'synonym', 0.90, 'kruiden', 'Gebruik 1/3 van verse hoeveelheid'),
    ('verse peterselie', 'gedroogde peterselie', 'synonym', 0.90, 'kruiden', 'Gebruik 1/3 van verse hoeveelheid'),
    
    -- Proteins
    ('kipfilet', 'kalkoenfilet', 'alternative', 0.85, 'vlees', 'Zelfde bereiding, iets droger'),
    ('rundvlees', 'varkensvlees', 'alternative', 0.70, 'vlees', 'Verschillende smaak, controleer gaarheid'),
    
    -- Vegetables
    ('paprika', 'peper', 'alternative', 0.75, 'groenten', 'Peper is scherper'),
    ('courgette', 'aubergine', 'alternative', 0.70, 'groenten', 'Verschillende textuur')
on conflict (ingredient_name, substitute_name) do nothing;

-- Function to find substitutions for an ingredient
create or replace function find_ingredient_substitutions(
    p_ingredient_name text,
    p_min_confidence real default 0.7
)
returns table (
    substitute_name text,
    substitution_type text,
    confidence_score real,
    notes text
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        s.substitute_name,
        s.substitution_type,
        s.confidence_score,
        s.notes
    from public.ingredient_substitutions s
    where lower(trim(s.ingredient_name)) = lower(trim(p_ingredient_name))
    and s.confidence_score >= p_min_confidence
    order by s.confidence_score desc, s.substitution_type;
end;
$$;

-- Function to check if ingredient can be substituted
create or replace function can_substitute_ingredient(
    p_recipe_ingredient text,
    p_available_ingredient text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_substitution record;
    v_result jsonb;
begin
    -- Check direct substitution
    select * into v_substitution
    from public.ingredient_substitutions
    where (
        (lower(trim(ingredient_name)) = lower(trim(p_recipe_ingredient))
         and lower(trim(substitute_name)) = lower(trim(p_available_ingredient)))
        or
        (lower(trim(ingredient_name)) = lower(trim(p_available_ingredient))
         and lower(trim(substitute_name)) = lower(trim(p_recipe_ingredient)))
    )
    limit 1;
    
    if found then
        return jsonb_build_object(
            'can_substitute', true,
            'substitution_type', v_substitution.substitution_type,
            'confidence_score', v_substitution.confidence_score,
            'notes', v_substitution.notes
        );
    else
        return jsonb_build_object('can_substitute', false);
    end if;
end;
$$;

-- ============================================
-- 3. COOKING TIMERS SYNC
-- ============================================
-- Enables PWA cooking timer synchronization across devices

create table if not exists public.cooking_timers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id uuid references public.recipes(id) on delete set null,
    timer_name text not null, -- e.g., "Oven 180°C", "Kook rijst"
    duration_seconds integer not null,
    started_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null,
    device_id text, -- Device identifier for multi-device sync
    is_active boolean not null default true,
    completed_at timestamptz,
    metadata jsonb -- Additional timer data (temperature, step number, etc.)
);

create index if not exists cooking_timers_user_id_idx on public.cooking_timers(user_id, is_active, expires_at);
create index if not exists cooking_timers_device_id_idx on public.cooking_timers(device_id) where device_id is not null;
create index if not exists cooking_timers_active_idx on public.cooking_timers(is_active, expires_at) where is_active = true;

-- Function to get active timers for a user
create or replace function get_active_timers(p_user_id uuid)
returns table (
    timer_id uuid,
    timer_name text,
    duration_seconds integer,
    started_at timestamptz,
    expires_at timestamptz,
    remaining_seconds integer,
    recipe_id uuid,
    metadata jsonb
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        t.id as timer_id,
        t.timer_name,
        t.duration_seconds,
        t.started_at,
        t.expires_at,
        greatest(0, extract(epoch from (t.expires_at - now()))::integer) as remaining_seconds,
        t.recipe_id,
        t.metadata
    from public.cooking_timers t
    where t.user_id = p_user_id
    and t.is_active = true
    and t.expires_at > now()
    order by t.expires_at;
end;
$$;

-- Function to complete a timer
create or replace function complete_timer(p_timer_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
    update public.cooking_timers
    set is_active = false,
        completed_at = now()
    where id = p_timer_id
    and user_id = p_user_id;
    
    return found;
end;
$$;

-- ============================================
-- 4. HEALTH IMPACT TRACKING
-- ============================================
-- Tracks nutritional impact of recipes on user goals

create table if not exists public.user_health_goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    goal_type text not null check (goal_type in ('protein', 'fiber', 'calories', 'carbs', 'fat', 'sodium')),
    target_daily numeric not null,
    current_daily numeric default 0,
    date date not null default current_date,
    created_at timestamptz not null default timezone('utc', now()),
    unique(user_id, goal_type, date)
);

create index if not exists user_health_goals_user_date_idx on public.user_health_goals(user_id, date desc);

-- Table to track recipe consumption for health impact
create table if not exists public.recipe_consumption (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id uuid not null references public.recipes(id) on delete cascade,
    servings_consumed numeric not null default 1,
    consumed_at timestamptz not null default timezone('utc', now()),
    date date not null default current_date,
    nutrition_impact jsonb -- Calculated nutrition impact
);

create index if not exists recipe_consumption_user_date_idx on public.recipe_consumption(user_id, date desc);

-- Function to calculate health impact of a recipe
create or replace function calculate_recipe_health_impact(
    p_recipe_id uuid,
    p_servings numeric default 1,
    p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_recipe record;
    v_nutrition jsonb;
    v_user_goals jsonb;
    v_impact jsonb;
begin
    -- Get recipe nutrition
    select nutrition into v_nutrition
    from public.recipes
    where id = p_recipe_id;
    
    if v_nutrition is null then
        return jsonb_build_object('error', 'Recipe nutrition data not available');
    end if;
    
    -- Get user goals if user_id provided
    if p_user_id is not null then
        select jsonb_object_agg(goal_type, target_daily)
        into v_user_goals
        from public.user_health_goals
        where user_id = p_user_id
        and date = current_date;
    end if;
    
    -- Calculate impact per serving
    v_impact := jsonb_build_object(
        'recipe_id', p_recipe_id,
        'servings', p_servings,
        'nutrition_per_serving', jsonb_build_object(
            'calories', coalesce((v_nutrition->>'calories')::numeric, 0) * p_servings,
            'protein', coalesce((v_nutrition->>'protein')::numeric, 0) * p_servings,
            'carbs', coalesce((v_nutrition->>'carbs')::numeric, 0) * p_servings,
            'fat', coalesce((v_nutrition->>'fat')::numeric, 0) * p_servings,
            'fiber', coalesce((v_nutrition->>'fiber')::numeric, 0) * p_servings,
            'sodium', coalesce((v_nutrition->>'sodium')::numeric, 0) * p_servings
        )
    );
    
    -- Add goal progress if user goals exist
    if v_user_goals is not null then
        v_impact := v_impact || jsonb_build_object(
            'goal_progress', jsonb_build_object(
                'protein', case 
                    when (v_user_goals->>'protein')::numeric > 0 then
                        round(((v_nutrition->>'protein')::numeric * p_servings / (v_user_goals->>'protein')::numeric * 100)::numeric, 1)
                    else null
                end,
                'fiber', case 
                    when (v_user_goals->>'fiber')::numeric > 0 then
                        round(((v_nutrition->>'fiber')::numeric * p_servings / (v_user_goals->>'fiber')::numeric * 100)::numeric, 1)
                    else null
                end,
                'calories', case 
                    when (v_user_goals->>'calories')::numeric > 0 then
                        round(((v_nutrition->>'calories')::numeric * p_servings / (v_user_goals->>'calories')::numeric * 100)::numeric, 1)
                    else null
                end
            )
        );
    end if;
    
    return v_impact;
end;
$$;

-- ============================================
-- 5. ML MODEL METADATA
-- ============================================
-- Stores metadata for client-side ML models (TensorFlow.js)

create table if not exists public.ml_model_metadata (
    id uuid primary key default gen_random_uuid(),
    model_type text not null, -- 'price_predictor', 'object_detection', etc.
    model_version text not null,
    model_config jsonb not null, -- Model architecture, hyperparameters
    training_data_hash text, -- Hash of training data for versioning
    performance_metrics jsonb, -- Accuracy, loss, etc.
    file_url text, -- URL to model file (stored in storage bucket)
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique(model_type, model_version)
);

create index if not exists ml_model_metadata_type_active_idx on public.ml_model_metadata(model_type, is_active) where is_active = true;

-- Function to get latest active model
create or replace function get_latest_ml_model(p_model_type text)
returns table (
    model_id uuid,
    model_version text,
    model_config jsonb,
    file_url text,
    performance_metrics jsonb
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        m.id as model_id,
        m.model_version,
        m.model_config,
        m.file_url,
        m.performance_metrics
    from public.ml_model_metadata m
    where m.model_type = p_model_type
    and m.is_active = true
    order by m.created_at desc
    limit 1;
end;
$$;

-- ============================================
-- 6. RLS POLICIES
-- ============================================

-- Price history: Users can view all, insert their own
alter table public.price_history enable row level security;
create policy "Price history is viewable by all authenticated users"
    on public.price_history for select
    using (auth.role() = 'authenticated');
create policy "Users can insert their own price reports"
    on public.price_history for insert
    with check (auth.uid() = user_id or user_id is null);

-- Ingredient substitutions: Public read, admin write
alter table public.ingredient_substitutions enable row level security;
create policy "Substitutions are viewable by all"
    on public.ingredient_substitutions for select
    using (true);

-- Cooking timers: Users can only access their own
alter table public.cooking_timers enable row level security;
create policy "Users can view their own timers"
    on public.cooking_timers for select
    using (auth.uid() = user_id);
create policy "Users can insert their own timers"
    on public.cooking_timers for insert
    with check (auth.uid() = user_id);
create policy "Users can update their own timers"
    on public.cooking_timers for update
    using (auth.uid() = user_id);

-- Health goals: Users can only access their own
alter table public.user_health_goals enable row level security;
create policy "Users can manage their own health goals"
    on public.user_health_goals for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Recipe consumption: Users can only access their own
alter table public.recipe_consumption enable row level security;
create policy "Users can manage their own consumption"
    on public.recipe_consumption for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ML models: Public read (for client-side loading)
alter table public.ml_model_metadata enable row level security;
create policy "ML models are viewable by all authenticated users"
    on public.ml_model_metadata for select
    using (auth.role() = 'authenticated');

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================
grant execute on function get_price_trend(text, integer) to authenticated;
grant execute on function find_ingredient_substitutions(text, real) to authenticated;
grant execute on function can_substitute_ingredient(text, text) to authenticated;
grant execute on function get_active_timers(uuid) to authenticated;
grant execute on function complete_timer(uuid, uuid) to authenticated;
grant execute on function calculate_recipe_health_impact(uuid, numeric, uuid) to authenticated;
grant execute on function get_latest_ml_model(text) to authenticated;

