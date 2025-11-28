-- Improve create_recipe function with better error handling and performance
-- Also add helper function to verify recipe creation

-- Drop and recreate with better error handling
drop function if exists public.create_recipe(text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text, text);

create or replace function public.create_recipe(
    p_title text,
    p_description text default null,
    p_image_url text default null,
    p_prep_time_minutes integer default 0,
    p_cook_time_minutes integer default 0,
    p_total_time_minutes integer default 30,
    p_difficulty text default 'Gemiddeld',
    p_servings integer default 4,
    p_ingredients jsonb default '[]'::jsonb,
    p_instructions jsonb default '[]'::jsonb,
    p_tags text[] default ARRAY[]::text[],
    p_category text default 'Overig',
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
    v_error_message text;
begin
    -- Validate user is authenticated
    if v_user_id is null then
        raise exception 'User must be authenticated to create recipes';
    end if;

    -- Validate required fields
    if p_title is null or trim(p_title) = '' then
        raise exception 'Recipe title is required';
    end if;

    -- Validate difficulty
    if p_difficulty not in ('Makkelijk', 'Gemiddeld', 'Moeilijk', 'Advanced') then
        p_difficulty := 'Gemiddeld';
    end if;

    -- Get author name from parameter or profile or use default
    begin
        if p_author is not null and trim(p_author) != '' then
            v_author_name := trim(p_author);
        else
            select coalesce(email, 'Gebruiker') into v_author_name
            from auth.users
            where id = v_user_id;
            
            if v_author_name is null or v_author_name = '' then
                v_author_name := 'Gebruiker';
            end if;
        end if;
    exception when others then
        v_author_name := 'Gebruiker';
    end;

    -- Insert recipe with error handling
    begin
        insert into public.recipes (
            title, description, author, image_url,
            prep_time_minutes, cook_time_minutes, total_time_minutes,
            difficulty, servings, ingredients, instructions, tags, category
        ) values (
            trim(p_title), 
            nullif(trim(coalesce(p_description, '')), ''), 
            v_author_name, 
            nullif(trim(coalesce(p_image_url, '')), ''),
            greatest(0, coalesce(p_prep_time_minutes, 0)), 
            greatest(0, coalesce(p_cook_time_minutes, greatest(0, coalesce(p_total_time_minutes, 30) - coalesce(p_prep_time_minutes, 0)))), 
            greatest(0, coalesce(p_total_time_minutes, 30)),
            coalesce(p_difficulty, 'Gemiddeld'), 
            greatest(1, coalesce(p_servings, 4)), 
            coalesce(p_ingredients, '[]'::jsonb), 
            coalesce(p_instructions, '[]'::jsonb), 
            coalesce(p_tags, ARRAY[]::text[]), 
            coalesce(nullif(trim(p_category), ''), 'Overig')
        ) returning id into v_recipe_id;

        if v_recipe_id is null then
            raise exception 'Failed to create recipe: no ID returned';
        end if;
    exception when others then
        get stacked diagnostics v_error_message = message_text;
        raise exception 'Error creating recipe: %', v_error_message;
    end;

    -- Insert recipe categories from tags and main category (non-blocking)
    begin
        if array_length(coalesce(p_tags, ARRAY[]::text[]), 1) > 0 then
            insert into public.recipe_categories (recipe_id, category)
            select v_recipe_id, unnest(p_tags)
            where unnest(p_tags) is not null and trim(unnest(p_tags)) != ''
            on conflict (recipe_id, category) do nothing;
        end if;

        -- Insert main category if provided
        if p_category is not null and trim(p_category) != '' then
            insert into public.recipe_categories (recipe_id, category)
            values (v_recipe_id, trim(p_category))
            on conflict (recipe_id, category) do nothing;
        end if;
    exception when others then
        -- Non-critical, continue even if category insert fails
        null;
    end;

    return v_recipe_id;
end;
$$;

-- Grant permissions
grant execute on function public.create_recipe(text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text, text) to authenticated;

-- Add helpful comment
comment on function public.create_recipe is 'Creates a new recipe and returns its UUID. Handles author name from parameter or user email. Returns UUID of created recipe.';

-- Test function to verify recipe creation works
create or replace function public.test_create_recipe()
returns text
language plpgsql
security definer
as $$
declare
    v_test_id uuid;
    v_result text;
begin
    -- Try to create a test recipe
    select create_recipe(
        'Test Recept',
        'Dit is een test recept',
        null,
        10,
        20,
        30,
        'Makkelijk',
        2,
        '[{"name": "test", "quantity": "1", "unit": "stuk"}]'::jsonb,
        '[{"step": 1, "instruction": "Test stap"}]'::jsonb,
        ARRAY['Test']::text[],
        'Overig',
        'Test Gebruiker'
    ) into v_test_id;

    if v_test_id is null then
        return 'FAILED: No ID returned';
    end if;

    -- Clean up test recipe
    delete from public.recipes where id = v_test_id;

    return 'SUCCESS: Recipe creation works correctly';
exception when others then
    return 'FAILED: ' || sqlerrm;
end;
$$;

-- Grant test function (only for debugging)
grant execute on function public.test_create_recipe() to authenticated;

