-- Recipe Imports Table
-- Tracks imported recipes from external sources via Web Share Target API

-- Create table to track recipe imports (optional, for analytics)
CREATE TABLE IF NOT EXISTS recipe_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  source_url TEXT,
  source_text TEXT,
  import_method TEXT DEFAULT 'share_target', -- 'share_target', 'manual', etc.
  parsed_successfully BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recipe_imports_user_id ON recipe_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_imports_recipe_id ON recipe_imports(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_imports_created_at ON recipe_imports(created_at DESC);

-- Enable RLS
ALTER TABLE recipe_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own recipe imports"
  ON recipe_imports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipe imports"
  ON recipe_imports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipe imports"
  ON recipe_imports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON recipe_imports TO authenticated;

-- Add comment
COMMENT ON TABLE recipe_imports IS 'Tracks recipe imports from external sources via Web Share Target API';

