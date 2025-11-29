-- AI Chat Recipes Migration
-- Stores recipes saved from AI chatbot conversations
-- This acts as an enhanced chat history where users can save, view, edit, and delete recipes

create table if not exists public.ai_chat_recipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    description text,
    ingredients jsonb not null default '[]'::jsonb,
    instructions jsonb not null default '[]'::jsonb,
    prep_time_minutes integer,
    cook_time_minutes integer,
    total_time_minutes integer,
    difficulty text check (difficulty in ('Makkelijk', 'Gemiddeld', 'Moeilijk')),
    servings integer,
    nutrition jsonb,
    tags text[] default '{}',
    category text,
    image_url text,
    original_message text, -- The original AI message that contained this recipe
    chat_timestamp timestamptz, -- When this recipe was mentioned in chat
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Index for fast lookups
create index if not exists ai_chat_recipes_user_id_idx 
    on public.ai_chat_recipes(user_id, created_at desc);

-- RLS Policies
alter table public.ai_chat_recipes enable row level security;

create policy "Users can view their own AI chat recipes"
    on public.ai_chat_recipes
    for select
    using (auth.uid() = user_id);

create policy "Users can insert their own AI chat recipes"
    on public.ai_chat_recipes
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own AI chat recipes"
    on public.ai_chat_recipes
    for update
    using (auth.uid() = user_id);

create policy "Users can delete their own AI chat recipes"
    on public.ai_chat_recipes
    for delete
    using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create or replace function update_ai_chat_recipes_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

-- Trigger to automatically update updated_at
create trigger update_ai_chat_recipes_updated_at
    before update on public.ai_chat_recipes
    for each row
    execute function update_ai_chat_recipes_updated_at();

