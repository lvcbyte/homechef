-- Recipes System Migration
-- Creates tables for recipes, likes, categories, and matching logic

-- Recipes table
create table if not exists public.recipes (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    author text not null default 'Dietmar Lattré',
    image_url text,
    prep_time_minutes integer not null,
    cook_time_minutes integer,
    total_time_minutes integer not null,
    difficulty text not null check (difficulty in ('Makkelijk', 'Gemiddeld', 'Moeilijk')),
    servings integer,
    ingredients jsonb not null default '[]'::jsonb, -- Array of {name, quantity, unit}
    instructions jsonb not null default '[]'::jsonb, -- Array of step objects
    nutrition jsonb, -- {calories, protein, carbs, fat, etc}
    tags text[] default '{}', -- For filtering: ['Italiaans', 'Vegan', 'Comfort Food', etc]
    category text, -- Main category
    is_featured boolean default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Recipe categories for filtering
create table if not exists public.recipe_categories (
    id uuid primary key default gen_random_uuid(),
    recipe_id uuid not null references public.recipes (id) on delete cascade,
    category text not null, -- 'Italiaans', 'Aziatisch', 'Vegan', 'Comfort Food', 'High Protein', 'Plant-based', 'Feest', 'Budget', etc
    created_at timestamptz not null default timezone('utc', now()),
    unique(recipe_id, category)
);

-- Recipe likes (for trending calculation)
create table if not exists public.recipe_likes (
    id uuid primary key default gen_random_uuid(),
    recipe_id uuid not null references public.recipes (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    unique(recipe_id, user_id)
);

-- Recipe of the day tracking (to ensure one per day)
create table if not exists public.recipe_of_the_day (
    id uuid primary key default gen_random_uuid(),
    recipe_id uuid not null references public.recipes (id) on delete cascade,
    date date not null unique default current_date,
    created_at timestamptz not null default timezone('utc', now())
);

-- Indexes for performance
create index if not exists idx_recipes_category on public.recipes (category);
create index if not exists idx_recipes_tags on public.recipes using gin (tags);
create index if not exists idx_recipes_total_time on public.recipes (total_time_minutes);
create index if not exists idx_recipes_difficulty on public.recipes (difficulty);
create index if not exists idx_recipes_created_at on public.recipes (created_at desc);
create index if not exists idx_recipe_categories_recipe_id on public.recipe_categories (recipe_id);
create index if not exists idx_recipe_categories_category on public.recipe_categories (category);
create index if not exists idx_recipe_likes_recipe_id on public.recipe_likes (recipe_id);
create index if not exists idx_recipe_likes_user_id on public.recipe_likes (user_id);
create index if not exists idx_recipe_likes_created_at on public.recipe_likes (created_at desc);

-- RLS Policies
alter table public.recipes enable row level security;
alter table public.recipe_categories enable row level security;
alter table public.recipe_likes enable row level security;
alter table public.recipe_of_the_day enable row level security;

-- Recipes are readable by everyone, but only authenticated users can create/update
create policy "Recipes are viewable by everyone" on public.recipes
    for select using (true);

create policy "Recipes are maintainable by authenticated users" on public.recipes
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Recipe categories are viewable by everyone
create policy "Recipe categories are viewable by everyone" on public.recipe_categories
    for select using (true);

create policy "Recipe categories are maintainable by authenticated users" on public.recipe_categories
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Recipe likes are viewable by everyone, but users can only manage their own
create policy "Recipe likes are viewable by everyone" on public.recipe_likes
    for select using (true);

create policy "Users can manage their own recipe likes" on public.recipe_likes
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recipe of the day is viewable by everyone
create policy "Recipe of the day is viewable by everyone" on public.recipe_of_the_day
    for select using (true);

-- Function to get recipe of the day (creates one if it doesn't exist for today)
create or replace function public.get_recipe_of_the_day()
returns uuid
language plpgsql
as $$
declare
    today_recipe_id uuid;
    random_recipe_id uuid;
begin
    -- Check if recipe of the day exists for today
    select recipe_id into today_recipe_id
    from public.recipe_of_the_day
    where date = current_date;

    -- If not, select a random recipe and create entry
    if today_recipe_id is null then
        select id into random_recipe_id
        from public.recipes
        order by random()
        limit 1;

        if random_recipe_id is not null then
            insert into public.recipe_of_the_day (recipe_id, date)
            values (random_recipe_id, current_date)
            on conflict (date) do nothing
            returning recipe_id into today_recipe_id;
        end if;
    end if;

    return coalesce(today_recipe_id, random_recipe_id);
end;
$$;

-- Function to match recipes with user inventory
create or replace function public.match_recipes_with_inventory(
    p_user_id uuid,
    p_category text default null,
    p_max_time_minutes integer default null,
    p_difficulty text default null,
    p_limit integer default 20
)
returns table (
    recipe_id uuid,
    title text,
    description text,
    author text,
    image_url text,
    total_time_minutes integer,
    difficulty text,
    servings integer,
    match_score real,
    matched_ingredients_count integer,
    total_ingredients_count integer,
    likes_count bigint
)
language plpgsql
as $$
begin
    return query
    with user_inventory as (
        select lower(trim(name)) as item_name, category
        from public.inventory
        where user_id = p_user_id
          and (expires_at is null or expires_at > now())
    ),
    recipe_matches as (
        select
            r.id as recipe_id,
            r.title,
            r.description,
            r.author,
            r.image_url,
            r.total_time_minutes,
            r.difficulty,
            r.servings,
            r.ingredients,
            (
                select count(*)
                from jsonb_array_elements(r.ingredients) as ing
                where exists (
                    select 1
                    from user_inventory ui
                    where lower(trim(ing->>'name')) like '%' || ui.item_name || '%'
                       or ui.item_name like '%' || lower(trim(ing->>'name')) || '%'
                )
            )::real / greatest(jsonb_array_length(r.ingredients), 1)::real as match_score,
            (
                select count(*)
                from jsonb_array_elements(r.ingredients) as ing
                where exists (
                    select 1
                    from user_inventory ui
                    where lower(trim(ing->>'name')) like '%' || ui.item_name || '%'
                       or ui.item_name like '%' || lower(trim(ing->>'name')) || '%'
                )
            ) as matched_ingredients_count,
            jsonb_array_length(r.ingredients) as total_ingredients_count
        from public.recipes r
        where (p_category is null or r.category = p_category or p_category = any(r.tags))
          and (p_max_time_minutes is null or r.total_time_minutes <= p_max_time_minutes)
          and (p_difficulty is null or r.difficulty = p_difficulty)
    )
    select
        rm.recipe_id,
        rm.title,
        rm.description,
        rm.author,
        rm.image_url,
        rm.total_time_minutes,
        rm.difficulty,
        rm.servings,
        -- Match score with some flexibility (allow 2-3 missing ingredients)
        case
            when rm.matched_ingredients_count >= rm.total_ingredients_count - 2 then rm.match_score * 1.2
            when rm.matched_ingredients_count >= rm.total_ingredients_count - 3 then rm.match_score * 1.0
            else rm.match_score * 0.8
        end as match_score,
        rm.matched_ingredients_count,
        rm.total_ingredients_count,
        coalesce(l.likes_count, 0) as likes_count
    from recipe_matches rm
    left join (
        select recipe_id, count(*) as likes_count
        from public.recipe_likes
        group by recipe_id
    ) l on l.recipe_id = rm.recipe_id
    where rm.match_score > 0.3 -- At least 30% match
    order by match_score desc, likes_count desc
    limit p_limit;
end;
$$;

-- Function to get trending recipes (based on likes in last 7 days)
create or replace function public.get_trending_recipes(
    p_limit integer default 10
)
returns table (
    recipe_id uuid,
    title text,
    description text,
    author text,
    image_url text,
    total_time_minutes integer,
    difficulty text,
    servings integer,
    likes_count bigint
)
language sql
as $$
    select
        r.id as recipe_id,
        r.title,
        r.description,
        r.author,
        r.image_url,
        r.total_time_minutes,
        r.difficulty,
        r.servings,
        count(rl.id) as likes_count
    from public.recipes r
    left join public.recipe_likes rl on rl.recipe_id = r.id
        and rl.created_at > now() - interval '7 days'
    group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
    order by likes_count desc, r.created_at desc
    limit p_limit;
$$;

-- Function to toggle like on a recipe
create or replace function public.toggle_recipe_like(
    p_recipe_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
    v_user_id uuid;
    v_exists boolean;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;

    -- Check if like exists
    select exists(
        select 1 from public.recipe_likes
        where recipe_id = p_recipe_id and user_id = v_user_id
    ) into v_exists;

    if v_exists then
        -- Unlike
        delete from public.recipe_likes
        where recipe_id = p_recipe_id and user_id = v_user_id;
        return false;
    else
        -- Like
        insert into public.recipe_likes (recipe_id, user_id)
        values (p_recipe_id, v_user_id)
        on conflict (recipe_id, user_id) do nothing;
        return true;
    end if;
end;
$$;

-- Function to check if user has liked a recipe
create or replace function public.user_has_liked_recipe(
    p_recipe_id uuid
)
returns boolean
language sql
security definer
as $$
    select exists(
        select 1 from public.recipe_likes
        where recipe_id = p_recipe_id
          and user_id = auth.uid()
    );
$$;

-- Function to get recipe categories for filtering
create or replace function public.get_recipe_categories()
returns table (
    category text,
    count bigint
)
language sql
as $$
    select
        category,
        count(*) as count
    from (
        select unnest(tags) as category
        from public.recipes
    ) as categories
    group by category
    order by count desc;
$$;

