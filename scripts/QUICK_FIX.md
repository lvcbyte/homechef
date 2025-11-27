# 🔧 Quick Fix - Match Function Werkt Niet

## Probleem
Na migrations 15 en 16 vind je geen producten meer.

## Oplossing

### Run deze migration in Supabase SQL Editor:

**`supabase/migrations/17_fix_match_simple.sql`**

Deze migration:
- ✅ Fix de "ambiguous column" error
- ✅ Maakt de match functie weer werkend
- ✅ Behoudt translation support
- ✅ Werkt ook zonder translations

### Test na het runnen:

```bash
node scripts/test-match.js
```

Of in Supabase SQL Editor:
```sql
SELECT * FROM public.match_product_catalog('kaas') LIMIT 5;
```

## Als het nog steeds niet werkt:

Run deze simpele versie (zonder translations):

```sql
-- Emergency fix - simple version without translations
drop function if exists public.match_product_catalog(text);

create or replace function public.match_product_catalog(search_term text)
returns table (
    id text,
    product_name text,
    brand text,
    category text,
    barcode text,
    price numeric,
    unit_size text,
    image_url text,
    source text,
    match_score numeric
)
language plpgsql
stable
as $$
declare
    search_lower text;
    search_words text[];
begin
    search_lower := lower(trim(search_term));
    search_words := string_to_array(search_lower, ' ');
    
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
        pc.source,
        case
            when lower(pc.product_name) = search_lower then 100.0
            when lower(pc.product_name) like search_lower || '%' then 80.0
            when lower(pc.product_name) like '%' || search_lower || '%' then 70.0
            when exists (
                select 1 from unnest(search_words) as word
                where length(word) > 2
                and lower(pc.product_name) like '%' || word || '%'
            ) then 50.0
            when similarity(lower(pc.product_name), search_lower) > 0.3 then 30.0
            when pc.product_name % search_term then 20.0
            else 10.0
        end as match_score
    from public.product_catalog pc
    where pc.is_available = true
      and (
        lower(pc.product_name) like '%' || search_lower || '%'
        or lower(coalesce(pc.brand, '')) like '%' || search_lower || '%'
        or exists (
            select 1 from unnest(search_words) as word
            where length(word) > 2
            and lower(pc.product_name) like '%' || word || '%'
        )
        or pc.product_name % search_term
        or similarity(lower(pc.product_name), search_lower) > 0.2
      )
    order by match_score desc, pc.product_name
    limit 20;
end;
$$;

grant execute on function public.match_product_catalog(text) to authenticated;
grant execute on function public.match_product_catalog(text) to anon;
```

