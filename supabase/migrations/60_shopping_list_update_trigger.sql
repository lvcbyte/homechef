-- Create function to update updated_at timestamp
create or replace function update_shopping_list_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at when shopping list is modified
drop trigger if exists update_shopping_lists_updated_at on public.shopping_lists;
create trigger update_shopping_lists_updated_at
  before update on public.shopping_lists
  for each row
  execute function update_shopping_list_updated_at();

-- Ensure RLS policies allow UPDATE and DELETE operations
-- The existing policy already covers this with "with check", but let's make sure
drop policy if exists "Shopping lists by owner" on public.shopping_lists;
create policy "Shopping lists by owner" on public.shopping_lists
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- Add comment
comment on function update_shopping_list_updated_at() is 'Automatically updates updated_at timestamp when shopping list is modified';

