-- Admin Recipe Management Enhancement
-- Extended admin functions for comprehensive recipe editing

-- Enhanced admin_update_recipe function with all fields
create or replace function admin_update_recipe(
    p_recipe_id uuid,
    p_title text default null,
    p_description text default null,
    p_image_url text default null,
    p_prep_time_minutes integer default null,
    p_cook_time_minutes integer default null,
    p_total_time_minutes integer default null,
    p_difficulty text default null,
    p_servings integer default null,
    p_ingredients jsonb default null,
    p_instructions jsonb default null,
    p_tags text[] default null,
    p_category text default null,
    p_nutrition jsonb default null,
    p_author text default null,
    p_is_featured boolean default null
)
returns void
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
    v_old_recipe jsonb;
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can update recipes';
    end if;

    -- Get old recipe data for logging
    select to_jsonb(r.*) into v_old_recipe
    from public.recipes r
    where r.id = p_recipe_id;

    if v_old_recipe is null then
        raise exception 'Recipe not found';
    end if;

    -- Update recipe with all fields
    update public.recipes
    set
        title = coalesce(p_title, title),
        description = coalesce(p_description, description),
        image_url = coalesce(p_image_url, image_url),
        prep_time_minutes = coalesce(p_prep_time_minutes, prep_time_minutes),
        cook_time_minutes = coalesce(p_cook_time_minutes, cook_time_minutes),
        total_time_minutes = coalesce(p_total_time_minutes, total_time_minutes),
        difficulty = coalesce(p_difficulty, difficulty),
        servings = coalesce(p_servings, servings),
        ingredients = coalesce(p_ingredients, ingredients),
        instructions = coalesce(p_instructions, instructions),
        tags = coalesce(p_tags, tags),
        category = coalesce(p_category, category),
        nutrition = coalesce(p_nutrition, nutrition),
        author = coalesce(p_author, author),
        is_featured = coalesce(p_is_featured, is_featured),
        updated_at = timezone('utc', now())
    where id = p_recipe_id;

    -- Update recipe categories if tags or category changed
    if p_tags is not null or p_category is not null then
        -- Delete old categories
        delete from public.recipe_categories
        where recipe_id = p_recipe_id;

        -- Insert new categories from tags
        if p_tags is not null and array_length(p_tags, 1) > 0 then
            insert into public.recipe_categories (recipe_id, category)
            select p_recipe_id, unnest(p_tags)
            on conflict (recipe_id, category) do nothing;
        end if;

        -- Insert main category
        if p_category is not null then
            insert into public.recipe_categories (recipe_id, category)
            values (p_recipe_id, p_category)
            on conflict (recipe_id, category) do nothing;
        end if;
    end if;

    -- Log admin action with detailed changes
    perform log_admin_action(
        'update_recipe',
        'recipe',
        p_recipe_id,
        jsonb_build_object(
            'old_recipe', v_old_recipe,
            'updated_fields', jsonb_build_object(
                'title', p_title,
                'description', p_description,
                'image_url', p_image_url,
                'prep_time_minutes', p_prep_time_minutes,
                'cook_time_minutes', p_cook_time_minutes,
                'total_time_minutes', p_total_time_minutes,
                'difficulty', p_difficulty,
                'servings', p_servings,
                'ingredients', p_ingredients,
                'instructions', p_instructions,
                'tags', p_tags,
                'category', p_category,
                'nutrition', p_nutrition,
                'author', p_author,
                'is_featured', p_is_featured
            )
        )
    );
end;
$$;

-- Function to get full recipe details for admin
create or replace function admin_get_recipe_details(p_recipe_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
    v_recipe jsonb;
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can view recipe details';
    end if;

    select to_jsonb(r.*) into v_recipe
    from public.recipes r
    where r.id = p_recipe_id;

    if v_recipe is null then
        raise exception 'Recipe not found';
    end if;

    -- Add categories
    v_recipe := v_recipe || jsonb_build_object(
        'categories', (
            select jsonb_agg(category)
            from public.recipe_categories
            where recipe_id = p_recipe_id
        )
    );

    -- Add likes count
    v_recipe := v_recipe || jsonb_build_object(
        'likes_count', (
            select count(*)
            from public.recipe_likes
            where recipe_id = p_recipe_id
        )
    );

    return v_recipe;
end;
$$;

-- Grant permissions
grant execute on function admin_update_recipe(uuid, text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text, jsonb, text, boolean) to authenticated;
grant execute on function admin_get_recipe_details(uuid) to authenticated;

