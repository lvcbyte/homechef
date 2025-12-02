-- Contextual Recipes Function
-- Filters recipes based on time of day and weather conditions

-- Function to get contextual recipes based on time and weather
CREATE OR REPLACE FUNCTION get_contextual_recipes(
  p_time_of_day TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
  p_weather_condition TEXT, -- 'rain', 'sunny', 'warm', 'cold'
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  recipe_id UUID,
  title TEXT,
  description TEXT,
  author TEXT,
  image_url TEXT,
  total_time_minutes INTEGER,
  difficulty TEXT,
  servings INTEGER,
  likes_count BIGINT,
  category TEXT,
  tags TEXT[],
  match_reason TEXT
) AS $$
DECLARE
  v_categories TEXT[];
  v_tags TEXT[];
BEGIN
  -- Determine categories and tags based on context
  v_categories := ARRAY[]::TEXT[];
  v_tags := ARRAY[]::TEXT[];
  
  -- Time-based filtering
  IF p_time_of_day = 'breakfast' THEN
    v_categories := v_categories || ARRAY['Ontbijt', 'Breakfast'];
    v_tags := v_tags || ARRAY['ontbijt', 'breakfast', 'ochtend'];
  ELSIF p_time_of_day = 'lunch' THEN
    v_categories := v_categories || ARRAY['Lunch', 'Middageten'];
    v_tags := v_tags || ARRAY['lunch', 'middageten'];
  ELSIF p_time_of_day = 'dinner' THEN
    v_categories := v_categories || ARRAY['Diner', 'Avondeten'];
    v_tags := v_tags || ARRAY['diner', 'avondeten', 'dinner'];
  END IF;
  
  -- Weather-based filtering
  IF p_weather_condition = 'rain' AND p_time_of_day = 'dinner' THEN
    -- Rain + evening = Comfort Food
    v_categories := v_categories || ARRAY['Comfort Food', 'Stoofpot', 'Soep'];
    v_tags := v_tags || ARRAY['comfort', 'warm', 'stevige maaltijd', 'stoofpot', 'comfort food'];
  ELSIF p_weather_condition = 'rain' THEN
    -- Rain (any time) = Comfort Food
    v_categories := v_categories || ARRAY['Comfort Food', 'Soep'];
    v_tags := v_tags || ARRAY['comfort', 'warm', 'comfort food'];
  ELSIF p_weather_condition = 'warm' THEN
    -- Warm weather = Salads and light meals
    v_categories := v_categories || ARRAY['Salade', 'Lichte Maaltijd'];
    v_tags := v_tags || ARRAY['licht', 'fris', 'verfrissend', 'salade', 'light'];
  ELSIF p_weather_condition = 'cold' THEN
    -- Cold weather = Warm meals, Comfort Food, Soup (IMPROVED)
    v_categories := v_categories || ARRAY['Comfort Food', 'Soep', 'Warme Maaltijd', 'Stoofpot', 'Pasta', 'Rijst', 'Ovenschotel'];
    v_tags := v_tags || ARRAY['warm', 'verwarmend', 'soep', 'comfort', 'comfort food', 'stoofpot', 'warme maaltijd', 'pasta', 'rijst', 'ovenschotel', 'oven'];
  END IF;
  
  -- Query recipes matching context
  RETURN QUERY
  SELECT DISTINCT
    r.id AS recipe_id,
    r.title,
    r.description,
    r.author,
    r.image_url,
    r.total_time_minutes,
    r.difficulty,
    r.servings,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM recipe_likes rl
      WHERE rl.recipe_id = r.id
    ), 0) AS likes_count,
    r.category,
    r.tags,
    CASE
      WHEN r.category = ANY(v_categories) THEN 'Categorie match: ' || r.category
      WHEN r.tags && v_tags THEN 'Tag match: ' || array_to_string(r.tags & v_tags, ', ')
      ELSE 'Algemeen'
    END AS match_reason
  FROM recipes r
  WHERE
    -- Match category or tags
    (
      (v_categories IS NOT NULL AND v_categories != ARRAY[]::TEXT[] AND r.category = ANY(v_categories))
      OR
      (v_tags IS NOT NULL AND v_tags != ARRAY[]::TEXT[] AND r.tags && v_tags)
      OR
      (v_categories IS NULL OR v_categories = ARRAY[]::TEXT[]) AND (v_tags IS NULL OR v_tags = ARRAY[]::TEXT[])
    )
    -- Exclude AI-generated recipes for contextual feed (optional)
    AND NOT (r.id::TEXT LIKE 'ai-%' OR r.id::TEXT LIKE 'leftovers-%' OR r.id::TEXT LIKE 'experimental-%')
  ORDER BY
    -- Prioritize exact category matches
    CASE WHEN r.category = ANY(v_categories) THEN 1 ELSE 2 END,
    -- Then by tag matches
    CASE WHEN r.tags && v_tags THEN 1 ELSE 2 END,
    -- Then by popularity
    likes_count DESC,
    -- Then by recency
    r.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_contextual_recipes TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_contextual_recipes IS 'Returns recipes filtered by time of day and weather conditions for contextual recommendations';

