-- Translation table for English to Dutch product names
create table if not exists public.product_translations (
    english_term text primary key,
    dutch_terms text[] not null,
    created_at timestamptz not null default timezone('utc', now())
);

-- Insert common translations
insert into public.product_translations (english_term, dutch_terms)
values
    ('sausage', ARRAY['worst', 'worstjes', 'sausage']),
    ('cheese', ARRAY['kaas', 'cheese']),
    ('milk', ARRAY['melk', 'milk']),
    ('bread', ARRAY['brood', 'bread']),
    ('butter', ARRAY['boter', 'butter']),
    ('chicken', ARRAY['kip', 'chicken', 'kippen']),
    ('beef', ARRAY['rundvlees', 'beef', 'biefstuk']),
    ('pork', ARRAY['varkensvlees', 'pork']),
    ('fish', ARRAY['vis', 'fish', 'vissen']),
    ('tomato', ARRAY['tomaat', 'tomaten', 'tomato']),
    ('potato', ARRAY['aardappel', 'aardappelen', 'potato']),
    ('onion', ARRAY['ui', 'uien', 'onion']),
    ('carrot', ARRAY['wortel', 'peen', 'wortelen', 'carrot']),
    ('lettuce', ARRAY['sla', 'lettuce']),
    ('apple', ARRAY['appel', 'appels', 'apple']),
    ('banana', ARRAY['banaan', 'bananen', 'banana']),
    ('orange', ARRAY['sinaasappel', 'appelsien', 'orange']),
    ('yogurt', ARRAY['yoghurt', 'yogurt']),
    ('egg', ARRAY['ei', 'eieren', 'egg']),
    ('rice', ARRAY['rijst', 'rice']),
    ('pasta', ARRAY['pasta', 'macaroni', 'spaghetti']),
    ('soup', ARRAY['soep', 'soup']),
    ('sauce', ARRAY['saus', 'sauce']),
    ('salt', ARRAY['zout', 'salt']),
    ('pepper', ARRAY['peper', 'pepper']),
    ('sugar', ARRAY['suiker', 'sugar']),
    ('flour', ARRAY['meel', 'bloem', 'flour']),
    ('oil', ARRAY['olie', 'oil']),
    ('water', ARRAY['water', 'water']),
    ('juice', ARRAY['sap', 'juice']),
    ('beer', ARRAY['bier', 'beer']),
    ('wine', ARRAY['wijn', 'wine']),
    ('coffee', ARRAY['koffie', 'coffee']),
    ('tea', ARRAY['thee', 'tea']),
    ('chocolate', ARRAY['chocolade', 'chocolate']),
    ('cookie', ARRAY['koekje', 'koek', 'cookie', 'biscuit']),
    ('cracker', ARRAY['cracker', 'biscuit']),
    ('chip', ARRAY['chip', 'chips']),
    ('crisp', ARRAY['chip', 'chips', 'crisp']),
    ('ice cream', ARRAY['ijs', 'ijsje', 'ice cream']),
    ('frozen', ARRAY['diepvries', 'frozen', 'ingevroren']),
    ('fresh', ARRAY['vers', 'fresh']),
    ('organic', ARRAY['biologisch', 'bio', 'organic']),
    ('bio', ARRAY['biologisch', 'bio', 'organic'])
on conflict (english_term) do update set dutch_terms = excluded.dutch_terms;

-- Drop old function if it exists (different return type)
drop function if exists public.match_product_catalog(text);

-- Enhanced match function with translations and multiple results
create function public.match_product_catalog(search_term text)
returns table (
    id text,
    product_name text,
    brand text,
    category text,
    barcode text,
    price numeric,
    unit_size text,
    image_url text,
    match_score numeric
)
language plpgsql
stable
as $$
declare
    translated_terms text[];
    search_variants text[];
begin
    -- Get Dutch translations for English terms
    select array_agg(unnest(dutch_terms))
    into translated_terms
    from public.product_translations
    where english_term = lower(search_term);

    -- Build search variants: original + translations
    search_variants := ARRAY[lower(search_term)];
    if translated_terms is not null then
        search_variants := search_variants || translated_terms;
    end if;

    -- Search with all variants and return multiple results
    return query
    select
        pc.id,
        pc.product_name,
        pc.brand,
        pc.category,
        pc.barcode,
        pc.price,
        pc.unit_size,
        pc.image_url,
        greatest(
            -- Exact match on product name
            case when exists (select 1 from unnest(search_variants) as v where lower(pc.product_name) = v) then 1.0
                 when exists (select 1 from unnest(search_variants) as v where lower(pc.product_name) like '%' || v || '%') then 0.8
                 else 0.0 end,
            -- Similarity match
            similarity(lower(pc.product_name), lower(search_term)),
            similarity(lower(coalesce(pc.brand, '')), lower(search_term)),
            -- Translation match
            case when translated_terms is not null then
                greatest(
                    (select max(similarity(lower(pc.product_name), lower(term))) from unnest(translated_terms) as term),
                    (select max(similarity(lower(coalesce(pc.brand, '')), lower(term))) from unnest(translated_terms) as term)
                )
            else 0.0 end
        ) as match_score
    from public.product_catalog pc
    where pc.is_available = true
      and (
        -- Match on any search variant
        exists (select 1 from unnest(search_variants) as v where lower(pc.product_name) like '%' || v || '%')
        or exists (select 1 from unnest(search_variants) as v where lower(pc.brand) like '%' || v || '%')
        or exists (select 1 from unnest(search_variants) as v where pc.product_name % v)
        or exists (select 1 from unnest(search_variants) as v where pc.brand % v)
        -- Or similarity match
        or similarity(lower(pc.product_name), lower(search_term)) > 0.2
        or similarity(lower(coalesce(pc.brand, '')), lower(search_term)) > 0.2
      )
    order by match_score desc, pc.product_name
    limit 10;
end;
$$;

