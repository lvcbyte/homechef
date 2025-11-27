-- Create product translations table for FR/DE -> NL translations
drop table if exists public.product_translations cascade;

create table public.product_translations (
    id serial primary key,
    source_language text not null, -- 'fr', 'de', 'en'
    source_term text not null,
    dutch_term text not null,
    category text, -- Optional: category context
    created_at timestamptz default timezone('utc', now())
);

create index if not exists idx_product_translations_source on public.product_translations(source_language, source_term);
create index if not exists idx_product_translations_dutch on public.product_translations(dutch_term);

-- Add unique constraint to prevent duplicates
create unique index if not exists idx_product_translations_unique on public.product_translations(source_language, source_term, dutch_term);

-- Common food translations FR -> NL
insert into public.product_translations (source_language, source_term, dutch_term, category) values
-- Fruits & Vegetables
('fr', 'pomme', 'appel', 'fresh_produce'),
('fr', 'banane', 'banaan', 'fresh_produce'),
('fr', 'orange', 'sinaasappel', 'fresh_produce'),
('fr', 'tomate', 'tomaat', 'fresh_produce'),
('fr', 'carotte', 'wortel', 'fresh_produce'),
('fr', 'salade', 'sla', 'fresh_produce'),
('fr', 'oignon', 'ui', 'fresh_produce'),
('fr', 'ail', 'knoflook', 'fresh_produce'),
('fr', 'pomme de terre', 'aardappel', 'fresh_produce'),
('fr', 'champignon', 'champignon', 'fresh_produce'),
('fr', 'courgette', 'courgette', 'fresh_produce'),
('fr', 'aubergine', 'aubergine', 'fresh_produce'),
('fr', 'poivron', 'paprika', 'fresh_produce'),
('fr', 'concombre', 'komkommer', 'fresh_produce'),
('fr', 'brocoli', 'broccoli', 'fresh_produce'),
('fr', 'chou-fleur', 'bloemkool', 'fresh_produce'),
('fr', 'épinard', 'spinazie', 'fresh_produce'),
('fr', 'haricot vert', 'sperzieboon', 'fresh_produce'),
('fr', 'petit pois', 'erwt', 'fresh_produce'),
('fr', 'maïs', 'maïs', 'fresh_produce'),

-- Dairy
('fr', 'lait', 'melk', 'dairy_eggs'),
('fr', 'fromage', 'kaas', 'dairy_eggs'),
('fr', 'beurre', 'boter', 'dairy_eggs'),
('fr', 'yaourt', 'yoghurt', 'dairy_eggs'),
('fr', 'crème', 'room', 'dairy_eggs'),
('fr', 'œuf', 'ei', 'dairy_eggs'),
('fr', 'œufs', 'eieren', 'dairy_eggs'),

-- Meat & Fish
('fr', 'poulet', 'kip', 'proteins'),
('fr', 'bœuf', 'rundvlees', 'proteins'),
('fr', 'porc', 'varkensvlees', 'proteins'),
('fr', 'saucisse', 'worst', 'proteins'),
('fr', 'jambon', 'ham', 'proteins'),
('fr', 'poisson', 'vis', 'seafood'),
('fr', 'saumon', 'zalm', 'seafood'),
('fr', 'thon', 'tonijn', 'seafood'),
('fr', 'crevette', 'garnaal', 'seafood'),

-- Bread & Bakery
('fr', 'pain', 'brood', 'bakery'),
('fr', 'baguette', 'stokbrood', 'bakery'),
('fr', 'brioche', 'brioche', 'bakery'),
('fr', 'croissant', 'croissant', 'bakery'),

-- Beverages
('fr', 'eau', 'water', 'beverages'),
('fr', 'jus', 'sap', 'beverages'),
('fr', 'café', 'koffie', 'beverages'),
('fr', 'thé', 'thee', 'beverages'),
('fr', 'bière', 'bier', 'beverages'),
('fr', 'vin', 'wijn', 'beverages'),

-- Common German translations DE -> NL
('de', 'apfel', 'appel', 'fresh_produce'),
('de', 'banane', 'banaan', 'fresh_produce'),
('de', 'orange', 'sinaasappel', 'fresh_produce'),
('de', 'tomate', 'tomaat', 'fresh_produce'),
('de', 'karotte', 'wortel', 'fresh_produce'),
('de', 'salat', 'sla', 'fresh_produce'),
('de', 'zwiebel', 'ui', 'fresh_produce'),
('de', 'knoblauch', 'knoflook', 'fresh_produce'),
('de', 'kartoffel', 'aardappel', 'fresh_produce'),
('de', 'pilz', 'champignon', 'fresh_produce'),
('de', 'zucchini', 'courgette', 'fresh_produce'),
('de', 'aubergine', 'aubergine', 'fresh_produce'),
('de', 'paprika', 'paprika', 'fresh_produce'),
('de', 'gurke', 'komkommer', 'fresh_produce'),
('de', 'brokkoli', 'broccoli', 'fresh_produce'),
('de', 'blumenkohl', 'bloemkool', 'fresh_produce'),
('de', 'spinat', 'spinazie', 'fresh_produce'),
('de', 'grüne bohnen', 'sperzieboon', 'fresh_produce'),
('de', 'erbsen', 'erwt', 'fresh_produce'),
('de', 'mais', 'maïs', 'fresh_produce'),

-- Dairy DE
('de', 'milch', 'melk', 'dairy_eggs'),
('de', 'käse', 'kaas', 'dairy_eggs'),
('de', 'butter', 'boter', 'dairy_eggs'),
('de', 'joghurt', 'yoghurt', 'dairy_eggs'),
('de', 'sahne', 'room', 'dairy_eggs'),
('de', 'ei', 'ei', 'dairy_eggs'),
('de', 'eier', 'eieren', 'dairy_eggs'),

-- Meat & Fish DE
('de', 'huhn', 'kip', 'proteins'),
('de', 'rindfleisch', 'rundvlees', 'proteins'),
('de', 'schweinefleisch', 'varkensvlees', 'proteins'),
('de', 'wurst', 'worst', 'proteins'),
('de', 'schinken', 'ham', 'proteins'),
('de', 'fisch', 'vis', 'seafood'),
('de', 'lachs', 'zalm', 'seafood'),
('de', 'thunfisch', 'tonijn', 'seafood'),
('de', 'garnele', 'garnaal', 'seafood'),

-- Bread DE
('de', 'brot', 'brood', 'bakery'),
('de', 'brötchen', 'broodje', 'bakery'),

-- Beverages DE
('de', 'wasser', 'water', 'beverages'),
('de', 'saft', 'sap', 'beverages'),
('de', 'kaffee', 'koffie', 'beverages'),
('de', 'tee', 'thee', 'beverages'),
('de', 'bier', 'bier', 'beverages'),
('de', 'wein', 'wijn', 'beverages')
on conflict (source_language, source_term, dutch_term) do nothing;

-- Function to translate product name to Dutch
create or replace function public.translate_to_dutch(product_name text)
returns text
language plpgsql
stable
as $$
declare
    translated text;
    words text[];
    word text;
    translation text;
begin
    -- If already in Dutch (contains common Dutch words), return as is
    if product_name ~* '(kaas|melk|brood|appel|tomaat|kip|vis|water|koffie|thee|boter|ei|yoghurt|sla|wortel|ui|aardappel|champignon|paprika|komkommer|spinazie|banaan|sinaasappel|ham|worst|rundvlees|varkensvlees|zalm|tonijn|garnaal|sap|bier|wijn)' then
        return product_name;
    end if;
    
    -- Split into words and translate each
    words := string_to_array(lower(product_name), ' ');
    translated := '';
    
    foreach word in array words
    loop
        -- Try French translation
        select dutch_term into translation
        from public.product_translations
        where source_language = 'fr' and source_term = word
        limit 1;
        
        -- If not found, try German
        if translation is null then
            select dutch_term into translation
            from public.product_translations
            where source_language = 'de' and source_term = word
            limit 1;
        end if;
        
        -- Use translation if found, otherwise keep original word
        if translation is not null then
            translated := translated || translation || ' ';
        else
            translated := translated || word || ' ';
        end if;
    end loop;
    
    return trim(translated);
end;
$$;

-- Function to get search variants (original + translations)
create or replace function public.get_search_variants(search_term text)
returns text[]
language plpgsql
stable
as $$
declare
    variants text[];
    translated text;
    reverse_translations text[];
begin
    variants := ARRAY[lower(trim(search_term))];
    
    -- Get Dutch translation
    translated := public.translate_to_dutch(search_term);
    if translated != lower(trim(search_term)) then
        variants := variants || ARRAY[translated];
    end if;
    
    -- Also add reverse translations (if user searches in Dutch, find FR/DE products)
    select array_agg(distinct source_term) into reverse_translations
    from public.product_translations
    where dutch_term = lower(trim(search_term));
    
    if reverse_translations is not null and array_length(reverse_translations, 1) > 0 then
        variants := variants || reverse_translations;
    end if;
    
    return variants;
end;
$$;

