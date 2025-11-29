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

      // Generate image URL based on recipe title
      const recipeNameForImage = recipe.title.replace(/\s+/g, ',').toLowerCase();
      const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(recipeNameForImage)},food,recipe,cooking&w=1200&q=80`;

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

    const recipeNameForImage = recipeData.title?.replace(/\s+/g, ',').toLowerCase() || 'recipe';
    const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(recipeNameForImage)},food,recipe,cooking&w=1200&q=80`;

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

