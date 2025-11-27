-- Seed data for recipes
-- All recipes from the app with author: Dietmar Lattré

-- Insert recipes
insert into public.recipes (id, title, description, author, image_url, prep_time_minutes, cook_time_minutes, total_time_minutes, difficulty, servings, ingredients, instructions, tags, category) values
-- Trending recipes
(
    gen_random_uuid(),
    'Snelle Kip Katsu Curry',
    'Een snelle en smaakvolle kip katsu curry met een perfecte balans tussen zoet en hartig.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
    10,
    15,
    25,
    'Gemiddeld',
    4,
    '[
        {"name": "kipfilet", "quantity": "500", "unit": "g"},
        {"name": "curry pasta", "quantity": "2", "unit": "el"},
        {"name": "kokosmelk", "quantity": "400", "unit": "ml"},
        {"name": "ui", "quantity": "1", "unit": "stuk"},
        {"name": "rijst", "quantity": "300", "unit": "g"},
        {"name": "paneermeel", "quantity": "100", "unit": "g"},
        {"name": "ei", "quantity": "2", "unit": "stuk"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Snijd de kipfilet in stukken en paneer met ei en paneermeel."},
        {"step": 2, "instruction": "Bak de kipfilet goudbruin in een pan met olie."},
        {"step": 3, "instruction": "Fruit de ui aan, voeg curry pasta toe en roer goed."},
        {"step": 4, "instruction": "Voeg kokosmelk toe en laat 10 minuten pruttelen."},
        {"step": 5, "instruction": "Serveer met gekookte rijst."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'Comfort Food', 'High Protein'],
    'Aziatisch'
),
(
    gen_random_uuid(),
    'Geroosterde Bloemkool Taco''s',
    'Vegetarische taco''s met geroosterde bloemkool en frisse toppings.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    15,
    13,
    28,
    'Makkelijk',
    4,
    '[
        {"name": "bloemkool", "quantity": "1", "unit": "stuk"},
        {"name": "tortilla wraps", "quantity": "8", "unit": "stuk"},
        {"name": "limoen", "quantity": "2", "unit": "stuk"},
        {"name": "koriander", "quantity": "1", "unit": "bos"},
        {"name": "rode ui", "quantity": "1", "unit": "stuk"},
        {"name": "avocado", "quantity": "2", "unit": "stuk"},
        {"name": "kruidenmix", "quantity": "2", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Verwarm de oven voor op 200°C."},
        {"step": 2, "instruction": "Snijd de bloemkool in roosjes en meng met olie en kruiden."},
        {"step": 3, "instruction": "Rooster 20 minuten in de oven tot goudbruin."},
        {"step": 4, "instruction": "Bereid de toppings: gesneden ui, avocado en koriander."},
        {"step": 5, "instruction": "Serveer in warme tortilla wraps met limoensap."}
    ]'::jsonb,
    ARRAY['Vegan', 'Plant-based', 'Budget'],
    'Vegan'
),
(
    gen_random_uuid(),
    'Sesam Ramen Bowl',
    'Een heerlijke ramen bowl met sesam en verse groenten.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=800&q=80',
    10,
    12,
    22,
    'Makkelijk',
    2,
    '[
        {"name": "ramen noedels", "quantity": "200", "unit": "g"},
        {"name": "sesamolie", "quantity": "2", "unit": "el"},
        {"name": "sojasaus", "quantity": "3", "unit": "el"},
        {"name": "lente-ui", "quantity": "3", "unit": "stuk"},
        {"name": "wortel", "quantity": "1", "unit": "stuk"},
        {"name": "ei", "quantity": "2", "unit": "stuk"},
        {"name": "zeewier", "quantity": "1", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Kook de ramen noedels volgens de verpakking."},
        {"step": 2, "instruction": "Maak de bouillon met sojasaus en sesamolie."},
        {"step": 3, "instruction": "Snijd de groenten in dunne reepjes."},
        {"step": 4, "instruction": "Kook de eieren zacht (6 minuten)."},
        {"step": 5, "instruction": "Serveer de noedels in de bouillon met groenten en ei."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'Comfort Food'],
    'Aziatisch'
),
(
    gen_random_uuid(),
    'Misoboter Spruitjes',
    'Geroosterde spruitjes met een umami misoboter saus.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80',
    5,
    13,
    18,
    'Makkelijk',
    4,
    '[
        {"name": "spruitjes", "quantity": "500", "unit": "g"},
        {"name": "miso pasta", "quantity": "2", "unit": "el"},
        {"name": "boter", "quantity": "50", "unit": "g"},
        {"name": "knoflook", "quantity": "2", "unit": "teentjes"},
        {"name": "citroensap", "quantity": "1", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Verwarm de oven voor op 200°C."},
        {"step": 2, "instruction": "Snijd de spruitjes doormidden."},
        {"step": 3, "instruction": "Rooster 15 minuten tot goudbruin."},
        {"step": 4, "instruction": "Meng miso, boter en knoflook in een pan."},
        {"step": 5, "instruction": "Meng de spruitjes met de misoboter en serveer."}
    ]'::jsonb,
    ARRAY['Vegan', 'Plant-based', 'Budget'],
    'Vegan'
),
(
    gen_random_uuid(),
    'Griekse Flatbread Pizza',
    'Een snelle flatbread pizza met Griekse smaken.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
    5,
    15,
    20,
    'Makkelijk',
    2,
    '[
        {"name": "flatbread", "quantity": "2", "unit": "stuk"},
        {"name": "feta", "quantity": "150", "unit": "g"},
        {"name": "olijven", "quantity": "50", "unit": "g"},
        {"name": "tomaat", "quantity": "2", "unit": "stuk"},
        {"name": "oregano", "quantity": "1", "unit": "el"},
        {"name": "olijfolie", "quantity": "2", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Verwarm de oven voor op 220°C."},
        {"step": 2, "instruction": "Beleg de flatbread met tomaten, feta en olijven."},
        {"step": 3, "instruction": "Bestrooi met oregano en olijfolie."},
        {"step": 4, "instruction": "Bak 12-15 minuten tot de kaas gesmolten is."}
    ]'::jsonb,
    ARRAY['Italiaans', 'Comfort Food', 'Budget'],
    'Italiaans'
),
-- Chef Radar recipes
(
    gen_random_uuid(),
    'Miso Butter Ramen Upgrade',
    'Een verfijnde ramen met miso en boter voor een rijke smaak.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1470673042977-43d9b07b7103?auto=format&fit=crop&w=1000&q=80',
    20,
    25,
    45,
    'Moeilijk',
    2,
    '[
        {"name": "ramen noedels", "quantity": "200", "unit": "g"},
        {"name": "miso pasta", "quantity": "3", "unit": "el"},
        {"name": "boter", "quantity": "50", "unit": "g"},
        {"name": "kipfilet", "quantity": "200", "unit": "g"},
        {"name": "ei", "quantity": "2", "unit": "stuk"},
        {"name": "lente-ui", "quantity": "4", "unit": "stuk"},
        {"name": "zeewier", "quantity": "2", "unit": "el"},
        {"name": "sesamzaad", "quantity": "1", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Maak een rijke bouillon met miso en boter."},
        {"step": 2, "instruction": "Bak de kipfilet goudbruin en snijd in plakjes."},
        {"step": 3, "instruction": "Kook de eieren zacht (6 minuten)."},
        {"step": 4, "instruction": "Kook de noedels en serveer in de bouillon."},
        {"step": 5, "instruction": "Garneer met kip, ei, lente-ui en zeewier."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'Comfort Food', 'High Protein'],
    'Aziatisch'
),
(
    gen_random_uuid(),
    'Spicy Walnut Satay Bowl',
    'Een pittige satay bowl met walnoten en groenten.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1000&q=80',
    15,
    15,
    30,
    'Gemiddeld',
    2,
    '[
        {"name": "rijst", "quantity": "200", "unit": "g"},
        {"name": "walnoten", "quantity": "100", "unit": "g"},
        {"name": "pindakaas", "quantity": "3", "unit": "el"},
        {"name": "sojasaus", "quantity": "2", "unit": "el"},
        {"name": "sambal", "quantity": "1", "unit": "el"},
        {"name": "broccoli", "quantity": "200", "unit": "g"},
        {"name": "wortel", "quantity": "1", "unit": "stuk"},
        {"name": "lente-ui", "quantity": "2", "unit": "stuk"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Kook de rijst volgens de verpakking."},
        {"step": 2, "instruction": "Maak de satay saus met pindakaas, sojasaus en sambal."},
        {"step": 3, "instruction": "Rooster de walnoten in een pan."},
        {"step": 4, "instruction": "Stoom de groenten tot ze knapperig zijn."},
        {"step": 5, "instruction": "Serveer de rijst met groenten, walnoten en satay saus."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'Vegan', 'Plant-based', 'High Protein'],
    'Aziatisch'
),
(
    gen_random_uuid(),
    'Krokante Gochujang Wings',
    'Krokante kippenvleugels met een zoet-pittige gochujang glazuur.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
    10,
    18,
    28,
    'Gemiddeld',
    4,
    '[
        {"name": "kippenvleugels", "quantity": "1", "unit": "kg"},
        {"name": "gochujang", "quantity": "3", "unit": "el"},
        {"name": "honing", "quantity": "2", "unit": "el"},
        {"name": "sojasaus", "quantity": "2", "unit": "el"},
        {"name": "knoflook", "quantity": "3", "unit": "teentjes"},
        {"name": "gember", "quantity": "1", "unit": "stuk"},
        {"name": "sesamzaad", "quantity": "1", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Verwarm de oven voor op 200°C."},
        {"step": 2, "instruction": "Meng gochujang, honing, sojasaus, knoflook en gember."},
        {"step": 3, "instruction": "Marineer de vleugels 30 minuten."},
        {"step": 4, "instruction": "Bak 40 minuten, keer halverwege."},
        {"step": 5, "instruction": "Bestrijk met de rest van de saus en serveer met sesamzaad."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'Comfort Food', 'High Protein', 'Feest'],
    'Aziatisch'
),
(
    gen_random_uuid(),
    'Halloumi & Harissa Traybake',
    'Een eenpansgerecht met halloumi en harissa voor maximale smaak.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80',
    10,
    22,
    32,
    'Makkelijk',
    4,
    '[
        {"name": "halloumi", "quantity": "250", "unit": "g"},
        {"name": "harissa", "quantity": "2", "unit": "el"},
        {"name": "zoete aardappel", "quantity": "500", "unit": "g"},
        {"name": "paprika", "quantity": "2", "unit": "stuk"},
        {"name": "ui", "quantity": "1", "unit": "stuk"},
        {"name": "kikkererwten", "quantity": "400", "unit": "g"},
        {"name": "olijfolie", "quantity": "3", "unit": "el"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Verwarm de oven voor op 200°C."},
        {"step": 2, "instruction": "Snijd alle groenten in stukken."},
        {"step": 3, "instruction": "Meng met harissa en olijfolie."},
        {"step": 4, "instruction": "Rooster 25 minuten, voeg halverwege halloumi toe."},
        {"step": 5, "instruction": "Serveer direct uit de oven."}
    ]'::jsonb,
    ARRAY['Vegan', 'Plant-based', 'Comfort Food', 'Budget'],
    'Vegan'
),
(
    gen_random_uuid(),
    'Shiitake Umami Pasta',
    'Een umami-rijke pasta met shiitake paddenstoelen.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
    10,
    14,
    24,
    'Makkelijk',
    2,
    '[
        {"name": "pasta", "quantity": "200", "unit": "g"},
        {"name": "shiitake", "quantity": "200", "unit": "g"},
        {"name": "knoflook", "quantity": "3", "unit": "teentjes"},
        {"name": "boter", "quantity": "50", "unit": "g"},
        {"name": "parmezaan", "quantity": "50", "unit": "g"},
        {"name": "peterselie", "quantity": "1", "unit": "bos"},
        {"name": "citroen", "quantity": "1", "unit": "stuk"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Kook de pasta volgens de verpakking."},
        {"step": 2, "instruction": "Bak de shiitake goudbruin in boter."},
        {"step": 3, "instruction": "Voeg knoflook toe en bak 1 minuut mee."},
        {"step": 4, "instruction": "Meng de pasta met de paddenstoelen."},
        {"step": 5, "instruction": "Serveer met parmezaan, peterselie en citroensap."}
    ]'::jsonb,
    ARRAY['Italiaans', 'Vegan', 'Plant-based', 'Comfort Food'],
    'Italiaans'
),
(
    gen_random_uuid(),
    'Sesam Spruitjes',
    'Snelle geroosterde spruitjes met sesam.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80',
    5,
    11,
    16,
    'Makkelijk',
    4,
    '[
        {"name": "spruitjes", "quantity": "500", "unit": "g"},
        {"name": "sesamolie", "quantity": "2", "unit": "el"},
        {"name": "sesamzaad", "quantity": "2", "unit": "el"},
        {"name": "sojasaus", "quantity": "1", "unit": "el"},
        {"name": "knoflook", "quantity": "2", "unit": "teentjes"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Verwarm de oven voor op 200°C."},
        {"step": 2, "instruction": "Snijd de spruitjes doormidden."},
        {"step": 3, "instruction": "Meng met sesamolie, sojasaus en knoflook."},
        {"step": 4, "instruction": "Rooster 15 minuten, bestrooi met sesamzaad."}
    ]'::jsonb,
    ARRAY['Vegan', 'Plant-based', 'Budget'],
    'Vegan'
),
(
    gen_random_uuid(),
    'Soba met Tomaat',
    'Een frisse soba noedel salade met tomaten.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    5,
    13,
    18,
    'Makkelijk',
    2,
    '[
        {"name": "soba noedels", "quantity": "200", "unit": "g"},
        {"name": "tomaat", "quantity": "300", "unit": "g"},
        {"name": "komkommer", "quantity": "1", "unit": "stuk"},
        {"name": "sojasaus", "quantity": "2", "unit": "el"},
        {"name": "sesamolie", "quantity": "1", "unit": "el"},
        {"name": "lente-ui", "quantity": "2", "unit": "stuk"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Kook de soba noedels volgens de verpakking."},
        {"step": 2, "instruction": "Spoel af met koud water."},
        {"step": 3, "instruction": "Snijd tomaten en komkommer in stukken."},
        {"step": 4, "instruction": "Meng alles met sojasaus en sesamolie."},
        {"step": 5, "instruction": "Serveer koud met gesneden lente-ui."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'Vegan', 'Plant-based'],
    'Aziatisch'
),
(
    gen_random_uuid(),
    'Kokos Lime Shrimp',
    'Romige garnalen met kokos en limoen.',
    'Dietmar Lattré',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    10,
    10,
    20,
    'Makkelijk',
    2,
    '[
        {"name": "garnalen", "quantity": "300", "unit": "g"},
        {"name": "kokosmelk", "quantity": "200", "unit": "ml"},
        {"name": "limoen", "quantity": "2", "unit": "stuk"},
        {"name": "knoflook", "quantity": "2", "unit": "teentjes"},
        {"name": "gember", "quantity": "1", "unit": "stuk"},
        {"name": "rijst", "quantity": "200", "unit": "g"},
        {"name": "koriander", "quantity": "1", "unit": "bos"}
    ]'::jsonb,
    '[
        {"step": 1, "instruction": "Kook de rijst volgens de verpakking."},
        {"step": 2, "instruction": "Bak de garnalen 2 minuten per kant."},
        {"step": 3, "instruction": "Voeg knoflook en gember toe."},
        {"step": 4, "instruction": "Giet kokosmelk erbij en laat 5 minuten pruttelen."},
        {"step": 5, "instruction": "Serveer met rijst, limoensap en koriander."}
    ]'::jsonb,
    ARRAY['Aziatisch', 'High Protein', 'Comfort Food'],
    'Aziatisch'
)
on conflict do nothing;

-- Insert recipe categories
insert into public.recipe_categories (recipe_id, category)
select r.id, unnest(r.tags)
from public.recipes r
on conflict do nothing;

