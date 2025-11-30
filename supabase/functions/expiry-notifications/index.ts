import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    // Call the database function to create expiry notifications
    const { data, error } = await supabase.rpc('create_expiry_notifications');

    if (error) {
      console.error('Error creating expiry notifications:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Also create recipe suggestions for items expiring soon
    const { data: expiringItems, error: itemsError } = await supabase
      .from('inventory')
      .select('id, user_id, name, expires_at')
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
      .gt('expires_at', new Date().toISOString());

    if (itemsError) {
      console.error('Error fetching expiring items:', itemsError);
    } else if (expiringItems && expiringItems.length > 0) {
      // Group items by user
      const itemsByUser = new Map<string, typeof expiringItems>();
      for (const item of expiringItems) {
        if (!item.user_id) continue;
        if (!itemsByUser.has(item.user_id)) {
          itemsByUser.set(item.user_id, []);
        }
        itemsByUser.get(item.user_id)!.push(item);
      }

      // Create recipe suggestion notifications for each user
      for (const [userId, items] of itemsByUser.entries()) {
        const itemNames = items.map((i) => i.name).join(', ');
        
        // Check if we already sent a recipe suggestion today
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'expiry_recipe_suggestion')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (existingNotification && existingNotification.length > 0) {
          continue; // Already sent today
        }

        // Get suggested recipes using the leftovers generator function
        const { data: suggestedRecipes } = await supabase.rpc('generate_leftovers_recipes', {
          p_user_id: userId,
        });

        if (suggestedRecipes && suggestedRecipes.length > 0) {
          const recipe = suggestedRecipes[0];
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'expiry_recipe_suggestion',
            title: `🍳 Recept suggestie: ${recipe.title}`,
            message: `Je ${itemNames} ${items.length === 1 ? 'is' : 'zijn'} bijna over datum. Probeer dit recept!`,
            data: {
              item_ids: items.map((i) => i.id),
              item_names: items.map((i) => i.name),
              suggested_recipe: {
                id: recipe.recipe_id,
                title: recipe.title,
                image_url: recipe.image_url,
              },
            },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Expiry notifications created successfully',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

