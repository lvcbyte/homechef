export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          archetype: string;
          dietary_restrictions: Json;
          cooking_skill: string | null;
          created_at: string;
          avatar_url: string | null;
          is_admin: boolean | null;
          onboarding_completed: boolean | null;
          onboarding_started_at: string | null;
          onboarding_completed_at: string | null;
        };
        Insert: {
          id: string;
          archetype: string;
          dietary_restrictions?: Json;
          cooking_skill?: string | null;
          created_at?: string;
          avatar_url?: string | null;
          is_admin?: boolean | null;
          onboarding_completed?: boolean | null;
          onboarding_started_at?: string | null;
          onboarding_completed_at?: string | null;
        };
        Update: {
          id?: string;
          archetype?: string;
          dietary_restrictions?: Json;
          cooking_skill?: string | null;
          created_at?: string;
          avatar_url?: string | null;
          is_admin?: boolean | null;
          onboarding_completed?: boolean | null;
          onboarding_started_at?: string | null;
          onboarding_completed_at?: string | null;
        };
      };
      inventory: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          quantity_approx: string | null;
          confidence_score: number | null;
          expires_at: string | null;
          created_at: string;
          catalog_product_id: string | null;
          catalog_price: number | null;
          catalog_image_url: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category?: string;
          quantity_approx?: string | null;
          confidence_score?: number | null;
          expires_at?: string | null;
          created_at?: string;
          catalog_product_id?: string | null;
          catalog_price?: number | null;
          catalog_image_url?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          category?: string;
          quantity_approx?: string | null;
          confidence_score?: number | null;
          expires_at?: string | null;
          created_at?: string;
          catalog_product_id?: string | null;
          catalog_price?: number | null;
          catalog_image_url?: string | null;
        };
      };
      product_catalog: {
        Row: {
          id: string;
          product_name: string;
          brand: string | null;
          category: string;
          barcode: string | null;
          description: string | null;
          image_url: string | null;
          unit_size: string | null;
          nutrition: Json | null;
          price: number | null;
          is_available: boolean | null;
          metadata: Json | null;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          product_name: string;
          brand?: string | null;
          category: string;
          barcode?: string | null;
          description?: string | null;
          image_url?: string | null;
          unit_size?: string | null;
          nutrition?: Json | null;
          price?: number | null;
          is_available?: boolean | null;
          metadata?: Json | null;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_name?: string;
          brand?: string | null;
          category?: string;
          barcode?: string | null;
          description?: string | null;
          image_url?: string | null;
          unit_size?: string | null;
          nutrition?: Json | null;
          price?: number | null;
          is_available?: boolean | null;
          metadata?: Json | null;
          source?: string | null;
          updated_at?: string;
        };
      };
      inventory_categories: {
        Row: {
          id: string;
          label: string;
          created_at: string;
        };
        Insert: {
          id: string;
          label: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          created_at?: string;
        };
      };
      recipes_cache: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          ingredients_json: Json;
          steps_json: Json;
          macros: Json;
          relevance_score: number;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          ingredients_json?: Json;
          steps_json?: Json;
          macros?: Json;
          relevance_score?: number;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          ingredients_json?: Json;
          steps_json?: Json;
          macros?: Json;
          relevance_score?: number;
          generated_at?: string;
        };
      };
      scan_sessions: {
        Row: {
          id: string;
          user_id: string;
          photo_urls: string[];
          processed_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          photo_urls?: string[];
          processed_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          photo_urls?: string[];
          processed_status?: string;
          created_at?: string;
        };
      };
      recipes: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          author: string;
          image_url: string | null;
          prep_time_minutes: number;
          cook_time_minutes: number | null;
          total_time_minutes: number;
          difficulty: string;
          servings: number | null;
          ingredients: Json;
          instructions: Json;
          nutrition: Json | null;
          tags: string[];
          category: string | null;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          author?: string;
          image_url?: string | null;
          prep_time_minutes: number;
          cook_time_minutes?: number | null;
          total_time_minutes: number;
          difficulty: string;
          servings?: number | null;
          ingredients?: Json;
          instructions?: Json;
          nutrition?: Json | null;
          tags?: string[];
          category?: string | null;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          author?: string;
          image_url?: string | null;
          prep_time_minutes?: number;
          cook_time_minutes?: number | null;
          total_time_minutes?: number;
          difficulty?: string;
          servings?: number | null;
          ingredients?: Json;
          instructions?: Json;
          nutrition?: Json | null;
          tags?: string[];
          category?: string | null;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipe_categories: {
        Row: {
          id: string;
          recipe_id: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          category?: string;
          created_at?: string;
        };
      };
      recipe_likes: {
        Row: {
          id: string;
          recipe_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      recipe_of_the_day: {
        Row: {
          id: string;
          recipe_id: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          date?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      get_recipe_of_the_day: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      match_recipes_with_inventory: {
        Args: {
          p_user_id: string;
          p_category?: string | null;
          p_max_time_minutes?: number | null;
          p_difficulty?: string | null;
          p_limit?: number;
        };
        Returns: {
          recipe_id: string;
          title: string;
          description: string | null;
          author: string;
          image_url: string | null;
          total_time_minutes: number;
          difficulty: string;
          servings: number | null;
          match_score: number;
          matched_ingredients_count: number;
          total_ingredients_count: number;
          likes_count: number;
        }[];
      };
      get_trending_recipes: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          recipe_id: string;
          title: string;
          description: string | null;
          author: string;
          image_url: string | null;
          total_time_minutes: number;
          difficulty: string;
          servings: number | null;
          likes_count: number;
        }[];
      };
      toggle_recipe_like: {
        Args: {
          p_recipe_id: string;
        };
        Returns: boolean;
      };
      user_has_liked_recipe: {
        Args: {
          p_recipe_id: string;
        };
        Returns: boolean;
      };
      get_recipe_categories: {
        Args: Record<PropertyKey, never>;
        Returns: {
          category: string;
          count: number;
        }[];
      };
    };
  };
}

