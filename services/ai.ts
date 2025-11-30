import Constants from 'expo-constants';
import OpenAI from 'openai';

import type { InventoryItem, RecipeEngineInput, GeneratedRecipe } from '../types/app';

// Helper function to get environment variables (works for both local and Vercel)
const getEnvVar = (key: string): string | undefined => {
  // Check Constants.extra (build-time, from app.config.js)
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key] as string;
  }
  // Check process.env (build-time and runtime)
  if (typeof process !== 'undefined' && process.env[key]) {
    return process.env[key];
  }
  // Check window.__EXPO_ENV__ (runtime, for Vercel)
  if (typeof window !== 'undefined' && (window as any).__EXPO_ENV__?.[key]) {
    return (window as any).__EXPO_ENV__[key];
  }
  // Check window.location for Vercel environment variables injected at runtime
  if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.[key]) {
    return (window as any).__NEXT_DATA__.env[key];
  }
  return undefined;
};

const OPENAI_KEY = 
  getEnvVar('openaiKey') || 
  getEnvVar('EXPO_PUBLIC_OPENAI_KEY') ||
  getEnvVar('OPENAI_KEY');
  
const OPENROUTER_KEY = 
  getEnvVar('openrouterKey') || 
  getEnvVar('EXPO_PUBLIC_OPENROUTER_KEY') ||
  getEnvVar('OPENROUTER_KEY');

// Only initialize OpenAI client if key is available
// Note: dangerouslyAllowBrowser is needed for web/PWA usage
// This is safe because we're using public API keys that are meant for client-side use
const client = OPENAI_KEY ? new OpenAI({
  apiKey: OPENAI_KEY,
  dangerouslyAllowBrowser: true,
}) : null;

// OpenRouter client for free LLM access
// Note: dangerouslyAllowBrowser is needed for web/PWA usage
// OpenRouter keys are designed for client-side use
const openRouterClient = OPENROUTER_KEY ? new OpenAI({
  apiKey: OPENROUTER_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': 'https://stockpit.app',
    'X-Title': 'STOCKPIT',
  },
}) : null;

const VISION_MODEL = 'gpt-4o';
const RECIPE_MODEL = 'gpt-4o-mini';
// Free model from OpenRouter - Grok 4.1 Fast (free tier)
const FREE_LLM_MODEL = 'x-ai/grok-4.1-fast:free';

// Curated list of high-quality food images from Unsplash
// These are direct image URLs that always work
const FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1506354666786-959d6d497f1a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
];

/**
 * Generate a reliable image URL for a recipe
 * Uses a deterministic approach based on recipe name to always return the same image for the same recipe
 * Falls back to a curated list of high-quality food images
 */
export function generateRecipeImageUrl(recipeName: string, seed?: number): string {
  if (!recipeName) {
    return FOOD_IMAGES[0];
  }

  // Create a simple hash from the recipe name for deterministic selection
  let hash = 0;
  const name = recipeName.toLowerCase().trim();
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use seed if provided, otherwise use hash
  const index = seed !== undefined ? seed : Math.abs(hash);
  
  // Select image from curated list
  return FOOD_IMAGES[index % FOOD_IMAGES.length];
}

export async function runInventoryScan(photoUris: string[]): Promise<InventoryItem[]> {
  if (!photoUris.length) {
    return [];
  }

  if (!client) {
    console.warn('OpenAI client not initialized. Please set EXPO_PUBLIC_OPENAI_KEY or use OpenRouter.');
    return [];
  }

  const response = await client.responses.create({
    model: VISION_MODEL,
    input: [
      {
        role: 'system',
        content:
          'You are an expert inventory auditor. Analyze sequential kitchen photos, deduplicate items, and estimate quantities.',
      },
      ...photoUris.map((uri) => ({
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this frame and add to the shared inventory context.' },
          { type: 'input_image', image_url: uri },
        ],
      })),
      {
        role: 'system',
        content:
          'Return JSON with fields: item_name, quantity_estimate, location_in_fridge, days_until_expiry.',
      },
    ],
    response_format: { type: 'json_object' },
  });

  const payload = JSON.parse(response.output[0].content[0].text ?? '{"items": []}');
  return (payload.items ?? []).map(
    (item: any): InventoryItem => ({
      name: item.item_name,
      quantityEstimate: item.quantity_estimate,
      location: item.location_in_fridge,
      daysUntilExpiry: item.days_until_expiry,
    })
  );
}

export interface ShelfPhotoAnalysisResult {
  item_name: string;
  quantity_estimate?: string;
  confidence_score: number;
  brand?: string;
  category?: string;
}

/**
 * Analyze a shelf photo and detect products with high confidence
 * This is optimized for shelf photos and tries to identify specific products
 */
export async function analyzeShelfPhoto(photoUri: string): Promise<ShelfPhotoAnalysisResult[]> {
  if (!photoUri) {
    return [];
  }

  if (!client) {
    console.warn('OpenAI client not initialized. Please set EXPO_PUBLIC_OPENAI_KEY or use OpenRouter.');
    return [];
  }

  try {
    const response = await client.responses.create({
      model: VISION_MODEL,
      input: [
        {
          role: 'system',
          content:
            'You are an expert product recognition system. Analyze shelf photos and identify specific products with brand names, product names, and quantities. Focus on food products and household items. Return detailed product information that can be matched to a product catalog.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this shelf photo and identify all visible products. For each product, provide: item_name (full product name including brand if visible), quantity_estimate (e.g., "500g", "1 liter", "2 stuks"), confidence_score (0-100), brand (if visible), and category (e.g., "dairy", "pantry", "beverages", "frozen"). Return as JSON array.',
            },
            { type: 'input_image', image_url: photoUri },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const payload = JSON.parse(response.output[0].content[0].text ?? '{"items": []}');
    return (payload.items ?? []).map((item: any): ShelfPhotoAnalysisResult => ({
      item_name: item.item_name || item.name || '',
      quantity_estimate: item.quantity_estimate || item.quantity,
      confidence_score: item.confidence_score || item.confidence || 0,
      brand: item.brand,
      category: item.category,
    })).filter((item: ShelfPhotoAnalysisResult) => item.item_name && item.confidence_score > 50);
  } catch (error) {
    console.error('Error analyzing shelf photo:', error);
    return [];
  }
}

export async function generateRecipes({
  inventory,
  profile,
  mood,
}: RecipeEngineInput): Promise<GeneratedRecipe[]> {
  // Use OpenRouter if available, otherwise fall back to OpenAI
  const activeClient = openRouterClient || client;
  
  if (!activeClient) {
    console.warn('No AI client available. Please set EXPO_PUBLIC_OPENAI_KEY or EXPO_PUBLIC_OPENROUTER_KEY');
    return [];
  }

  const model = openRouterClient ? FREE_LLM_MODEL : RECIPE_MODEL;

  const response = await activeClient.chat.completions.create({
    model: model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Generate structured recipes that maximize pantry usage. Return JSON { recipes: Recipe[] }.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              inventory,
              archetype: profile.archetype,
              mood: mood ?? 'neutral',
            }),
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content || '{"recipes": []}';
  const payload = JSON.parse(content);

  return (payload.recipes ?? []).map((recipe: any) => {
    const inventoryHits = recipe.ingredients.filter((ingredient: any) =>
      inventory.some((item) => item.name.toLowerCase() === String(ingredient).toLowerCase())
    ).length;

    const archetypeMatch = recipe.tags?.includes(profile.archetype) ?? false;
    const moodMatch = mood ? recipe.tags?.includes(mood) ?? false : false;

    const relevanceScore =
      inventoryHits * 5 + (archetypeMatch ? 20 : -10) + (moodMatch ? 15 : 0);

    return {
      name: recipe.title,
      steps: recipe.steps ?? [],
      macros: recipe.macros ?? { protein: 0, carbs: 0, fat: 0 },
      missingIngredients: recipe.missing_ingredients ?? [],
      relevanceScore,
    } as GeneratedRecipe;
  });
}

// Generate recipes using free LLM (OpenRouter)
export async function generateRecipesWithAI(
  inventory: Array<{ name: string; quantity_approx?: string; expires_at?: string; category?: string }>,
  profile: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] },
  mood?: string
): Promise<GeneratedRecipe[]> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured, falling back to database recipes');
    return [];
  }

  const inventoryList = inventory.map(item => 
    `${item.name}${item.quantity_approx ? ` (${item.quantity_approx})` : ''}${item.expires_at ? ` - vervalt: ${new Date(item.expires_at).toLocaleDateString('nl-NL')}` : ''}`
  ).join('\n');

  const prompt = `Je bent een professionele chef en receptengenerator voor STOCKPIT, een slimme keuken app.

Gebruikersinventaris:
${inventoryList || 'Geen items in voorraad'}

Gebruikersprofiel:
- Archetype: ${profile.archetype || 'Niet gespecificeerd'}
- Kookniveau: ${profile.cooking_skill || 'Niet gespecificeerd'}
- Dieetbeperkingen: ${profile.dietary_restrictions?.join(', ') || 'Geen'}

Mood: ${mood || 'neutraal'}

Genereer 3-5 originele, praktische recepten die:
1. Zoveel mogelijk gebruik maken van de beschikbare ingrediënten
2. Passen bij het kookniveau en archetype van de gebruiker
3. Rekening houden met dieetbeperkingen
4. Passen bij de gekozen mood
5. Realistisch en uitvoerbaar zijn

Geef voor elk recept:
- Titel (Nederlands)
- Korte beschrijving (1-2 zinnen)
- Ingrediëntenlijst (met hoeveelheden)
- Stap-voor-stap instructies (genummerd)
- Bereidingstijd in minuten
- Moeilijkheidsgraad (Makkelijk, Gemiddeld, Moeilijk)
- Aantal porties
- Voedingswaarden (eiwitten, koolhydraten, vetten in gram per portie)

Antwoord in JSON formaat:
{
  "recipes": [
    {
      "title": "Recept naam",
      "description": "Korte beschrijving",
      "ingredients": ["ingrediënt 1", "ingrediënt 2"],
      "instructions": ["Stap 1", "Stap 2"],
      "prep_time_minutes": 15,
      "cook_time_minutes": 20,
      "total_time_minutes": 35,
      "difficulty": "Makkelijk",
      "servings": 4,
      "nutrition": {
        "protein": 25,
        "carbs": 40,
        "fat": 15
      },
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

  try {
    // Use direct fetch for Grok 4.1 free model
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een professionele chef en receptengenerator. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error for recipe generation:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{"recipes": []}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const payload = jsonMatch ? JSON.parse(jsonMatch[0]) : { recipes: [] };

    return (payload.recipes ?? []).map((recipe: any) => {
      const inventoryHits = (recipe.ingredients || []).filter((ingredient: string) =>
        inventory.some((item) => 
          item.name.toLowerCase().includes(ingredient.toLowerCase()) ||
          ingredient.toLowerCase().includes(item.name.toLowerCase())
        )
      ).length;

      const archetypeMatch = (recipe.tags || []).includes(profile.archetype) ?? false;
      const moodMatch = mood ? (recipe.tags || []).includes(mood) ?? false : false;

      const relevanceScore =
        inventoryHits * 5 + (archetypeMatch ? 20 : -10) + (moodMatch ? 15 : 0);

      // Generate reliable image URL based on recipe title
      const imageUrl = generateRecipeImageUrl(recipe.title);

      return {
        name: recipe.title,
        description: recipe.description,
        image_url: imageUrl,
        ingredients: recipe.ingredients || [],
        steps: recipe.instructions || [],
        prepTime: recipe.prep_time_minutes || 0,
        cookTime: recipe.cook_time_minutes || 0,
        totalTime: recipe.total_time_minutes || 30,
        difficulty: recipe.difficulty || 'Gemiddeld',
        servings: recipe.servings || 4,
        macros: recipe.nutrition || { protein: 0, carbs: 0, fat: 0 },
        missingIngredients: [],
        relevanceScore,
        tags: recipe.tags || [],
      } as GeneratedRecipe;
    });
  } catch (error) {
    console.error('Error generating recipes with AI:', error);
    return [];
  }
}

// Generate a single recipe from description with AI assistance
export async function generateRecipeFromDescription(
  description: string,
  category?: string
): Promise<GeneratedRecipe | null> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return null;
  }

  const prompt = `Je bent een professionele chef en receptengenerator voor STOCKPIT.

De gebruiker beschrijft een recept: "${description}"
${category ? `Categorie: ${category}` : ''}

Genereer een compleet recept in JSON formaat:
{
  "title": "Recept naam (Nederlands)",
  "description": "Korte beschrijving (1-2 zinnen)",
  "ingredients": [
    {"name": "ingrediënt 1", "quantity": "hoeveelheid", "unit": "eenheid"},
    {"name": "ingrediënt 2", "quantity": "hoeveelheid", "unit": "eenheid"}
  ],
  "instructions": [
    {"step": 1, "instruction": "Stap 1 beschrijving"},
    {"step": 2, "instruction": "Stap 2 beschrijving"}
  ],
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "total_time_minutes": 35,
  "difficulty": "Makkelijk",
  "servings": 4,
  "nutrition": {
    "protein": 25,
    "carbs": 40,
    "fat": 15
  },
  "tags": ["tag1", "tag2"]
}

Antwoord ALLEEN met geldig JSON, geen andere tekst.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een professionele chef. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for recipe generation:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const recipeData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!recipeData) return null;

    // Generate reliable image URL
    const imageUrl = generateRecipeImageUrl(recipeData.title || 'recipe');

    const normalizedIngredients = (recipeData.ingredients || []).map((ing: any) => {
      if (typeof ing === 'string') {
        return { name: ing, quantity: '', unit: '' };
      }
      return {
        name: ing.name || '',
        quantity: ing.quantity || '',
        unit: ing.unit || '',
      };
    });

    const normalizedInstructions = (recipeData.instructions || []).map((step: any, index: number) => {
      if (typeof step === 'string') {
        return { step: index + 1, instruction: step };
      }
      return {
        step: step.step || index + 1,
        instruction: step.instruction || '',
      };
    });

    return {
      name: recipeData.title || 'Nieuw Recept',
      description: recipeData.description || null,
      image_url: imageUrl,
      ingredients: normalizedIngredients,
      steps: normalizedInstructions.map((s: any) => s.instruction),
      prepTime: recipeData.prep_time_minutes || 0,
      cookTime: recipeData.cook_time_minutes || 0,
      totalTime: recipeData.total_time_minutes || 30,
      difficulty: recipeData.difficulty || 'Gemiddeld',
      servings: recipeData.servings || 4,
      macros: recipeData.nutrition || { protein: 0, carbs: 0, fat: 0 },
      tags: recipeData.tags || [],
      missingIngredients: [],
      relevanceScore: 100,
    } as GeneratedRecipe;
  } catch (error) {
    console.error('Error generating recipe from description:', error);
    return null;
  }
}

export async function generateShoppingListFromInventory(
  inventory: Array<{ name: string; quantity_approx?: string; category?: string; expires_at?: string }>,
  focus?: string
): Promise<Array<{ name: string; quantity?: string; reason?: string }>> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return [];
  }

  const inventoryList = inventory
    .map((item) => `${item.name}${item.quantity_approx ? ` (${item.quantity_approx})` : ''}`)
    .join('\n')
    || 'Geen voorraad beschikbaar';

  const prompt = `Je bent de STOCKPIT boodschappenplanner.

Huidige voorraad:
${inventoryList}

Focus of context voor deze lijst: ${focus || 'Algemene weekboodschappen'}

Genereer een boodschappenlijst in JSON:
{
  "items": [
    { "name": "item", "quantity": "hoeveelheid", "reason": "waarom het nodig is" }
  ]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een slimme boodschappenplanner. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for shopping list:', response.status);
      return [];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const listData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!listData?.items || !Array.isArray(listData.items)) {
      return [];
    }

    return listData.items.map((item: any) => ({
      name: item.name || '',
      quantity: item.quantity || '',
      reason: item.reason || '',
    })).filter((item: any) => item.name);
  } catch (error) {
    console.error('Error generating shopping list from description:', error);
    return [];
  }
}

// Generate leftovers recipes using AI
export async function generateLeftoversRecipes(
  inventory: Array<{ name: string; quantity_approx?: string; expires_at?: string; category?: string }>,
  profile: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] },
  count: number = 1
): Promise<GeneratedRecipe[]> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return [];
  }

  // Focus on items expiring soon (within 7 days)
  const expiringItems = inventory.filter(item => {
    if (!item.expires_at) return false;
    const expiryDate = new Date(item.expires_at);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  });

  if (expiringItems.length === 0) {
    return [];
  }

  const inventoryList = expiringItems.map(item => 
    `${item.name}${item.quantity_approx ? ` (${item.quantity_approx})` : ''} - vervalt: ${new Date(item.expires_at!).toLocaleDateString('nl-NL')}`
  ).join('\n');

  const prompt = `Je bent een zero-waste chef expert voor STOCKPIT. De gebruiker heeft restjes die bijna verlopen.

Restjes die gebruikt moeten worden:
${inventoryList}

Gebruikersprofiel:
- Archetype: ${profile.archetype || 'Niet gespecificeerd'}
- Kookniveau: ${profile.cooking_skill || 'Niet gespecificeerd'}
- Dieetbeperkingen: ${profile.dietary_restrictions?.join(', ') || 'Geen'}

Genereer precies ${count} originele, praktische recept${count === 1 ? '' : 'en'} die:
1. Zoveel mogelijk gebruik maken van de restjes die bijna verlopen
2. Zero-waste zijn (geen verspilling)
3. Passen bij het kookniveau en archetype
4. Rekening houden met dieetbeperkingen
5. Realistisch en uitvoerbaar zijn

Geef voor elk recept:
- Titel (Nederlands, focus op zero-waste/restjes)
- Korte beschrijving (1-2 zinnen, benadruk dat het restjes gebruikt)
- Ingrediëntenlijst (met hoeveelheden, focus op restjes)
- Stap-voor-stap instructies (genummerd)
- Bereidingstijd in minuten
- Moeilijkheidsgraad (Makkelijk, Gemiddeld, Moeilijk)
- Aantal porties
- Voedingswaarden (eiwitten, koolhydraten, vetten in gram per portie)

Antwoord in JSON formaat:
{
  "recipes": [
    {
      "title": "Recept naam (met restjes focus)",
      "description": "Korte beschrijving die benadrukt dat het restjes gebruikt",
      "ingredients": [
        {"name": "restje ingrediënt", "quantity": "hoeveelheid", "unit": "eenheid"},
        {"name": "ander ingrediënt", "quantity": "hoeveelheid", "unit": "eenheid"}
      ],
      "instructions": ["Stap 1", "Stap 2"],
      "prep_time_minutes": 15,
      "cook_time_minutes": 20,
      "total_time_minutes": 35,
      "difficulty": "Makkelijk",
      "servings": 4,
      "nutrition": {
        "protein": 25,
        "carbs": 40,
        "fat": 15
      },
      "tags": ["Zero-Waste", "Restjes", "tag2"]
    }
  ]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een zero-waste chef expert. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8, // Slightly higher for creativity
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for leftovers recipes:', response.status);
      return [];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{"recipes": []}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const payload = jsonMatch ? JSON.parse(jsonMatch[0]) : { recipes: [] };

    return (payload.recipes ?? []).map((recipe: any) => {
      const inventoryHits = (recipe.ingredients || []).filter((ingredient: any) =>
        expiringItems.some((item) => 
          item.name.toLowerCase().includes((ingredient.name || ingredient).toLowerCase()) ||
          (ingredient.name || ingredient).toLowerCase().includes(item.name.toLowerCase())
        )
      ).length;

      const imageUrl = generateRecipeImageUrl(recipe.title);

      return {
        name: recipe.title,
        description: recipe.description,
        image_url: imageUrl,
        ingredients: (recipe.ingredients || []).map((ing: any) => 
          typeof ing === 'string' 
            ? { name: ing, quantity: '', unit: '' }
            : { name: ing.name || '', quantity: ing.quantity || '', unit: ing.unit || '' }
        ),
        steps: recipe.instructions || [],
        prepTime: recipe.prep_time_minutes || 0,
        cookTime: recipe.cook_time_minutes || 0,
        totalTime: recipe.total_time_minutes || 30,
        difficulty: recipe.difficulty || 'Gemiddeld',
        servings: recipe.servings || 4,
        macros: recipe.nutrition || { protein: 0, carbs: 0, fat: 0 },
        missingIngredients: [],
        relevanceScore: inventoryHits * 20, // Higher score for leftovers recipes
        tags: recipe.tags || ['Zero-Waste', 'Restjes'],
      } as GeneratedRecipe;
    });
  } catch (error) {
    console.error('Error generating leftovers recipes:', error);
    return [];
  }
}

// Chat with AI assistant about inventory and recipes
export async function chatWithAI(
  message: string,
  context: {
    inventory?: Array<{ name: string; quantity_approx?: string; expires_at?: string; category?: string }>;
    profile?: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] };
    recentRecipes?: Array<{ title: string; total_time_minutes: number }>;
  }
): Promise<string> {
  if (!OPENROUTER_KEY) {
    return 'AI-assistentie is momenteel niet beschikbaar. Controleer je OpenRouter API key in .env.local';
  }

  const inventoryList = context.inventory?.map(item => 
    `${item.name}${item.quantity_approx ? ` (${item.quantity_approx})` : ''}${item.expires_at ? ` - vervalt: ${new Date(item.expires_at).toLocaleDateString('nl-NL')}` : ''}`
  ).join('\n') || 'Geen items in voorraad';

  const systemPrompt = `Je bent STOCKPIT, een vriendelijke en behulpzame AI-keukenassistent. Je helpt gebruikers met:
- Recepten vinden op basis van hun voorraad
- Kooktips en technieken
- Voedselveiligheid en houdbaarheid
- Dieetadvies en voedingsinformatie
- Kookplanning en meal prep

Huidige voorraad van de gebruiker:
${inventoryList}

Gebruikersprofiel:
- Archetype: ${context.profile?.archetype || 'Niet gespecificeerd'}
- Kookniveau: ${context.profile?.cooking_skill || 'Niet gespecificeerd'}
- Dieetbeperkingen: ${context.profile?.dietary_restrictions?.join(', ') || 'Geen'}

BELANGRIJK: 
- Antwoord altijd in het Nederlands
- Gebruik GEEN markdown formatting (geen ###, ####, **, etc.)
- Gebruik gewone tekst met duidelijke paragrafen
- Gebruik nummering (1., 2., 3.) voor lijsten in plaats van markdown
- Wees vriendelijk, professioneel en praktisch
- Houd antwoorden beknopt maar informatief
- Gebruik lege regels tussen paragrafen voor leesbaarheid`;

  try {
    console.log('Sending message to OpenRouter (Grok 4.1 free):', message.substring(0, 50) + '...');
    
    // Use direct fetch for Grok 4.1 free model
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      if (response.status === 401) {
        return 'API key is ongeldig. Controleer je OpenRouter API key in .env.local';
      }
      if (response.status === 402) {
        return 'Onvoldoende credits. Zorg ervoor dat je een gratis account hebt en dat je de juiste gratis model gebruikt (x-ai/grok-4.1-fast:free). Check https://openrouter.ai/settings/credits';
      }
      if (response.status === 429) {
        return 'Te veel verzoeken. Wacht even en probeer het later opnieuw.';
      }
      
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      console.warn('No content in OpenRouter response:', result);
      return 'Sorry, ik kon geen antwoord genereren. Probeer het opnieuw.';
    }

    // Clean up markdown formatting
    content = content
      // Remove markdown headers (###, ####, etc.)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markdown (**text** -> text, *text* -> text)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Remove markdown links ([text](url) -> text)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Clean up multiple newlines (max 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();

    console.log('Received response from OpenRouter:', content.substring(0, 100) + '...');
    return content;
  } catch (error: any) {
    console.error('Error chatting with AI:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    
    // Provide more specific error messages
    if (error?.message?.includes('401')) {
      return 'API key is ongeldig. Controleer je OpenRouter API key in .env.local';
    }
    if (error?.message?.includes('402')) {
      return 'Onvoldoende credits. Zorg ervoor dat je een gratis account hebt en dat je de juiste gratis model gebruikt (x-ai/grok-4.1-fast:free).';
    }
    if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
      return 'Rate limit bereikt. Wacht even en probeer het later opnieuw.';
    }
    
    return `Er is een fout opgetreden: ${error?.message || 'Onbekende fout'}. Controleer de console voor meer details.`;
  }
}

/**
 * Improve voice transcription with AI
 * Takes a raw transcription and improves it for better parsing
 */
export async function transcribeVoiceCommand(rawTranscript: string): Promise<string> {
  if (!rawTranscript || rawTranscript.trim().length === 0) {
    return rawTranscript;
  }

  if (!OPENROUTER_KEY) {
    // If no AI available, return original
    return rawTranscript;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het verbeteren van spraaktranscripties voor Nederlandse commando\'s. Corrigeer spelfouten, voeg ontbrekende woorden toe, en zorg dat het commando duidelijk is. Antwoord alleen met de verbeterde transcriptie, zonder extra uitleg.',
          },
          {
            role: 'user',
            content: `Verbeter deze spraaktranscriptie voor een voorraadbeheer commando: "${rawTranscript}"`,
          },
        ],
        temperature: 0.3, // Lower temperature for more accurate corrections
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return rawTranscript; // Return original on error
    }

    const result = await response.json();
    const improved = result.choices?.[0]?.message?.content?.trim();
    
    return improved || rawTranscript;
  } catch (error) {
    console.error('Error improving transcription:', error);
    return rawTranscript; // Return original on error
  }
}

/**
 * Parse voice command with AI to extract inventory items
 * Returns array of items with name and quantity
 */
export async function parseVoiceCommandWithAI(command: string): Promise<Array<{ name: string; quantity?: string }>> {
  if (!command || command.trim().length === 0) {
    return [];
  }

  if (!OPENROUTER_KEY) {
    return [];
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het parsen van Nederlandse spraakcommando\'s voor voorraadbeheer. Extracteer alle items en hoeveelheden uit het commando. Antwoord ALLEEN met geldig JSON, geen andere tekst.',
          },
          {
            role: 'user',
            content: `Parseer dit commando en extracteer alle items met hoeveelheden: "${command}"

Antwoord in dit JSON formaat:
{
  "items": [
    {"name": "item naam", "quantity": "hoeveelheid"},
    {"name": "ander item", "quantity": "hoeveelheid"}
  ]
}

Voorbeelden:
- "voeg een banaan toe" -> {"items": [{"name": "banaan", "quantity": "1"}]}
- "twee uien en één kilo rijst" -> {"items": [{"name": "ui", "quantity": "2"}, {"name": "rijst", "quantity": "1 kg"}]}
- "drie appels" -> {"items": [{"name": "appel", "quantity": "3"}]}`,
          },
        ],
        temperature: 0.2, // Low temperature for consistent parsing
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    return parsed.items || [];
  } catch (error) {
    console.error('Error parsing voice command with AI:', error);
    return [];
  }
}

// Admin AI Assistant - Advanced AI with database access
export interface AdminAIContext {
  databaseStats?: {
    totalUsers: number;
    totalRecipes: number;
    totalInventoryItems: number;
    recentRecipes?: Array<{ id: string; title: string; created_at: string }>;
    recentUsers?: Array<{ id: string; email: string; created_at: string }>;
  };
  availableFunctions?: string[];
}

export interface AdminAIResponse {
  message: string;
  action?: {
    type: 'create_recipe' | 'update_recipe' | 'delete_recipe' | 'query_database' | 'analyze_recipe' | 'improve_recipe';
    data?: any;
  };
  suggestions?: string[];
}

export async function chatWithAdminAI(
  message: string,
  context: AdminAIContext
): Promise<AdminAIResponse> {
  if (!OPENROUTER_KEY) {
    return {
      message: 'AI-assistentie is momenteel niet beschikbaar. Controleer je OpenRouter API key.',
    };
  }

  const stats = context.databaseStats || {};
  const recentRecipes = stats.recentRecipes?.slice(0, 10) || [];
  const recentUsers = stats.recentUsers?.slice(0, 10) || [];

  const systemPrompt = `Je bent STOCKPIT Admin AI, een geavanceerde AI-assistent met volledige database toegang voor het beheren van het STOCKPIT platform.

JE ROL:
- Je helpt de admin met het beheren van het platform
- Je kunt recepten toevoegen, bewerken en verwijderen
- Je kunt database queries uitvoeren (veilig)
- Je kunt recepten analyseren en verbeteren
- Je traint jezelf om betere recepten te genereren op basis van feedback

BESCHIKBARE FUNCTIES:
- admin_create_recipe: Maak een nieuw recept aan
- admin_update_recipe: Update een bestaand recept
- admin_delete_recipe: Verwijder een recept
- get_admin_stats: Haal statistieken op
- Query database: Voer veilige SELECT queries uit

HUIDIGE DATABASE STATUS:
- Totaal gebruikers: ${stats.totalUsers || 0}
- Totaal recepten: ${stats.totalRecipes || 0}
- Totaal inventory items: ${stats.totalInventoryItems || 0}

RECENTE RECEPTEN:
${recentRecipes.map(r => `- ${r.title} (ID: ${r.id.substring(0, 8)}...)`).join('\n') || 'Geen recente recepten'}

RECENTE GEBRUIKERS:
${recentUsers.map(u => `- ${u.email} (ID: ${u.id.substring(0, 8)}...)`).join('\n') || 'Geen recente gebruikers'}

BELANGRIJK:
- Antwoord altijd in het Nederlands
- Gebruik GEEN markdown formatting (geen ###, **, etc.)
- Als je een actie wilt uitvoeren, geef dan een gestructureerd JSON object terug met:
  {
    "action": "create_recipe" | "update_recipe" | "delete_recipe" | "query_database" | "analyze_recipe" | "improve_recipe",
    "data": { ... relevante data ... }
  }
- Voor recept creatie/update, zorg dat alle velden correct zijn:
  - title (string, Nederlands)
  - description (string, 1-2 zinnen)
  - ingredients (array van {name, quantity, unit})
  - instructions (array van {step, instruction})
  - prep_time_minutes, cook_time_minutes, total_time_minutes (integers)
  - difficulty ("Makkelijk" | "Gemiddeld" | "Moeilijk")
  - servings (integer)
  - tags (array van strings)
  - category (string, optioneel)
- Wees proactief en suggestief
- Analyseer recepten op kwaliteit en geef verbeteringen
- Help met het trainen van betere recept generatie`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT Admin',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        message: `API fout: ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content || 'Geen antwoord ontvangen.';

    // Clean up markdown
    content = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Try to extract action JSON if present
    let action: AdminAIResponse['action'] | undefined;
    const jsonMatch = content.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action) {
          action = parsed;
          // Remove JSON from message
          content = content.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        // JSON parsing failed, ignore
      }
    }

    return {
      message: content,
      action,
    };
  } catch (error: any) {
    console.error('Error in admin AI chat:', error);
    return {
      message: `Er is een fout opgetreden: ${error?.message || 'Onbekende fout'}`,
    };
  }
}

// ============================================================================
// ADVANCED AI FEATURES - Alain.AI-like functionality
// ============================================================================

export interface RecipeVariationOptions {
  variationType: 'local_flavor' | 'trend' | 'seasonal' | 'dietary' | 'allergy' | 'custom';
  localRegion?: string;
  trendName?: string;
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  dietaryType?: string[];
  allergies?: string[];
  customInstructions?: string;
  language?: string;
  unitsSystem?: 'metric' | 'imperial';
}

export interface RecipeVariation extends GeneratedRecipe {
  variationType: string;
  variationDetails: any;
  baseRecipeId?: string;
}

/**
 * Generate recipe variations (like Alain.AI)
 * Adapts existing recipes for local flavors, trends, seasonal ingredients, dietary preferences, allergies
 */
export async function generateRecipeVariation(
  baseRecipe: {
    title: string;
    description?: string;
    ingredients: any[];
    instructions: any[];
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    total_time_minutes?: number;
    difficulty?: string;
    servings?: number;
    nutrition?: any;
    tags?: string[];
    category?: string;
  },
  options: RecipeVariationOptions
): Promise<RecipeVariation | null> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return null;
  }

  const variationPrompt = buildVariationPrompt(baseRecipe, options);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een professionele chef en receptenexpert voor STOCKPIT. Je past recepten aan voor verschillende contexten terwijl je de kern van het recept behoudt. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: variationPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for recipe variation:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const recipeData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!recipeData) return null;

    const imageUrl = generateRecipeImageUrl(recipeData.title || baseRecipe.title);

    return {
      name: recipeData.title || baseRecipe.title,
      description: recipeData.description || baseRecipe.description || null,
      image_url: imageUrl,
      ingredients: (recipeData.ingredients || []).map((ing: any) =>
        typeof ing === 'string'
          ? { name: ing, quantity: '', unit: '' }
          : { name: ing.name || '', quantity: ing.quantity || '', unit: ing.unit || '' }
      ),
      steps: recipeData.instructions || baseRecipe.instructions || [],
      prepTime: recipeData.prep_time_minutes || baseRecipe.prep_time_minutes || 0,
      cookTime: recipeData.cook_time_minutes || baseRecipe.cook_time_minutes || 0,
      totalTime: recipeData.total_time_minutes || baseRecipe.total_time_minutes || 30,
      difficulty: recipeData.difficulty || baseRecipe.difficulty || 'Gemiddeld',
      servings: recipeData.servings || baseRecipe.servings || 4,
      macros: recipeData.nutrition || baseRecipe.nutrition || { protein: 0, carbs: 0, fat: 0 },
      tags: recipeData.tags || baseRecipe.tags || [],
      missingIngredients: [],
      relevanceScore: 100,
      variationType: options.variationType,
      variationDetails: {
        localRegion: options.localRegion,
        trendName: options.trendName,
        season: options.season,
        dietaryType: options.dietaryType,
        allergies: options.allergies,
        customInstructions: options.customInstructions,
        language: options.language || 'nl',
        unitsSystem: options.unitsSystem || 'metric',
      },
    } as RecipeVariation;
  } catch (error) {
    console.error('Error generating recipe variation:', error);
    return null;
  }
}

function buildVariationPrompt(
  baseRecipe: any,
  options: RecipeVariationOptions
): string {
  let prompt = `Pas dit recept aan volgens de volgende specificaties:\n\n`;
  prompt += `Origineel recept: ${baseRecipe.title}\n`;
  if (baseRecipe.description) prompt += `Beschrijving: ${baseRecipe.description}\n`;
  prompt += `Ingrediënten: ${JSON.stringify(baseRecipe.ingredients)}\n`;
  prompt += `Instructies: ${JSON.stringify(baseRecipe.instructions)}\n\n`;

  switch (options.variationType) {
    case 'local_flavor':
      prompt += `Aanpassing: Lokale smaken voor ${options.localRegion || 'België/Nederland'}\n`;
      prompt += `Gebruik lokale ingrediënten en traditionele smaken uit deze regio.\n`;
      break;
    case 'trend':
      prompt += `Aanpassing: Volg de trend "${options.trendName || 'huidige food trends'}"\n`;
      prompt += `Integreer moderne kooktechnieken en populaire ingrediënten.\n`;
      break;
    case 'seasonal':
      prompt += `Aanpassing: Seizoensgebonden ingrediënten voor ${options.season || 'het huidige seizoen'}\n`;
      prompt += `Gebruik verse, seizoensgebonden producten die nu beschikbaar zijn.\n`;
      break;
    case 'dietary':
      prompt += `Aanpassing: Dieetvoorkeuren: ${options.dietaryType?.join(', ') || 'algemeen gezond'}\n`;
      prompt += `Pas het recept aan voor deze dieetvoorkeuren terwijl je de smaak behoudt.\n`;
      break;
    case 'allergy':
      prompt += `Aanpassing: Vermijd allergenen: ${options.allergies?.join(', ') || 'geen'}\n`;
      prompt += `Vervang ingrediënten die deze allergenen bevatten met veilige alternatieven.\n`;
      break;
    case 'custom':
      prompt += `Aanpassing: ${options.customInstructions || 'Aangepaste wijzigingen'}\n`;
      break;
  }

  if (options.language && options.language !== 'nl') {
    prompt += `\nTaal: Vertaal naar ${options.language}.\n`;
  }

  if (options.unitsSystem === 'imperial') {
    prompt += `\nEenheden: Converteer naar imperiale eenheden (cups, ounces, etc.).\n`;
  }

  prompt += `\nGeef het aangepaste recept terug in JSON formaat:
{
  "title": "Aangepaste recept naam",
  "description": "Beschrijving",
  "ingredients": [{"name": "ingrediënt", "quantity": "hoeveelheid", "unit": "eenheid"}],
  "instructions": ["Stap 1", "Stap 2"],
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "total_time_minutes": 35,
  "difficulty": "Makkelijk",
  "servings": 4,
  "nutrition": {"protein": 25, "carbs": 40, "fat": 15},
  "tags": ["tag1", "tag2"]
}`;

  return prompt;
}

/**
 * Menu Maker - Generate seasonal menus (like Alain.AI Menu Maker)
 */
export interface MenuPlanOptions {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  days: number;
  mealsPerDay?: number;
  dietaryRestrictions?: string[];
  cookingSkill?: string;
  budget?: 'low' | 'medium' | 'high';
}

export interface MenuPlan {
  title: string;
  description: string;
  season: string;
  startDate: string;
  endDate: string;
  menuItems: Array<{
    day: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipe: GeneratedRecipe;
  }>;
  ingredientList: Array<{
    name: string;
    quantity: string;
    unit: string;
    category?: string;
  }>;
}

export async function generateMenuPlan(
  inventory: Array<{ name: string; quantity_approx?: string; category?: string }>,
  profile: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] },
  options: MenuPlanOptions
): Promise<MenuPlan | null> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return null;
  }

  const inventoryList = inventory.map(item =>
    `${item.name}${item.quantity_approx ? ` (${item.quantity_approx})` : ''}`
  ).join('\n') || 'Geen items in voorraad';

  const seasonNames: Record<string, string> = {
    spring: 'Lente',
    summer: 'Zomer',
    autumn: 'Herfst',
    winter: 'Winter',
  };

  const prompt = `Je bent de STOCKPIT Menu Maker, een AI die seizoensgebonden menu's maakt.

Gebruikersinventaris:
${inventoryList}

Gebruikersprofiel:
- Archetype: ${profile.archetype || 'Niet gespecificeerd'}
- Kookniveau: ${profile.cooking_skill || options.cookingSkill || 'Niet gespecificeerd'}
- Dieetbeperkingen: ${(options.dietaryRestrictions && options.dietaryRestrictions.length > 0) 
  ? options.dietaryRestrictions.join(', ') 
  : (profile.dietary_restrictions?.join(', ') || 'Geen')}

Menu specificaties:
- Seizoen: ${seasonNames[options.season] || options.season}
- Aantal dagen: ${options.days}
- Maaltijden per dag: ${options.mealsPerDay || 3}
- Budget: ${options.budget || 'medium'}

Genereer een compleet ${options.days}-daags menu voor ${seasonNames[options.season] || options.season} met:
1. Seizoensgebonden ingrediënten
2. Variatie in maaltijden
3. Gebruik van beschikbare voorraad waar mogelijk
4. Rekening houden met dieetbeperkingen
5. Passend bij kookniveau

Voor elke maaltijd: geef een recept met titel, ingrediënten, en korte instructies.

Genereer ook een geaggregeerde boodschappenlijst met alle benodigde ingrediënten.

BELANGRIJK: Antwoord ALLEEN met geldig JSON, zonder extra tekst ervoor of erna. Geen markdown code blocks, alleen pure JSON.

{
  "title": "Menu naam",
  "description": "Beschrijving",
  "menuItems": [
    {
      "day": 1,
      "mealType": "breakfast",
      "recipe": {
        "title": "Recept naam",
        "ingredients": [{"name": "ingrediënt", "quantity": "hoeveelheid", "unit": "eenheid"}],
        "instructions": ["Stap 1", "Stap 2"],
        "prep_time_minutes": 15,
        "total_time_minutes": 20,
        "difficulty": "Makkelijk",
        "servings": 2
      }
    }
  ],
  "ingredientList": [
    {"name": "ingrediënt", "quantity": "totaal", "unit": "eenheid", "category": "categorie"}
  ]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent de STOCKPIT Menu Maker. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error for menu plan:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    
    // Try to extract JSON from the response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try to find JSON in code blocks
      jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || content.match(/```\s*(\{[\s\S]*?\})\s*```/);
    }
    
    if (!jsonMatch) {
      console.error('No JSON found in response:', content.substring(0, 500));
      throw new Error('Geen geldig JSON antwoord ontvangen van AI');
    }
    
    let menuData;
    try {
      menuData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', jsonMatch[0].substring(0, 500));
      throw new Error('Kon AI antwoord niet parsen');
    }

    if (!menuData) {
      throw new Error('Leeg menu data ontvangen');
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + options.days - 1);

    return {
      title: menuData.title || `${seasonNames[options.season] || options.season} Menu`,
      description: menuData.description || '',
      season: options.season,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      menuItems: (menuData.menuItems || []).map((item: any) => ({
        day: item.day || 1,
        mealType: item.mealType || 'dinner',
        recipe: {
          name: item.recipe?.title || '',
          description: item.recipe?.description || null,
          image_url: generateRecipeImageUrl(item.recipe?.title || ''),
          ingredients: (item.recipe?.ingredients || []).map((ing: any) =>
            typeof ing === 'string'
              ? { name: ing, quantity: '', unit: '' }
              : { name: ing.name || '', quantity: ing.quantity || '', unit: ing.unit || '' }
          ),
          steps: item.recipe?.instructions || [],
          prepTime: item.recipe?.prep_time_minutes || 0,
          cookTime: item.recipe?.cook_time_minutes || 0,
          totalTime: item.recipe?.total_time_minutes || 30,
          difficulty: item.recipe?.difficulty || 'Gemiddeld',
          servings: item.recipe?.servings || 2,
          macros: item.recipe?.nutrition || { protein: 0, carbs: 0, fat: 0 },
          tags: item.recipe?.tags || [],
          missingIngredients: [],
          relevanceScore: 100,
        } as GeneratedRecipe,
      })),
      ingredientList: (menuData.ingredientList || []).map((item: any) => ({
        name: item.name || '',
        quantity: item.quantity || '',
        unit: item.unit || '',
        category: item.category || '',
      })),
    };
  } catch (error) {
    console.error('Error generating menu plan:', error);
    return null;
  }
}

/**
 * Experimental Kitchen - Generate new recipes or revive old ones (like Alain.AI Experimental Kitchen)
 */
export interface ExperimentalRecipeOptions {
  sourceType: 'new' | 'revived' | 'variation';
  sourceRecipeId?: string;
  sourceRecipe?: any;
  theme?: string;
  cuisine?: string;
  ingredients?: string[];
  dietaryRestrictions?: string[];
  notes?: string;
}

export async function generateExperimentalRecipe(
  profile: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] },
  options: ExperimentalRecipeOptions
): Promise<GeneratedRecipe | null> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return null;
  }

  let prompt = '';

  if (options.sourceType === 'revived' && options.sourceRecipe) {
    prompt = `Je bent de STOCKPIT Chef's Lab. Herstel en verbeter dit oude/onvoltooide recept:\n\n`;
    prompt += `Origineel recept: ${options.sourceRecipe.title || 'Onbekend'}\n`;
    if (options.sourceRecipe.description) prompt += `Beschrijving: ${options.sourceRecipe.description}\n`;
    if (options.sourceRecipe.ingredients) prompt += `Ingrediënten: ${JSON.stringify(options.sourceRecipe.ingredients)}\n`;
    if (options.sourceRecipe.instructions) prompt += `Instructies: ${JSON.stringify(options.sourceRecipe.instructions)}\n`;
    prompt += `\nMaak dit recept compleet, modern en uitvoerbaar.`;
  } else if (options.sourceType === 'variation' && options.sourceRecipe) {
    prompt = `Je bent de STOCKPIT Chef's Lab. Maak een creatieve variatie op dit recept:\n\n`;
    prompt += `Basis recept: ${options.sourceRecipe.title || 'Onbekend'}\n`;
    if (options.theme) prompt += `Thema: ${options.theme}\n`;
    if (options.cuisine) prompt += `Keuken: ${options.cuisine}\n`;
    prompt += `\nMaak een originele, experimentele variatie die de kern behoudt maar nieuwe smaken toevoegt.`;
  } else {
    prompt = `Je bent de STOCKPIT Chef's Lab. Creëer een volledig nieuw, origineel recept.\n\n`;
    if (options.theme) prompt += `Thema: ${options.theme}\n`;
    if (options.cuisine) prompt += `Keuken: ${options.cuisine}\n`;
    if (options.ingredients && options.ingredients.length > 0) {
      prompt += `Gebruik deze ingrediënten: ${options.ingredients.join(', ')}\n`;
    }
    if (options.notes) prompt += `Notities: ${options.notes}\n`;
  }

  prompt += `\nGebruikersprofiel:
- Archetype: ${profile.archetype || 'Niet gespecificeerd'}
- Kookniveau: ${profile.cooking_skill || 'Niet gespecificeerd'}
- Dieetbeperkingen: ${profile.dietary_restrictions?.join(', ') || 'Geen'}

Genereer een compleet, experimenteel recept in JSON formaat:
{
  "title": "Recept naam",
  "description": "Beschrijving (benadruk het experimentele aspect)",
  "ingredients": [{"name": "ingrediënt", "quantity": "hoeveelheid", "unit": "eenheid"}],
  "instructions": ["Stap 1", "Stap 2"],
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "total_time_minutes": 35,
  "difficulty": "Makkelijk",
  "servings": 4,
  "nutrition": {"protein": 25, "carbs": 40, "fat": 15},
  "tags": ["Experimenteel", "tag2"]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent de STOCKPIT Chef\'s Lab. Wees creatief en innovatief. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9, // Higher temperature for creativity
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for experimental recipe:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const recipeData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!recipeData) return null;

    const imageUrl = generateRecipeImageUrl(recipeData.title || 'experimental recipe');

    return {
      name: recipeData.title || 'Experimenteel Recept',
      description: recipeData.description || null,
      image_url: imageUrl,
      ingredients: (recipeData.ingredients || []).map((ing: any) =>
        typeof ing === 'string'
          ? { name: ing, quantity: '', unit: '' }
          : { name: ing.name || '', quantity: ing.quantity || '', unit: ing.unit || '' }
      ),
      steps: recipeData.instructions || [],
      prepTime: recipeData.prep_time_minutes || 0,
      cookTime: recipeData.cook_time_minutes || 0,
      totalTime: recipeData.total_time_minutes || 30,
      difficulty: recipeData.difficulty || 'Gemiddeld',
      servings: recipeData.servings || 4,
      macros: recipeData.nutrition || { protein: 0, carbs: 0, fat: 0 },
      tags: ['Experimenteel', ...(recipeData.tags || [])],
      missingIngredients: [],
      relevanceScore: 100,
    } as GeneratedRecipe;
  } catch (error) {
    console.error('Error generating experimental recipe:', error);
    return null;
  }
}

/**
 * Translate and localize recipe (like Alain.AI localization)
 */
export async function translateAndLocalizeRecipe(
  recipe: {
    title: string;
    description?: string;
    ingredients: any[];
    instructions: any[];
  },
  targetLanguage: string,
  targetUnits: 'metric' | 'imperial' = 'metric'
): Promise<GeneratedRecipe | null> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return null;
  }

  const languageNames: Record<string, string> = {
    nl: 'Nederlands',
    fr: 'Frans',
    de: 'Duits',
    en: 'Engels',
    es: 'Spaans',
  };

  const prompt = `Vertaal en lokaliseer dit recept:

Origineel recept:
Titel: ${recipe.title}
Beschrijving: ${recipe.description || 'Geen'}
Ingrediënten: ${JSON.stringify(recipe.ingredients)}
Instructies: ${JSON.stringify(recipe.instructions)}

Doel:
- Taal: ${languageNames[targetLanguage] || targetLanguage}
- Eenheden: ${targetUnits === 'imperial' ? 'Imperiaal (cups, ounces, etc.)' : 'Metrisch (gram, liter, etc.)'}

Vertaal alle tekst naar ${languageNames[targetLanguage] || targetLanguage} en converteer eenheden naar ${targetUnits === 'imperial' ? 'imperiale eenheden' : 'metrische eenheden'}.

Antwoord in JSON formaat:
{
  "title": "Vertaalde titel",
  "description": "Vertaalde beschrijving",
  "ingredients": [{"name": "vertaald ingrediënt", "quantity": "geconverteerde hoeveelheid", "unit": "geconverteerde eenheid"}],
  "instructions": ["Vertaalde stap 1", "Vertaalde stap 2"]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het vertalen en lokaliseren van recepten. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for accurate translation
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for translation:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const recipeData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!recipeData) return null;

    return {
      name: recipeData.title || recipe.title,
      description: recipeData.description || recipe.description || null,
      image_url: generateRecipeImageUrl(recipeData.title || recipe.title),
      ingredients: (recipeData.ingredients || []).map((ing: any) =>
        typeof ing === 'string'
          ? { name: ing, quantity: '', unit: '' }
          : { name: ing.name || '', quantity: ing.quantity || '', unit: ing.unit || '' }
      ),
      steps: recipeData.instructions || [],
      prepTime: 0,
      cookTime: 0,
      totalTime: 30,
      difficulty: 'Gemiddeld',
      servings: 4,
      macros: { protein: 0, carbs: 0, fat: 0 },
      tags: [],
      missingIngredients: [],
      relevanceScore: 100,
    } as GeneratedRecipe;
  } catch (error) {
    console.error('Error translating recipe:', error);
    return null;
  }
}

/**
 * Analyze user preferences and generate predictions (like Alain.AI insights)
 */
export interface UserPreferenceAnalysis {
  favoriteCategories: Array<{ category: string; count: number; percentage: number }>;
  favoriteIngredients: Array<{ ingredient: string; count: number }>;
  preferredDifficulty: string;
  averageCookingTime: number;
  dietaryTrends: Array<{ dietary: string; count: number }>;
  seasonalPreferences: Record<string, number>;
  recommendations: string[];
  predictedPreferences: {
    likelyToLike: string[];
    suggestedRecipes: string[];
    trends: string[];
  };
}

export async function analyzeUserPreferences(
  userId: string,
  preferences: Array<{
    recipe_id: string;
    interaction_type: string;
    rating?: number;
    modifications?: any;
    context?: any;
    created_at: string;
  }>,
  allRecipes: Array<{ id: string; title: string; tags?: string[]; category?: string }>
): Promise<UserPreferenceAnalysis | null> {
  if (!OPENROUTER_KEY) {
    console.warn('OpenRouter not configured');
    return null;
  }

  // Aggregate data for analysis
  const categoryCounts: Record<string, number> = {};
  const ingredientCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = {};
  const cookingTimes: number[] = [];
  const dietaryCounts: Record<string, number> = {};
  const seasonalCounts: Record<string, number> = {};
  const likedRecipes: string[] = [];
  const cookedRecipes: string[] = [];

  preferences.forEach((pref) => {
    if (pref.interaction_type === 'like' || (pref.rating && pref.rating >= 4)) {
      likedRecipes.push(pref.recipe_id);
    }
    if (pref.interaction_type === 'cook') {
      cookedRecipes.push(pref.recipe_id);
    }

    // Extract context data
    if (pref.context) {
      if (pref.context.season) {
        seasonalCounts[pref.context.season] = (seasonalCounts[pref.context.season] || 0) + 1;
      }
      if (pref.context.dietary) {
        const dietary = Array.isArray(pref.context.dietary)
          ? pref.context.dietary
          : [pref.context.dietary];
        dietary.forEach((d: string) => {
          dietaryCounts[d] = (dietaryCounts[d] || 0) + 1;
        });
      }
    }
  });

  // Find recipe details for liked/cooked recipes
  const recipeDetails = allRecipes.filter((r) =>
    likedRecipes.includes(r.id) || cookedRecipes.includes(r.id)
  );

  recipeDetails.forEach((recipe) => {
    if (recipe.category) {
      categoryCounts[recipe.category] = (categoryCounts[recipe.category] || 0) + 1;
    }
    if (recipe.tags) {
      recipe.tags.forEach((tag) => {
        if (['Makkelijk', 'Gemiddeld', 'Moeilijk'].includes(tag)) {
          difficultyCounts[tag] = (difficultyCounts[tag] || 0) + 1;
        }
      });
    }
  });

  const totalInteractions = preferences.length;
  const favoriteCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalInteractions > 0 ? (count / totalInteractions) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const favoriteIngredients = Object.entries(ingredientCounts)
    .map(([ingredient, count]) => ({ ingredient, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const preferredDifficulty =
    Object.entries(difficultyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Gemiddeld';

  const averageCookingTime =
    cookingTimes.length > 0
      ? Math.round(cookingTimes.reduce((a, b) => a + b, 0) / cookingTimes.length)
      : 30;

  const dietaryTrends = Object.entries(dietaryCounts)
    .map(([dietary, count]) => ({ dietary, count }))
    .sort((a, b) => b.count - a.count);

  // Use AI to generate recommendations and predictions
  const analysisPrompt = `Analyseer deze gebruikersvoorkeuren en geef voorspellingen:

Gebruikersdata:
- Totaal interacties: ${totalInteractions}
- Favoriete categorieën: ${favoriteCategories.map((c) => `${c.category} (${c.count}x)`).join(', ')}
- Voorkeur moeilijkheidsgraad: ${preferredDifficulty}
- Gemiddelde kooktijd: ${averageCookingTime} minuten
- Dieettrends: ${dietaryTrends.map((d) => `${d.dietary} (${d.count}x)`).join(', ')}
- Seizoensvoorkeuren: ${Object.entries(seasonalCounts)
    .map(([s, c]) => `${s} (${c}x)`)
    .join(', ')}

Geef een analyse en voorspellingen in JSON formaat:
{
  "recommendations": ["Aanbeveling 1", "Aanbeveling 2"],
  "predictedPreferences": {
    "likelyToLike": ["Categorie/ingrediënt gebruiker waarschijnlijk leuk vindt"],
    "suggestedRecipes": ["Type recepten om te proberen"],
    "trends": ["Trends die de gebruiker volgt"]
  }
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://stockpit.app',
        'X-Title': 'STOCKPIT',
      },
      body: JSON.stringify({
        model: FREE_LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Je bent een data-analist voor STOCKPIT. Analyseer gebruikersvoorkeuren en geef voorspellingen. Antwoord altijd in geldig JSON formaat.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error for preference analysis:', response.status);
      // Return basic analysis without AI predictions
      return {
        favoriteCategories,
        favoriteIngredients,
        preferredDifficulty,
        averageCookingTime,
        dietaryTrends,
        seasonalPreferences: seasonalCounts,
        recommendations: [],
        predictedPreferences: {
          likelyToLike: [],
          suggestedRecipes: [],
          trends: [],
        },
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const aiAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      favoriteCategories,
      favoriteIngredients,
      preferredDifficulty,
      averageCookingTime,
      dietaryTrends,
      seasonalPreferences: seasonalCounts,
      recommendations: aiAnalysis.recommendations || [],
      predictedPreferences: {
        likelyToLike: aiAnalysis.predictedPreferences?.likelyToLike || [],
        suggestedRecipes: aiAnalysis.predictedPreferences?.suggestedRecipes || [],
        trends: aiAnalysis.predictedPreferences?.trends || [],
      },
    };
  } catch (error) {
    console.error('Error analyzing user preferences:', error);
    // Return basic analysis without AI predictions
    return {
      favoriteCategories,
      favoriteIngredients,
      preferredDifficulty,
      averageCookingTime,
      dietaryTrends,
      seasonalPreferences: seasonalCounts,
      recommendations: [],
      predictedPreferences: {
        likelyToLike: [],
        suggestedRecipes: [],
        trends: [],
      },
    };
  }
}

