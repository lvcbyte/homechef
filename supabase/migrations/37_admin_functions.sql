-- Admin Functions for Database Operations
-- These functions allow the admin AI to safely execute database operations

-- Function to execute admin queries (with safety checks)
create or replace function execute_admin_query(p_query text)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result jsonb;
    v_user_id uuid := auth.uid();
begin
    -- Check if user is admin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can execute queries';
    end if;

    -- Log the query attempt
    perform log_admin_action(
        'execute_query',
        'database',
        null,
        jsonb_build_object('query', substring(p_query, 1, 500))
    );

    -- For safety, only allow SELECT, INSERT, UPDATE, DELETE
    -- Block DROP, TRUNCATE, ALTER, etc.
    if upper(trim(p_query)) ~ '^(DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)' then
        raise exception 'Dangerous operations are not allowed via this function';
    end if;

    -- Execute query (this is a simplified version - in production, use prepared statements)
    -- Note: This is a basic implementation. For production, you'd want more sophisticated query parsing
    raise exception 'Direct query execution not implemented. Use specific admin functions instead.';
    
    return jsonb_build_object('success', true, 'message', 'Query executed');
exception
    when others then
        perform log_admin_action(
            'query_error',
            'database',
            null,
            jsonb_build_object('error', SQLERRM, 'query', substring(p_query, 1, 500))
        );
        raise;
end;
$$;

-- Function to create a recipe (admin)
create or replace function admin_create_recipe(
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
    p_author text default 'Admin'
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_recipe_id uuid;
    v_user_id uuid := auth.uid();
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can create recipes';
    end if;

    insert into public.recipes (
        title, description, author, image_url,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        difficulty, servings, ingredients, instructions, tags, category
    ) values (
        p_title, p_description, p_author, p_image_url,
        p_prep_time_minutes, p_cook_time_minutes, p_total_time_minutes,
        p_difficulty, p_servings, p_ingredients, p_instructions, p_tags, p_category
    ) returning id into v_recipe_id;

    perform log_admin_action(
        'create_recipe',
        'recipe',
        v_recipe_id,
        jsonb_build_object('title', p_title)
    );

    return v_recipe_id;
end;
$$;

-- Function to update a recipe (admin)
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
    p_category text default null
)
returns void
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can update recipes';
    end if;

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
        updated_at = timezone('utc', now())
    where id = p_recipe_id;

    perform log_admin_action(
        'update_recipe',
        'recipe',
        p_recipe_id,
        jsonb_build_object('updated_fields', jsonb_object_delete_keys(
            jsonb_build_object(
                'title', p_title,
                'description', p_description,
                'image_url', p_image_url
            ),
            array['null']
        ))
    );
end;
$$;

-- Function to delete a recipe (admin)
create or replace function admin_delete_recipe(p_recipe_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can delete recipes';
    end if;

    perform log_admin_action(
        'delete_recipe',
        'recipe',
        p_recipe_id,
        jsonb_build_object('recipe_id', p_recipe_id)
    );

    delete from public.recipes where id = p_recipe_id;
end;
$$;

-- Function to get system statistics
create or replace function get_admin_stats()
returns jsonb
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
    v_stats jsonb;
begin
    if not is_admin(v_user_id) then
        raise exception 'Only admins can view stats';
    end if;

    select jsonb_build_object(
        'total_users', (select count(*) from public.profiles),
        'total_recipes', (select count(*) from public.recipes),
        'total_inventory_items', (select count(*) from public.inventory),
        'total_saved_recipes', (select count(*) from public.saved_recipes),
        'total_likes', (select count(*) from public.recipe_likes),
        'recent_logs_count', (select count(*) from public.admin_logs where created_at > now() - interval '24 hours'),
        'active_admins', (select count(*) from public.profiles where is_admin = true)
    ) into v_stats;

    return v_stats;
end;
$$;

grant execute on function admin_create_recipe(text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text, text) to authenticated;
grant execute on function admin_update_recipe(uuid, text, text, text, integer, integer, integer, text, integer, jsonb, jsonb, text[], text) to authenticated;
grant execute on function admin_delete_recipe(uuid) to authenticated;
grant execute on function get_admin_stats() to authenticated;

