/**
 * Open Food Facts API Service
 * Fetches product information from the Open Food Facts database
 * API Documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

export interface OpenFoodFactsProduct {
  code: string;
  status: number;
  status_verbose: string;
  product?: {
    // Basic info
    product_name?: string;
    product_name_en?: string;
    product_name_nl?: string;
    brands?: string;
    brand?: string;
    quantity?: string;
    
    // Categories
    categories?: string;
    categories_tags?: string[];
    categories_hierarchy?: string[];
    
    // Images
    image_url?: string;
    image_front_url?: string;
    image_front_small_url?: string;
    image_ingredients_url?: string;
    image_nutrition_url?: string;
    
    // Nutrition
    nutriments?: {
      energy_kcal_100g?: number;
      energy_100g?: number;
      fat_100g?: number;
      saturated_fat_100g?: number;
      carbohydrates_100g?: number;
      sugars_100g?: number;
      fiber_100g?: number;
      proteins_100g?: number;
      salt_100g?: number;
      sodium_100g?: number;
    };
    nutrition_grade_fr?: string; // A, B, C, D, E
    nova_group?: number; // 1-4 (1=unprocessed, 4=ultra-processed)
    
    // Additional info
    ingredients_text?: string;
    ingredients_text_en?: string;
    ingredients_text_nl?: string;
    allergens?: string;
    traces?: string;
    labels?: string;
    packaging?: string;
    origins?: string;
    stores?: string;
    
    // Ecoscore (environmental impact)
    ecoscore_grade?: string; // A, B, C, D, E
    ecoscore_score?: number;
    
    // Nutri-Score
    nutriscore_grade?: string; // A, B, C, D, E
    nutriscore_score?: number;
  };
}

export interface NormalizedProduct {
  id?: string;
  product_name: string;
  brand: string | null;
  barcode: string;
  category: string;
  image_url: string | null;
  unit_size: string | null;
  nutrition: {
    energy_kcal?: number;
    fat?: number;
    saturated_fat?: number;
    carbohydrates?: number;
    sugars?: number;
    fiber?: number;
    proteins?: number;
    salt?: number;
    sodium?: number;
    nutrition_grade?: string;
    nova_group?: number;
    nutriscore_grade?: string;
    ecoscore_grade?: string;
  } | null;
  description: string | null;
  metadata: {
    ingredients?: string;
    allergens?: string;
    traces?: string;
    labels?: string;
    packaging?: string;
    origins?: string;
    stores?: string;
    categories?: string[];
  } | null;
}

/**
 * Fetch product from Open Food Facts API
 */
export async function fetchProductFromOFF(barcode: string): Promise<NormalizedProduct | null> {
  try {
    // Normalize barcode (remove spaces, ensure it's a valid EAN)
    const normalizedBarcode = String(barcode).trim().replace(/\s/g, '');
    
    if (!normalizedBarcode || normalizedBarcode.length < 8) {
      console.warn('[OFF] Invalid barcode:', normalizedBarcode);
      return null;
    }

    // Open Food Facts API endpoint
    const apiUrl = `https://world.openfoodfacts.org/api/v0/product/${normalizedBarcode}.json`;
    
    console.log('[OFF] Fetching product:', normalizedBarcode);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'STOCKPIT/1.0 (https://stockpit.app)',
      },
    });

    if (!response.ok) {
      console.warn('[OFF] API request failed:', response.status, response.statusText);
      return null;
    }

    const data: OpenFoodFactsProduct = await response.json();

    // Check if product was found
    if (data.status === 0 || !data.product) {
      console.log('[OFF] Product not found in Open Food Facts:', normalizedBarcode);
      return null;
    }

    const product = data.product;

    // Normalize product name (prefer Dutch, then English, then default)
    const productName = 
      product.product_name_nl || 
      product.product_name_en || 
      product.product_name || 
      'Onbekend product';

    // Normalize brand
    const brand = product.brand || product.brands?.split(',')[0]?.trim() || null;

    // Determine category from categories hierarchy
    let category = 'pantry'; // default
    if (product.categories_hierarchy && product.categories_hierarchy.length > 0) {
      // Use the most specific category (last in hierarchy)
      const categoryPath = product.categories_hierarchy[product.categories_hierarchy.length - 1];
      // Map Open Food Facts categories to our categories
      category = mapOFFCategoryToOurCategory(categoryPath);
    } else if (product.categories_tags && product.categories_tags.length > 0) {
      category = mapOFFCategoryToOurCategory(product.categories_tags[0]);
    }

    // Get image URL (prefer front image)
    const imageUrl = 
      product.image_front_url || 
      product.image_front_small_url || 
      product.image_url || 
      null;

    // Normalize nutrition data
    const nutrition = product.nutriments ? {
      energy_kcal: product.nutriments.energy_kcal_100g,
      fat: product.nutriments.fat_100g,
      saturated_fat: product.nutriments.saturated_fat_100g,
      carbohydrates: product.nutriments.carbohydrates_100g,
      sugars: product.nutriments.sugars_100g,
      fiber: product.nutriments.fiber_100g,
      proteins: product.nutriments.proteins_100g,
      salt: product.nutriments.salt_100g,
      sodium: product.nutriments.sodium_100g,
      nutrition_grade: product.nutrition_grade_fr || product.nutriscore_grade || null,
      nova_group: product.nova_group || null,
      nutriscore_grade: product.nutriscore_grade || null,
      ecoscore_grade: product.ecoscore_grade || null,
    } : null;

    // Build description from ingredients
    const description = 
      product.ingredients_text_nl || 
      product.ingredients_text_en || 
      product.ingredients_text || 
      null;

    // Build metadata
    const metadata = {
      ingredients: description,
      allergens: product.allergens || null,
      traces: product.traces || null,
      labels: product.labels || null,
      packaging: product.packaging || null,
      origins: product.origins || null,
      stores: product.stores || null,
      categories: product.categories_tags || null,
    };

    const normalized: NormalizedProduct = {
      product_name: productName,
      brand,
      barcode: normalizedBarcode,
      category,
      image_url: imageUrl,
      unit_size: product.quantity || null,
      nutrition,
      description,
      metadata,
    };

    console.log('[OFF] Product fetched successfully:', normalized.product_name);
    return normalized;
  } catch (error) {
    console.error('[OFF] Error fetching product:', error);
    return null;
  }
}

/**
 * Map Open Food Facts category to our category system
 */
function mapOFFCategoryToOurCategory(offCategory: string): string {
  const categoryLower = offCategory.toLowerCase();
  
  // Map common Open Food Facts categories to our categories
  if (categoryLower.includes('dairy') || categoryLower.includes('zuivel') || categoryLower.includes('cheese') || categoryLower.includes('kaas') || categoryLower.includes('milk') || categoryLower.includes('melk')) {
    return 'dairy';
  }
  if (categoryLower.includes('meat') || categoryLower.includes('vlees') || categoryLower.includes('poultry') || categoryLower.includes('gevogelte')) {
    return 'meat';
  }
  if (categoryLower.includes('fish') || categoryLower.includes('vis') || categoryLower.includes('seafood')) {
    return 'seafood';
  }
  if (categoryLower.includes('fruit') || categoryLower.includes('groenten') || categoryLower.includes('vegetables') || categoryLower.includes('groente')) {
    return 'produce';
  }
  if (categoryLower.includes('bread') || categoryLower.includes('brood') || categoryLower.includes('bakery')) {
    return 'bakery';
  }
  if (categoryLower.includes('beverages') || categoryLower.includes('dranken') || categoryLower.includes('drinks')) {
    return 'beverages';
  }
  if (categoryLower.includes('frozen') || categoryLower.includes('diepvries')) {
    return 'frozen';
  }
  if (categoryLower.includes('snacks') || categoryLower.includes('chips') || categoryLower.includes('candy') || categoryLower.includes('snoep')) {
    return 'snacks';
  }
  if (categoryLower.includes('spices') || categoryLower.includes('kruiden') || categoryLower.includes('condiments')) {
    return 'condiments';
  }
  if (categoryLower.includes('cereals') || categoryLower.includes('granen') || categoryLower.includes('pasta') || categoryLower.includes('rice')) {
    return 'pantry';
  }
  
  // Default to pantry
  return 'pantry';
}

/**
 * Save product from Open Food Facts to our database
 */
export async function saveOFFProductToCatalog(
  supabase: any,
  product: NormalizedProduct
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('upsert_product_catalog', {
      payload: {
        product_name: product.product_name,
        brand: product.brand,
        barcode: product.barcode,
        category: product.category,
        image_url: product.image_url,
        unit_size: product.unit_size,
        nutrition: product.nutrition,
        description: product.description,
        metadata: product.metadata,
        source: 'openfoodfacts',
        is_available: true,
      },
    });

    if (error) {
      console.error('[OFF] Error saving product to catalog:', error);
      return null;
    }

    console.log('[OFF] Product saved to catalog:', data?.id);
    return data?.id || null;
  } catch (error) {
    console.error('[OFF] Error saving product:', error);
    return null;
  }
}

