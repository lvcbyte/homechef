-- Advanced AI Features Migration
-- Implements Alain.AI-like functionality for Stockpit
-- Includes recipe variations, menu planning, user preferences tracking, and recipe analytics

-- Recipe Variations Table
-- Stores AI-generated variations of existing recipes (local flavors, trends, seasonal, dietary, allergies)
create table if not exists public.recipe_variations (
    id uuid primary key default gen_random_uuid(),
    base_recipe_id uuid not null references public.recipes (id) on delete cascade,
    user_id uuid references auth.users (id) on delete set null, -- null = public variation
    title text not null,
    description text,
    variation_type text not null check (variation_type in (
        'local_flavor', 
        'trend', 
        'seasonal', 
        'dietary', 
        'allergy', 
        'custom'
    )),
    variation_details jsonb, -- {local_region, trend_name, season, dietary_type, allergies, etc}
    ingredients jsonb not null default '[]'::jsonb,
    instructions jsonb not null default '[]'::jsonb,
    prep_time_minutes integer,
    cook_time_minutes integer,
    total_time_minutes integer,
    difficulty text check (difficulty in ('Makkelijk', 'Gemiddeld', 'Moeilijk')),
    servings integer,
    nutrition jsonb,
    tags text[] default '{}',
    category text,
    image_url text,
    language text default 'nl', -- For localization
    units_system text default 'metric', -- metric or imperial
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for recipe variations
create index if not exists recipe_variations_base_recipe_idx 
    on public.recipe_variations(base_recipe_id);
create index if not exists recipe_variations_user_idx 
    on public.recipe_variations(user_id);
create index if not exists recipe_variations_type_idx 
    on public.recipe_variations(variation_type);

-- Menu Planning Table
-- Stores AI-generated seasonal menus with ingredient lists
create table if not exists public.menu_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    description text,
    season text, -- 'spring', 'summer', 'autumn', 'winter'
    start_date date not null,
    end_date date not null,
    menu_items jsonb not null default '[]'::jsonb, -- Array of {recipe_id, day, meal_type, servings}
    ingredient_list jsonb, -- Aggregated ingredient list for shopping
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Index for menu plans
create index if not exists menu_plans_user_date_idx 
    on public.menu_plans(user_id, start_date desc);

-- User Recipe Preferences Tracking
-- Tracks user interactions with recipes for AI learning
create table if not exists public.recipe_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    recipe_id uuid references public.recipes (id) on delete set null,
    interaction_type text not null check (interaction_type in (
        'view', 
        'like', 
        'cook', 
        'save', 
        'modify', 
        'share',
        'rate'
    )),
    rating integer check (rating between 1 and 5),
    modifications jsonb, -- What user changed (ingredients, portions, etc)
    context jsonb, -- Additional context (time_of_day, occasion, mood, etc)
    created_at timestamptz not null default timezone('utc', now()),
    interaction_date date not null default current_date -- For unique constraint
);

-- Index for preferences
create index if not exists recipe_preferences_user_idx 
    on public.recipe_preferences(user_id, created_at desc);
create index if not exists recipe_preferences_recipe_idx 
    on public.recipe_preferences(recipe_id);

-- Unique constraint: one interaction per type per recipe per user per day
create unique index if not exists recipe_preferences_unique_daily 
    on public.recipe_preferences(user_id, recipe_id, interaction_type, interaction_date);

-- Recipe Analytics Table
-- Aggregated analytics for AI predictions
create table if not exists public.recipe_analytics (
    id uuid primary key default gen_random_uuid(),
    recipe_id uuid not null references public.recipes (id) on delete cascade,
    period_start date not null,
    period_end date not null,
    total_views integer default 0,
    total_likes integer default 0,
    total_cooks integer default 0,
    total_saves integer default 0,
    average_rating numeric(3,2),
    common_modifications jsonb, -- Most common modifications
    popular_combinations jsonb, -- Recipes often cooked together
    seasonal_trends jsonb, -- Performance by season
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique(recipe_id, period_start, period_end)
);

-- Index for analytics
create index if not exists recipe_analytics_recipe_period_idx 
    on public.recipe_analytics(recipe_id, period_start desc);

-- Experimental Kitchen Table
-- Stores experimental recipes and revived old recipes
create table if not exists public.experimental_recipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    description text,
    status text not null default 'draft' check (status in ('draft', 'testing', 'published', 'archived')),
    source_type text check (source_type in ('new', 'revived', 'variation')),
    source_recipe_id uuid references public.recipes (id) on delete set null,
    ingredients jsonb not null default '[]'::jsonb,
    instructions jsonb not null default '[]'::jsonb,
    prep_time_minutes integer,
    cook_time_minutes integer,
    total_time_minutes integer,
    difficulty text check (difficulty in ('Makkelijk', 'Gemiddeld', 'Moeilijk')),
    servings integer,
    nutrition jsonb,
    tags text[] default '{}',
    category text,
    image_url text,
    notes jsonb, -- Development notes, testing results, etc
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Index for experimental recipes
create index if not exists experimental_recipes_user_status_idx 
    on public.experimental_recipes(user_id, status, created_at desc);

-- RLS Policies
alter table public.recipe_variations enable row level security;
alter table public.menu_plans enable row level security;
alter table public.recipe_preferences enable row level security;
alter table public.recipe_analytics enable row level security;
alter table public.experimental_recipes enable row level security;

-- Recipe Variations Policies
create policy "Users can view public recipe variations"
    on public.recipe_variations
    for select
    using (user_id is null or auth.uid() = user_id);

create policy "Users can create their own recipe variations"
    on public.recipe_variations
    for insert
    with check (auth.uid() = user_id or user_id is null);

create policy "Users can update their own recipe variations"
    on public.recipe_variations
    for update
    using (auth.uid() = user_id);

create policy "Users can delete their own recipe variations"
    on public.recipe_variations
    for delete
    using (auth.uid() = user_id);

-- Menu Plans Policies
create policy "Users can view their own menu plans"
    on public.menu_plans
    for select
    using (auth.uid() = user_id);

create policy "Users can create their own menu plans"
    on public.menu_plans
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own menu plans"
    on public.menu_plans
    for update
    using (auth.uid() = user_id);

create policy "Users can delete their own menu plans"
    on public.menu_plans
    for delete
    using (auth.uid() = user_id);

-- Recipe Preferences Policies
create policy "Users can view their own preferences"
    on public.recipe_preferences
    for select
    using (auth.uid() = user_id);

create policy "Users can create their own preferences"
    on public.recipe_preferences
    for insert
    with check (auth.uid() = user_id);

-- Recipe Analytics Policies (read-only for users, full access for admins)
create policy "Users can view recipe analytics"
    on public.recipe_analytics
    for select
    using (true); -- Public analytics

-- Experimental Recipes Policies
create policy "Users can view their own experimental recipes"
    on public.experimental_recipes
    for select
    using (auth.uid() = user_id);

create policy "Users can create their own experimental recipes"
    on public.experimental_recipes
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own experimental recipes"
    on public.experimental_recipes
    for update
    using (auth.uid() = user_id);

create policy "Users can delete their own experimental recipes"
    on public.experimental_recipes
    for delete
    using (auth.uid() = user_id);

-- Functions to update updated_at timestamps
create or replace function update_recipe_variations_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create or replace function update_menu_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create or replace function update_recipe_analytics_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create or replace function update_experimental_recipes_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

-- Triggers
create trigger update_recipe_variations_updated_at
    before update on public.recipe_variations
    for each row
    execute function update_recipe_variations_updated_at();

create trigger update_menu_plans_updated_at
    before update on public.menu_plans
    for each row
    execute function update_menu_plans_updated_at();

create trigger update_recipe_analytics_updated_at
    before update on public.recipe_analytics
    for each row
    execute function update_recipe_analytics_updated_at();

create trigger update_experimental_recipes_updated_at
    before update on public.experimental_recipes
    for each row
    execute function update_experimental_recipes_updated_at();

-- Function to track recipe interaction
create or replace function track_recipe_interaction(
    p_recipe_id uuid,
    p_interaction_type text,
    p_rating integer default null,
    p_modifications jsonb default null,
    p_context jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_preference_id uuid;
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;

    insert into public.recipe_preferences (
        user_id,
        recipe_id,
        interaction_type,
        rating,
        modifications,
        context,
        interaction_date
    ) values (
        v_user_id,
        p_recipe_id,
        p_interaction_type,
        p_rating,
        p_modifications,
        p_context,
        current_date
    )
    on conflict (user_id, recipe_id, interaction_type, interaction_date)
    do update set
        rating = coalesce(p_rating, recipe_preferences.rating),
        modifications = coalesce(p_modifications, recipe_preferences.modifications),
        context = coalesce(p_context, recipe_preferences.context),
        created_at = timezone('utc', now())
    returning id into v_preference_id;

    return v_preference_id;
end;
$$;

-- Function to get seasonal ingredients (helper for AI)
create or replace function get_seasonal_ingredients(p_season text)
returns text[]
language plpgsql
as $$
declare
    v_ingredients text[];
begin
    -- Common seasonal ingredients in Belgium/Netherlands
    case p_season
        when 'spring' then
            v_ingredients := array['asperges', 'rabarber', 'spinazie', 'erwten', 'aardbeien', 'radijs', 'sla'];
        when 'summer' then
            v_ingredients := array['tomaat', 'courgette', 'aubergine', 'paprika', 'bessen', 'kruiden', 'maïs'];
        when 'autumn' then
            v_ingredients := array['pompoen', 'appel', 'peer', 'paddenstoelen', 'kool', 'wortel', 'biet'];
        when 'winter' then
            v_ingredients := array['boerenkool', 'spruitjes', 'ui', 'aardappel', 'wortel', 'pastinaak', 'kool'];
        else
            v_ingredients := array[]::text[];
    end case;

    return v_ingredients;
end;
$$;

-- Comments
comment on table public.recipe_variations is 'AI-generated variations of recipes for different contexts (local, seasonal, dietary, etc)';
comment on table public.menu_plans is 'AI-generated seasonal menu plans with ingredient lists';
comment on table public.recipe_preferences is 'Tracks user interactions with recipes for AI learning and personalization';
comment on table public.recipe_analytics is 'Aggregated analytics for recipe performance and AI predictions';
comment on table public.experimental_recipes is 'Experimental and revived recipes from the AI kitchen';

