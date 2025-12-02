// Recipe Parser Service
// Parses recipe text from URLs or plain text using regex patterns

export interface ParsedRecipe {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    unit?: string;
  }>;
  instructions: Array<{
    step: number;
    instruction: string;
  }>;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  difficulty?: 'Makkelijk' | 'Gemiddeld' | 'Moeilijk';
  imageUrl?: string;
}

/**
 * Fetch HTML content from URL and extract text
 */
export async function fetchRecipeFromUrl(url: string): Promise<string> {
  try {
    // Use a CORS proxy or fetch directly if same-origin
    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract text content from HTML
    // Remove script and style tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  } catch (error) {
    console.error('[RecipeParser] Error fetching URL:', error);
    throw error;
  }
}

/**
 * Parse recipe from text content
 */
export function parseRecipeFromText(text: string, url?: string): ParsedRecipe {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let title = '';
  let description = '';
  const ingredients: ParsedRecipe['ingredients'] = [];
  const instructions: ParsedRecipe['instructions'] = [];
  let prepTime: number | undefined;
  let cookTime: number | undefined;
  let totalTime: number | undefined;
  let servings: number | undefined;
  let difficulty: 'Makkelijk' | 'Gemiddeld' | 'Moeilijk' | undefined;
  let imageUrl: string | undefined;

  // Try to extract title (usually first line or after "title:" pattern)
  const titleMatch = text.match(/(?:title|recept|naam)[:：]\s*(.+)/i) || 
                     text.match(/^(.{10,80})$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else if (lines.length > 0) {
    title = lines[0];
  } else {
    title = url ? new URL(url).hostname.replace('www.', '') : 'Geïmporteerd Recept';
  }

  // Extract ingredients section
  const ingredientKeywords = ['ingrediënten', 'ingredients', 'benodigdheden', 'wat heb je nodig'];
  const instructionKeywords = ['bereiding', 'instructions', 'instructies', 'hoe maak je', 'stappen', 'methode'];
  
  let inIngredientsSection = false;
  let inInstructionsSection = false;
  let ingredientStartIndex = -1;
  let instructionStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Check for ingredient section
    if (ingredientKeywords.some(keyword => line.includes(keyword))) {
      inIngredientsSection = true;
      inInstructionsSection = false;
      ingredientStartIndex = i + 1;
      continue;
    }
    
    // Check for instruction section
    if (instructionKeywords.some(keyword => line.includes(keyword))) {
      inInstructionsSection = true;
      inIngredientsSection = false;
      instructionStartIndex = i + 1;
      continue;
    }

    // Parse ingredients
    if (inIngredientsSection && ingredientStartIndex >= 0) {
      // Stop at instruction section
      if (instructionKeywords.some(keyword => line.includes(keyword))) {
        inIngredientsSection = false;
        continue;
      }
      
      // Parse ingredient line
      const ingredient = parseIngredientLine(lines[i]);
      if (ingredient) {
        ingredients.push(ingredient);
      }
    }

    // Parse instructions
    if (inInstructionsSection && instructionStartIndex >= 0) {
      // Parse instruction line (remove step numbers)
      const instruction = lines[i].replace(/^\d+[\.\)]\s*/, '').trim();
      if (instruction.length > 0) {
        instructions.push({
          step: instructions.length + 1,
          instruction,
        });
      }
    }
  }

  // If no sections found, try to parse all lines
  if (ingredients.length === 0 && instructions.length === 0) {
    // Try to find ingredients (lines with numbers/quantities)
    for (const line of lines.slice(1)) {
      if (line.match(/^\d+/) || line.match(/\d+\s*(ml|g|kg|st|stuks|eetlepel|theelepel|kopje|cup|tbsp|tsp)/i)) {
        const ingredient = parseIngredientLine(line);
        if (ingredient) {
          ingredients.push(ingredient);
        }
      } else if (line.length > 20 && !line.match(/^[A-Z][^.!?]*[.!?]$/)) {
        // Likely an instruction
        instructions.push({
          step: instructions.length + 1,
          instruction: line,
        });
      }
    }
  }

  // Extract time information
  const timePatterns = [
    { pattern: /(?:prep|voorbereiding|bereidingstijd)[:：]?\s*(\d+)\s*(?:min|minuten|minute)/i, target: 'prep' },
    { pattern: /(?:cook|kooktijd|bakken)[:：]?\s*(\d+)\s*(?:min|minuten|minute)/i, target: 'cook' },
    { pattern: /(?:total|totaal|tijd)[:：]?\s*(\d+)\s*(?:min|minuten|minute)/i, target: 'total' },
    { pattern: /(\d+)\s*(?:min|minuten|minute)\s*(?:prep|voorbereiding)/i, target: 'prep' },
    { pattern: /(\d+)\s*(?:min|minuten|minute)\s*(?:cook|koken|bakken)/i, target: 'cook' },
  ];

  for (const { pattern, target } of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      const minutes = parseInt(match[1], 10);
      if (target === 'prep') prepTime = minutes;
      else if (target === 'cook') cookTime = minutes;
      else if (target === 'total') totalTime = minutes;
    }
  }

  // Extract servings
  const servingsMatch = text.match(/(?:porties|servings|personen|person)[:：]?\s*(\d+)/i);
  if (servingsMatch) {
    servings = parseInt(servingsMatch[1], 10);
  }

  // Extract difficulty
  if (text.match(/makkelijk|easy|eenvoudig/i)) {
    difficulty = 'Makkelijk';
  } else if (text.match(/moeilijk|hard|difficult|complex/i)) {
    difficulty = 'Moeilijk';
  } else {
    difficulty = 'Gemiddeld';
  }

  // Extract image URL if present
  const imageMatch = text.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
  if (imageMatch) {
    imageUrl = imageMatch[0];
  }

  // Calculate total time if not found
  if (!totalTime && (prepTime || cookTime)) {
    totalTime = (prepTime || 0) + (cookTime || 0);
  }

  return {
    title: title || 'Geïmporteerd Recept',
    description: description || undefined,
    ingredients: ingredients.length > 0 ? ingredients : [{ name: 'Ingrediënten worden geladen...' }],
    instructions: instructions.length > 0 ? instructions : [{ step: 1, instruction: 'Bereidingswijze wordt geladen...' }],
    prepTime,
    cookTime,
    totalTime: totalTime || 30,
    servings: servings || 4,
    difficulty: difficulty || 'Gemiddeld',
    imageUrl,
  };
}

/**
 * Parse a single ingredient line
 */
function parseIngredientLine(line: string): ParsedRecipe['ingredients'][0] | null {
  if (!line || line.length < 2) return null;

  // Pattern: "quantity unit name" or "quantity name" or just "name"
  // Examples: "2 eetlepels olijfolie", "200g bloem", "zout", "1 kopje melk"
  const patterns = [
    // "2 eetlepels olijfolie"
    /^(\d+(?:[.,]\d+)?)\s+(eetlepel|theelepel|el|tl|kopje|cup|ml|g|kg|st|stuks|gram|kilogram|liter|l|dl|cl)\s+(.+)$/i,
    // "200g bloem"
    /^(\d+(?:[.,]\d+)?)\s*(ml|g|kg|st|stuks|gram|kilogram|liter|l|dl|cl|el|tl|eetlepel|theelepel|kopje|cup)\s+(.+)$/i,
    // "2 bloem" (number + name)
    /^(\d+(?:[.,]\d+)?)\s+(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        quantity: match[1].replace(',', '.'),
        unit: match[2] || undefined,
        name: match[3] || match[2] || line,
      };
    }
  }

  // No pattern matched, return as name only
  return {
    name: line,
  };
}

/**
 * Main function to parse recipe from URL or text
 */
export async function parseRecipe(source: string, isUrl: boolean = true): Promise<ParsedRecipe> {
  try {
    if (isUrl) {
      const text = await fetchRecipeFromUrl(source);
      return parseRecipeFromText(text, source);
    } else {
      return parseRecipeFromText(source);
    }
  } catch (error) {
    console.error('[RecipeParser] Error parsing recipe:', error);
    // Return a basic recipe structure on error
    return {
      title: 'Geïmporteerd Recept',
      description: 'Kon recept niet automatisch parsen. Bewerk handmatig.',
      ingredients: [{ name: source }],
      instructions: [{ step: 1, instruction: 'Bewerk dit recept handmatig.' }],
      totalTime: 30,
      servings: 4,
      difficulty: 'Gemiddeld',
    };
  }
}

