-- Fix create_recipe function to ensure it works correctly
-- Also ensure saved_recipes can be properly inserted

-- First, ensure the create_recipe function signature matches what we're calling
create or replace function public.create_recipe(
    p_title text,
    p_description text,
    p_image_url text,
    p_prep_time_minutes integer,
    p_cook_time_minutes integer,
    p_total_time_minutes integer,
    p_difficulty text,
    p_servings integer,
    p_ingredients jsonb,
    p_instructions jsonb,
    p_tags text[],
    p_category text,
    p_author text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_recipe_id uuid;
    v_user_id uuid := auth.uid();
    v_author_name text;
begin
    -- Validate required fields
    if p_title is null or trim(p_title) = '' then
        raise exception 'Recipe title is required';
    end if;

    -- Get author name from parameter or profile or use default
    if p_author is not null and trim(p_author) != '' then
        v_author_name := p_author;
    else
        select coalesce(email, 'Gebruiker') into v_author_name
        from auth.users
        where id = v_user_id;
        
        if v_author_name is null then
            v_author_name := 'Gebruiker';
        end if;
    end if;

    -- Insert recipe
    insert into public.recipes (
        title, description, author, image_url,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        difficulty, servings, ingredients, instructions, tags, category
    ) values (
        trim(p_title), 
        nullif(trim(p_description), ''), 
        v_author_name, 
        nullif(trim(p_image_url), ''),
        coalesce(p_prep_time_minutes, 0), 
        coalesce(p_cook_time_minutes, greatest(0, p_total_time_minutes - coalesce(p_prep_time_minutes, 0))), 
        coalesce(p_total_time_minutes, 30),
        coalesce(p_difficulty, 'Gemiddeld'), 
        coalesce(p_servings, 4), 
        coalesce(p_ingredients, '[]'::jsonb), 
        coalesce(p_instructions, '[]'::jsonb), 
        coalesce(p_tags, ARRAY[]::text[]), 
        coalesce(p_category, 'Overig')
    ) returning id into v_recipe_id;

    -- Insert recipe categories from tags and main category
    if array_length(coalesce(p_tags, ARRAY[]::text[]), 1) > 0 then
        insert into public.recipe_categories (recipe_id, category)
        select v_recipe_id, unnest(p_tags)
        where unnest(p_tags) is not null
        on conflict (recipe_id, category) do nothing;
    end if;

    -- Insert main category if provided
    if p_category is not null and trim(p_category) != '' then
        insert into public.recipe_categories (recipe_id, category)
        values (v_recipe_id, trim(p_category))
        on conflict (recipe_id, category) do nothing;
    end if;

    return v_recipe_id;
exception
    when others then
        raise exception 'Error creating recipe: %', sqlerrm;
end;
$$;

-- Grant permissions
grant execute on function public.create_recipe(text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text, text) to authenticated;

-- Ensure saved_recipes table allows proper inserts
-- Check if unique constraint exists and handle it
do $$
begin
    -- Ensure the unique constraint exists for saved_recipes
    if not exists (
        select 1 from pg_constraint 
        where conname = 'saved_recipes_user_recipe_unique'
    ) then
        alter table public.saved_recipes
        add constraint saved_recipes_user_recipe_unique 
        unique (user_id, recipe_name);
    end if;
end $$;

-- Ensure RLS policies allow inserts
drop policy if exists "Users can insert their own saved recipes" on public.saved_recipes;
create policy "Users can insert their own saved recipes"
    on public.saved_recipes
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Users can view their own saved recipes" on public.saved_recipes;
create policy "Users can view their own saved recipes"
    on public.saved_recipes
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can update their own saved recipes" on public.saved_recipes;
create policy "Users can update their own saved recipes"
    on public.saved_recipes
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved recipes" on public.saved_recipes;
create policy "Users can delete their own saved recipes"
    on public.saved_recipes
    for delete
    to authenticated
    using (auth.uid() = user_id);

-- Add helpful comment
comment on function public.create_recipe is 'Creates a new recipe and returns its UUID. Handles author name from parameter or user email.';

