-- Improve daily AI recipe generation
-- Add function to generate fallback recipe when user has no inventory

-- Function to get a fallback recipe based on user profile
create or replace function get_fallback_recipe_for_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
    v_archetype text;
    v_cooking_skill text;
    v_dietary_restrictions text[];
    v_recipe_id uuid;
    v_tags text[];
begin
    -- Get user profile
    select archetype, cooking_skill, dietary_restrictions::text[]
    into v_archetype, v_cooking_skill, v_dietary_restrictions
    from public.profiles
    where id = p_user_id;

    -- Map archetype to tags
    case v_archetype
        when 'Minimalist' then
            v_tags := ARRAY['Budget', 'Comfort Food', 'Quick'];
        when 'Bio-Hacker' then
            v_tags := ARRAY['High Protein', 'Plant-based', 'Healthy'];
        when 'Flavor Hunter' then
            v_tags := ARRAY['Comfort Food', 'Feest', 'Italiaans', 'Aziatisch'];
        when 'Meal Prepper' then
            v_tags := ARRAY['Budget', 'Comfort Food', 'High Protein'];
        when 'Family Manager' then
            v_tags := ARRAY['Comfort Food', 'Budget', 'Quick'];
        else
            v_tags := ARRAY['Comfort Food'];
    end case;

    -- Find a recipe that matches the user's preferences
    select r.id into v_recipe_id
    from public.recipes r
    where (
        -- Match tags
        exists (select 1 from unnest(v_tags) as tag where tag = any(r.tags))
        or r.category = any(v_tags)
    )
    -- Match cooking skill
    and (
        v_cooking_skill = 'Advanced'
        or (v_cooking_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
        or (v_cooking_skill = 'Beginner' and r.difficulty = 'Makkelijk')
        or v_cooking_skill is null
    )
    -- Match dietary restrictions
    and (
        array_length(v_dietary_restrictions, 1) is null
        or array_length(v_dietary_restrictions, 1) = 0
        or not exists (
            select 1 from unnest(v_dietary_restrictions) as restriction
            where restriction = any(r.tags)
        )
    )
    order by random()
    limit 1;

    -- If no match, get any random recipe
    if v_recipe_id is null then
        select id into v_recipe_id
        from public.recipes
        order by random()
        limit 1;
    end if;

    return v_recipe_id;
end;
$$;

grant execute on function get_fallback_recipe_for_user(uuid) to authenticated;

