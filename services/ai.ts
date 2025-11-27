import Constants from 'expo-constants';
import OpenAI from 'openai';

import type { InventoryItem, RecipeEngineInput, GeneratedRecipe } from '../types/app';

const OPENAI_KEY =
  Constants.expoConfig?.extra?.openaiKey || process.env.EXPO_PUBLIC_OPENAI_KEY;

const client = new OpenAI({
  apiKey: OPENAI_KEY,
});

const VISION_MODEL = 'gpt-4o';
const RECIPE_MODEL = 'gpt-4o-mini';

export async function runInventoryScan(photoUris: string[]): Promise<InventoryItem[]> {
  if (!photoUris.length) {
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

export async function generateRecipes({
  inventory,
  profile,
  mood,
}: RecipeEngineInput): Promise<GeneratedRecipe[]> {
  const response = await client.responses.create({
    model: RECIPE_MODEL,
    response_format: { type: 'json_object' },
    input: [
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

  const payload = JSON.parse(response.output[0].content[0].text ?? '{"recipes": []}');

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

