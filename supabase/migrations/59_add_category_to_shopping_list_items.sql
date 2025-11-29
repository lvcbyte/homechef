-- Add category field to shopping_list_items for filtering
alter table public.shopping_list_items
add column if not exists category text;

-- Create index for faster category filtering
create index if not exists idx_shopping_list_items_category 
on public.shopping_list_items(category);

-- Add comment
comment on column public.shopping_list_items.category is 'Category of the shopping list item for filtering (e.g., Produce, Dairy, Meat, etc.)';

