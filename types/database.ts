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
        };
        Insert: {
          id: string;
          archetype: string;
          dietary_restrictions?: Json;
          cooking_skill?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          archetype?: string;
          dietary_restrictions?: Json;
          cooking_skill?: string | null;
          created_at?: string;
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
    };
  };
}

