import type { Database, Json } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type InventoryRecord = Database['public']['Tables']['inventory']['Row'];
export type RecipeCacheRecord = Database['public']['Tables']['recipes_cache']['Row'];
export type ScanSessionRecord = Database['public']['Tables']['scan_sessions']['Row'];

export type Archetype =
  | 'Minimalist'
  | 'Bio-Hacker'
  | 'Flavor Hunter'
  | 'Meal Prepper'
  | 'Family Manager'
  | 'Adventurer';

export interface InventoryItem {
  name: string;
  quantityEstimate: string;
  location?: string;
  daysUntilExpiry?: number;
}

export interface GeneratedRecipe {
  name: string;
  description?: string;
  image_url?: string;
  steps: string[];
  ingredients?: string[];
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    calories?: number;
  };
  missingIngredients?: string[];
  relevanceScore: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  difficulty?: string;
  servings?: number;
  tags?: string[];
}

export interface RecipeEngineInput {
  inventory: InventoryRecord[];
  profile: Profile;
  mood?: string;
}

export interface AIResponseShape extends Json {
  recipes: {
    title: string;
    steps: string[];
    macros: { protein: number; carbs: number; fat: number; calories?: number };
    missing_ingredients: string[];
  }[];
}

