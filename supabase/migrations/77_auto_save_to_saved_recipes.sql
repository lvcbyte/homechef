-- Auto-save to saved_recipes migration
-- Automatically saves all AI-generated recipes (variations, experimental, menu items) to saved_recipes
-- So they appear in /saved with full detail view support

-- Helper function to create standardized recipe_payload for saved_recipes
create or replace function create_recipe_payload(
    p_id uuid,
    p_title text,
    p_description text,
    p_author text,
    p_image_url text,
    p_prep_time_minutes integer,
    p_cook_time_minutes integer,
    p_total_time_minutes integer,
    p_difficulty text,
    p_servings integer,
    p_ingredients jsonb,
    p_instructions jsonb,
    p_nutrition jsonb,
    p_tags text[],
    p_category text,
    p_source_type text default null,
    p_source_id uuid default null,
    p_metadata jsonb default null
)
returns jsonb
language plpgsql
as $$
begin
    return jsonb_build_object(
        'id', p_id,
        'recipe_id', p_id,
        'title', p_title,
        'description', p_description,
        'author', coalesce(p_author, 'STOCKPIT AI'),
        'image_url', p_image_url,
        'prep_time_minutes', p_prep_time_minutes,
        'cook_time_minutes', p_cook_time_minutes,
        'total_time_minutes', coalesce(p_total_time_minutes, 30),
        'difficulty', coalesce(p_difficulty, 'Gemiddeld'),
        'servings', p_servings,
        'ingredients', coalesce(p_ingredients, '[]'::jsonb),
        'instructions', coalesce(p_instructions, '[]'::jsonb),
        'nutrition', p_nutrition,
        'tags', coalesce(p_tags, ARRAY[]::text[]),
        'category', p_category,
        'source_type', p_source_type,
        'source_id', p_source_id,
        'metadata', p_metadata
    );
end;
$$;

-- Function to auto-save recipe to saved_recipes
create or replace function auto_save_to_saved_recipes(
    p_user_id uuid,
    p_recipe_name text,
    p_recipe_payload jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_saved_id uuid;
begin
    -- Upsert to saved_recipes (update if exists, insert if not)
    insert into public.saved_recipes (
        user_id,
        recipe_name,
        recipe_payload
    ) values (
        p_user_id,
        p_recipe_name,
        p_recipe_payload
    )
    on conflict (user_id, recipe_name)
    do update set
        recipe_payload = p_recipe_payload,
        saved_at = timezone('utc', now())
    returning id into v_saved_id;

    return v_saved_id;
end;
$$;

-- Trigger function for recipe_variations
create or replace function auto_save_recipe_variation()
returns trigger
language plpgsql
security definer
as $$
declare
    v_payload jsonb;
begin
    -- Only auto-save if user_id is set (not public variations)
    if new.user_id is not null then
        v_payload := create_recipe_payload(
            new.id,
            new.title,
            new.description,
            'STOCKPIT AI',
            new.image_url,
            new.prep_time_minutes,
            new.cook_time_minutes,
            new.total_time_minutes,
            new.difficulty,
            new.servings,
            new.ingredients,
            new.instructions,
            new.nutrition,
            new.tags,
            new.category,
            'variation',
            new.base_recipe_id,
            jsonb_build_object(
                'variation_type', new.variation_type,
                'variation_details', new.variation_details,
                'base_recipe_id', new.base_recipe_id
            )
        );

        perform auto_save_to_saved_recipes(
            new.user_id,
            new.title,
            v_payload
        );
    end if;

    return new;
end;
$$;

-- Trigger function for experimental_recipes
create or replace function auto_save_experimental_recipe()
returns trigger
language plpgsql
security definer
as $$
declare
    v_payload jsonb;
begin
    -- Auto-save when status is 'published' or 'draft' (user can change later)
    if new.status in ('draft', 'testing', 'published') then
        v_payload := create_recipe_payload(
            new.id,
            new.title,
            new.description,
            'STOCKPIT AI',
            new.image_url,
            new.prep_time_minutes,
            new.cook_time_minutes,
            new.total_time_minutes,
            new.difficulty,
            new.servings,
            new.ingredients,
            new.instructions,
            new.nutrition,
            new.tags,
            new.category,
            'experimental',
            new.source_recipe_id,
            jsonb_build_object(
                'status', new.status,
                'source_type', new.source_type,
                'source_recipe_id', new.source_recipe_id,
                'notes', new.notes
            )
        );

        perform auto_save_to_saved_recipes(
            new.user_id,
            new.title,
            v_payload
        );
    end if;

    return new;
end;
$$;

-- Trigger function for menu_plans (save each menu item as a recipe)
create or replace function auto_save_menu_plan_recipes()
returns trigger
language plpgsql
security definer
as $$
declare
    v_menu_item jsonb;
    v_recipe jsonb;
    v_payload jsonb;
    v_recipe_name text;
    v_recipe_id uuid;
begin
    -- Loop through menu items and save each recipe
    if new.menu_items is not null and jsonb_array_length(new.menu_items) > 0 then
        for v_menu_item in select * from jsonb_array_elements(new.menu_items)
        loop
            v_recipe := v_menu_item->'recipe';
            
            if v_recipe is not null and v_recipe->>'title' is not null then
                -- Generate unique ID for this saved recipe
                v_recipe_id := gen_random_uuid();
                
                -- Create unique recipe name with menu plan context
                v_recipe_name := v_recipe->>'title' || ' - ' || new.title || ' (Dag ' || coalesce(v_menu_item->>'day', '?') || ')';
                
                v_payload := create_recipe_payload(
                    v_recipe_id,
                    v_recipe->>'title',
                    v_recipe->>'description',
                    'STOCKPIT AI',
                    v_recipe->>'image_url',
                    case when v_recipe->>'prep_time_minutes' ~ '^[0-9]+$' then (v_recipe->>'prep_time_minutes')::integer else null end,
                    case when v_recipe->>'cook_time_minutes' ~ '^[0-9]+$' then (v_recipe->>'cook_time_minutes')::integer else null end,
                    case when v_recipe->>'total_time_minutes' ~ '^[0-9]+$' then (v_recipe->>'total_time_minutes')::integer else 30 end,
                    v_recipe->>'difficulty',
                    case when v_recipe->>'servings' ~ '^[0-9]+$' then (v_recipe->>'servings')::integer else null end,
                    coalesce(v_recipe->'ingredients', '[]'::jsonb),
                    coalesce(v_recipe->'instructions', '[]'::jsonb),
                    v_recipe->'nutrition',
                    case 
                        when jsonb_typeof(v_recipe->'tags') = 'array' 
                        then ARRAY(SELECT jsonb_array_elements_text(v_recipe->'tags'))
                        else ARRAY[]::text[]
                    end,
                    v_recipe->>'category',
                    'menu_item',
                    new.id,
                    jsonb_build_object(
                        'menu_plan_id', new.id,
                        'menu_plan_title', new.title,
                        'day', v_menu_item->>'day',
                        'meal_type', v_menu_item->>'meal_type',
                        'season', new.season
                    )
                );

                perform auto_save_to_saved_recipes(
                    new.user_id,
                    v_recipe_name,
                    v_payload
                );
            end if;
        end loop;
    end if;

    return new;
end;
$$;

-- Trigger function for ai_chat_recipes (already exists but ensure it works)
create or replace function auto_save_ai_chat_recipe()
returns trigger
language plpgsql
security definer
as $$
declare
    v_payload jsonb;
begin
    v_payload := create_recipe_payload(
        new.id,
        new.title,
        new.description,
        'STOCKPIT AI',
        new.image_url,
        new.prep_time_minutes,
        new.cook_time_minutes,
        new.total_time_minutes,
        new.difficulty,
        new.servings,
        new.ingredients,
        new.instructions,
        new.nutrition,
        new.tags,
        new.category,
        'ai_chat',
        null,
        jsonb_build_object(
            'original_message', new.original_message,
            'chat_timestamp', new.chat_timestamp
        )
    );

    perform auto_save_to_saved_recipes(
        new.user_id,
        new.title,
        v_payload
    );

    return new;
end;
$$;

-- Create triggers
drop trigger if exists trigger_auto_save_recipe_variation on public.recipe_variations;
create trigger trigger_auto_save_recipe_variation
    after insert or update on public.recipe_variations
    for each row
    execute function auto_save_recipe_variation();

drop trigger if exists trigger_auto_save_experimental_recipe on public.experimental_recipes;
create trigger trigger_auto_save_experimental_recipe
    after insert or update on public.experimental_recipes
    for each row
    execute function auto_save_experimental_recipe();

drop trigger if exists trigger_auto_save_menu_plan_recipes on public.menu_plans;
create trigger trigger_auto_save_menu_plan_recipes
    after insert or update on public.menu_plans
    for each row
    execute function auto_save_menu_plan_recipes();

drop trigger if exists trigger_auto_save_ai_chat_recipe on public.ai_chat_recipes;
create trigger trigger_auto_save_ai_chat_recipe
    after insert or update on public.ai_chat_recipes
    for each row
    execute function auto_save_ai_chat_recipe();

-- Also handle updates - if recipe is updated, update saved_recipes too
-- This is already handled by the triggers above (they fire on UPDATE too)

-- Comments
comment on function create_recipe_payload is 'Creates a standardized recipe_payload JSONB object for saved_recipes';
comment on function auto_save_to_saved_recipes is 'Automatically saves or updates a recipe in saved_recipes';
comment on function auto_save_recipe_variation is 'Trigger function: auto-saves recipe variations to saved_recipes';
comment on function auto_save_experimental_recipe is 'Trigger function: auto-saves experimental recipes to saved_recipes';
comment on function auto_save_menu_plan_recipes is 'Trigger function: auto-saves menu plan recipes to saved_recipes';
comment on function auto_save_ai_chat_recipe is 'Trigger function: auto-saves AI chat recipes to saved_recipes';

