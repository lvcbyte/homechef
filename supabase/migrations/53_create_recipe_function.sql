-- Function to create a recipe (for all authenticated users, not just admin)
-- This allows users to add their own recipes via /scan

create or replace function public.create_recipe(
    p_title text,
    p_description text,
    p_image_url text default null,
    p_prep_time_minutes integer,
    p_cook_time_minutes integer default null,
    p_total_time_minutes integer,
    p_difficulty text,
    p_servings integer default null,
    p_ingredients jsonb,
    p_instructions jsonb,
    p_tags text[] default '{}',
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
    -- Get author name from profile or use default
    if p_author is not null then
        v_author_name := p_author;
    else
        select coalesce(email, 'Gebruiker') into v_author_name
        from auth.users
        where id = v_user_id;
    end if;

    -- Insert recipe
    insert into public.recipes (
        title, description, author, image_url,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        difficulty, servings, ingredients, instructions, tags, category
    ) values (
        p_title, p_description, v_author_name, p_image_url,
        p_prep_time_minutes, coalesce(p_cook_time_minutes, p_total_time_minutes - p_prep_time_minutes), p_total_time_minutes,
        p_difficulty, p_servings, p_ingredients, p_instructions, p_tags, p_category
    ) returning id into v_recipe_id;

    -- Insert recipe categories from tags and main category
    if array_length(p_tags, 1) > 0 then
        insert into public.recipe_categories (recipe_id, category)
        select v_recipe_id, unnest(p_tags)
        on conflict (recipe_id, category) do nothing;
    end if;

    -- Insert main category if provided
    if p_category is not null then
        insert into public.recipe_categories (recipe_id, category)
        values (v_recipe_id, p_category)
        on conflict (recipe_id, category) do nothing;
    end if;

    return v_recipe_id;
end;
$$;

-- Grant permissions
grant execute on function public.create_recipe(text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text, text) to authenticated;

-- Function to generate recipe with AI assistance
-- This will be called from the frontend when user describes a recipe
create or replace function public.generate_recipe_with_ai(
    p_description text,
    p_category text default null,
    p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result jsonb;
begin
    -- This function will be called from Edge Function or frontend
    -- For now, return a placeholder structure
    -- The actual AI generation happens in the frontend/Edge Function
    return jsonb_build_object(
        'status', 'pending',
        'message', 'AI generation should be handled in Edge Function or frontend'
    );
end;
$$;

grant execute on function public.generate_recipe_with_ai(text, text, uuid) to authenticated;

