-- Seed Price History Data voor Smart Purchase Advisor Testing
-- Voeg historische prijsdata toe aan bestaande producten

-- Voeg prijsgeschiedenis toe voor producten met prijzen
-- Dit simuleert 30 dagen aan prijsdata voor betere voorspellingen

INSERT INTO public.price_history (product_id, price, source, recorded_at)
SELECT 
    id as product_id,
    -- Genereer realistische prijsvariatie (tussen 85% en 115% van originele prijs)
    price * (0.85 + random() * 0.30) as price,
    source,
    -- Genereer datums over de laatste 30 dagen
    now() - (random() * 30 || ' days')::interval as recorded_at
FROM public.product_catalog
WHERE price IS NOT NULL
AND price > 0
-- Voeg meerdere datapunten toe per product (3-7 per product)
AND random() < 0.3  -- ~30% van producten krijgen data
ON CONFLICT DO NOTHING;

-- Voeg extra datapunten toe voor populaire producten (meer data = betere voorspellingen)
-- Producten die vaker in inventory voorkomen krijgen meer prijsdata
INSERT INTO public.price_history (product_id, price, source, recorded_at)
SELECT 
    i.catalog_product_id as product_id,
    pc.price * (0.85 + random() * 0.30) as price,
    pc.source,
    now() - (random() * 30 || ' days')::interval as recorded_at
FROM public.inventory i
INNER JOIN public.product_catalog pc ON i.catalog_product_id = pc.id
WHERE i.catalog_product_id IS NOT NULL
AND pc.price IS NOT NULL
AND pc.price > 0
AND random() < 0.5  -- 50% kans per inventory item
ON CONFLICT DO NOTHING;

-- Check hoeveel prijsdata er nu is
SELECT 
    COUNT(*) as total_price_records,
    COUNT(DISTINCT product_id) as products_with_history,
    MIN(recorded_at) as oldest_record,
    MAX(recorded_at) as newest_record
FROM public.price_history;

