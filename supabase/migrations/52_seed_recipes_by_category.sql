-- Seed database with 5 recipes per category
-- Categories: Comfort Food, Vlees, Vis, Feest, High Protein, Italiaans, Aziatisch, Plant-based, Budget, Quick

-- Insert 5 Comfort Food recipes
insert into public.recipes (id, title, description, author, image_url, prep_time_minutes, cook_time_minutes, total_time_minutes, difficulty, servings, ingredients, instructions, tags, category) values
(gen_random_uuid(), 'Klassieke Mac & Cheese', 'Romige macaroni met een krokante kaaskorst. Het ultieme comfort food voor koude dagen.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 15, 25, 40, 'Makkelijk', 4,
'[{"name": "macaroni", "quantity": "400", "unit": "g"}, {"name": "cheddar kaas", "quantity": "300", "unit": "g"}, {"name": "goudse kaas", "quantity": "200", "unit": "g"}, {"name": "boter", "quantity": "50", "unit": "g"}, {"name": "bloem", "quantity": "50", "unit": "g"}, {"name": "melk", "quantity": "500", "unit": "ml"}, {"name": "paneermeel", "quantity": "50", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Kook de macaroni volgens de verpakking. Giet af en zet apart."}, {"step": 2, "instruction": "Smelt boter in een pan. Voeg bloem toe en roer 2 minuten."}, {"step": 3, "instruction": "Voeg melk toe en roer tot een gladde saus. Laat 5 minuten pruttelen."}, {"step": 4, "instruction": "Voeg geraspte kaas toe en roer tot gesmolten."}, {"step": 5, "instruction": "Meng macaroni met kaassaus. Bestrooi met paneermeel en bak 20 minuten op 200°C."}]'::jsonb,
ARRAY['Comfort Food', 'Budget', 'Quick'], 'Comfort Food'),

(gen_random_uuid(), 'Chili con Carne', 'Hartige chili met rundvlees, bonen en kruiden. Perfect voor een avondje comfort food.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=800&q=80', 20, 60, 80, 'Gemiddeld', 6,
'[{"name": "rundvlees", "quantity": "500", "unit": "g"}, {"name": "kidneybonen", "quantity": "400", "unit": "g"}, {"name": "tomaten", "quantity": "800", "unit": "g"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "knoflook", "quantity": "3", "unit": "teentjes"}, {"name": "chilipoeder", "quantity": "2", "unit": "tl"}, {"name": "komijn", "quantity": "1", "unit": "tl"}]'::jsonb,
'[{"step": 1, "instruction": "Bak het rundvlees rul in een grote pan."}, {"step": 2, "instruction": "Voeg ui en knoflook toe en bak 5 minuten."}, {"step": 3, "instruction": "Voeg kruiden toe en roer goed."}, {"step": 4, "instruction": "Voeg tomaten en bonen toe. Laat 1 uur zachtjes pruttelen."}, {"step": 5, "instruction": "Serveer met zure room en koriander."}]'::jsonb,
ARRAY['Comfort Food', 'Vlees', 'Budget'], 'Comfort Food'),

(gen_random_uuid(), 'Aardappelpuree met Worst', 'Klassieke Nederlandse maaltijd met romige puree en gebakken worst.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=80', 15, 30, 45, 'Makkelijk', 4,
'[{"name": "aardappelen", "quantity": "1", "unit": "kg"}, {"name": "worst", "quantity": "4", "unit": "stuk"}, {"name": "boter", "quantity": "50", "unit": "g"}, {"name": "melk", "quantity": "100", "unit": "ml"}, {"name": "ui", "quantity": "2", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Kook de aardappelen gaar in gezouten water."}, {"step": 2, "instruction": "Giet af en stamp fijn met boter en melk."}, {"step": 3, "instruction": "Bak de worst goudbruin in een pan."}, {"step": 4, "instruction": "Bak de ui in ringen tot goudbruin."}, {"step": 5, "instruction": "Serveer puree met worst en gebakken ui."}]'::jsonb,
ARRAY['Comfort Food', 'Budget', 'Quick'], 'Comfort Food'),

(gen_random_uuid(), 'Lasagne Bolognese', 'Lagen van pasta, gehakt en kaas in een rijke tomatensaus. Het ultieme comfort food.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=800&q=80', 30, 60, 90, 'Gemiddeld', 8,
'[{"name": "lasagne bladen", "quantity": "12", "unit": "stuk"}, {"name": "rundvleesgehakt", "quantity": "500", "unit": "g"}, {"name": "tomaten", "quantity": "800", "unit": "g"}, {"name": "mozzarella", "quantity": "300", "unit": "g"}, {"name": "parmezaan", "quantity": "100", "unit": "g"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}]'::jsonb,
'[{"step": 1, "instruction": "Bak het gehakt rul. Voeg ui en knoflook toe."}, {"step": 2, "instruction": "Voeg tomaten toe en laat 30 minuten pruttelen."}, {"step": 3, "instruction": "Maak bechamelsaus met boter, bloem en melk."}, {"step": 4, "instruction": "Leg lagen van pasta, saus en kaas in een ovenschaal."}, {"step": 5, "instruction": "Bak 45 minuten op 180°C tot goudbruin."}]'::jsonb,
ARRAY['Comfort Food', 'Italiaans', 'Vlees'], 'Comfort Food'),

(gen_random_uuid(), 'Stoofvlees met Friet', 'Belgisch klassieker: mals gestoofd rundvlees in bier met krokante frietjes.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=80', 20, 120, 140, 'Gemiddeld', 4,
'[{"name": "rundvlees", "quantity": "800", "unit": "g"}, {"name": "ui", "quantity": "3", "unit": "stuk"}, {"name": "donker bier", "quantity": "500", "unit": "ml"}, {"name": "appelstroop", "quantity": "2", "unit": "el"}, {"name": "lauurier", "quantity": "2", "unit": "blad"}, {"name": "tijm", "quantity": "3", "unit": "takjes"}, {"name": "aardappelen", "quantity": "1", "unit": "kg"}]'::jsonb,
'[{"step": 1, "instruction": "Bak het vlees rondom aan in een grote pan."}, {"step": 2, "instruction": "Voeg ui toe en bak 5 minuten."}, {"step": 3, "instruction": "Voeg bier, appelstroop en kruiden toe."}, {"step": 4, "instruction": "Laat 2 uur zachtjes stoven tot het vlees mals is."}, {"step": 5, "instruction": "Serveer met krokante frietjes."}]'::jsonb,
ARRAY['Comfort Food', 'Belgisch', 'Vlees', 'Feest'], 'Comfort Food'),

-- Insert 5 Vlees recipes
(gen_random_uuid(), 'Gegrilde Ribeye Steak', 'Perfect gegrilde ribeye met kruidenboter en gebakken groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 2,
'[{"name": "ribeye steak", "quantity": "2", "unit": "stuk"}, {"name": "boter", "quantity": "50", "unit": "g"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}, {"name": "rozemarijn", "quantity": "2", "unit": "takjes"}, {"name": "asperges", "quantity": "300", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Laat de steak op kamertemperatuur komen."}, {"step": 2, "instruction": "Kruid rijkelijk met zout en peper."}, {"step": 3, "instruction": "Grill 4-5 minuten per kant voor medium-rare."}, {"step": 4, "instruction": "Maak kruidenboter met boter, knoflook en rozemarijn."}, {"step": 5, "instruction": "Laat rusten 5 minuten. Serveer met gebakken asperges."}]'::jsonb,
ARRAY['Vlees', 'High Protein', 'Quick'], 'Vlees'),

(gen_random_uuid(), 'Braised Short Ribs', 'Mals gestoofde short ribs in rode wijn met wortelen en prei.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 30, 180, 210, 'Moeilijk', 4,
'[{"name": "short ribs", "quantity": "1.2", "unit": "kg"}, {"name": "rode wijn", "quantity": "750", "unit": "ml"}, {"name": "wortelen", "quantity": "4", "unit": "stuk"}, {"name": "prei", "quantity": "2", "unit": "stuk"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "tijm", "quantity": "5", "unit": "takjes"}]'::jsonb,
'[{"step": 1, "instruction": "Bak de ribs rondom aan tot goudbruin."}, {"step": 2, "instruction": "Voeg groenten toe en bak 10 minuten."}, {"step": 3, "instruction": "Voeg wijn toe en breng aan de kook."}, {"step": 4, "instruction": "Stoof 3 uur in de oven op 150°C tot mals."}, {"step": 5, "instruction": "Serveer met de gestoofde groenten en jus."}]'::jsonb,
ARRAY['Vlees', 'Feest', 'High Protein'], 'Vlees'),

(gen_random_uuid(), 'Kip Tikka Masala', 'Kruidige kip in romige tomatensaus. Een favoriet uit de Indiase keuken.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80', 20, 30, 50, 'Gemiddeld', 4,
'[{"name": "kipfilet", "quantity": "600", "unit": "g"}, {"name": "yoghurt", "quantity": "200", "unit": "ml"}, {"name": "garam masala", "quantity": "2", "unit": "tl"}, {"name": "tomaten", "quantity": "400", "unit": "g"}, {"name": "kokosmelk", "quantity": "400", "unit": "ml"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "gember", "quantity": "2", "unit": "cm"}]'::jsonb,
'[{"step": 1, "instruction": "Marineer kip in yoghurt en garam masala 2 uur."}, {"step": 2, "instruction": "Grill de kip 10 minuten tot goudbruin."}, {"step": 3, "instruction": "Bak ui en gember. Voeg tomaten toe."}, {"step": 4, "instruction": "Pureer de saus. Voeg kokosmelk en kip toe."}, {"step": 5, "instruction": "Laat 15 minuten pruttelen. Serveer met rijst."}]'::jsonb,
ARRAY['Vlees', 'Aziatisch', 'High Protein'], 'Vlees'),

(gen_random_uuid(), 'Varkenshaas met Appel', 'Malse varkenshaas met gebakken appel en rode kool.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 20, 25, 45, 'Gemiddeld', 4,
'[{"name": "varkenshaas", "quantity": "600", "unit": "g"}, {"name": "appels", "quantity": "3", "unit": "stuk"}, {"name": "rode kool", "quantity": "500", "unit": "g"}, {"name": "appelazijn", "quantity": "2", "unit": "el"}, {"name": "boter", "quantity": "30", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Kruid de varkenshaas met zout en peper."}, {"step": 2, "instruction": "Bak de haas 6-8 minuten per kant."}, {"step": 3, "instruction": "Bak appelschijfjes in boter tot goudbruin."}, {"step": 4, "instruction": "Stoof rode kool met appelazijn 20 minuten."}, {"step": 5, "instruction": "Serveer varkenshaas met appel en rode kool."}]'::jsonb,
ARRAY['Vlees', 'Comfort Food'], 'Vlees'),

(gen_random_uuid(), 'Lamsrack met Munt', 'Perfect geroosterde lamsrack met muntjus en gebakken aardappelen.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 15, 30, 45, 'Gemiddeld', 4,
'[{"name": "lamsrack", "quantity": "800", "unit": "g"}, {"name": "munt", "quantity": "1", "unit": "bos"}, {"name": "knoflook", "quantity": "3", "unit": "teentjes"}, {"name": "olijfolie", "quantity": "3", "unit": "el"}, {"name": "aardappelen", "quantity": "600", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Marineer lamsrack met olie, knoflook en munt 2 uur."}, {"step": 2, "instruction": "Rooster 20-25 minuten op 200°C voor medium."}, {"step": 3, "instruction": "Bak aardappelen krokant in de oven."}, {"step": 4, "instruction": "Maak muntjus met munt, olie en citroensap."}, {"step": 5, "instruction": "Laat vlees 10 minuten rusten. Serveer met jus."}]'::jsonb,
ARRAY['Vlees', 'Feest', 'High Protein'], 'Vlees'),

-- Insert 5 Vis recipes
(gen_random_uuid(), 'Gegrilde Zalm met Dille', 'Verse zalm met dillesaus en gebakken groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'[{"name": "zalmfilet", "quantity": "600", "unit": "g"}, {"name": "dille", "quantity": "1", "unit": "bos"}, {"name": "citroen", "quantity": "2", "unit": "stuk"}, {"name": "olijfolie", "quantity": "3", "unit": "el"}, {"name": "broccoli", "quantity": "400", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Kruid zalm met zout, peper en dille."}, {"step": 2, "instruction": "Grill zalm 4-5 minuten per kant."}, {"step": 3, "instruction": "Maak dillesaus met dille, olie en citroensap."}, {"step": 4, "instruction": "Stoom broccoli 5 minuten."}, {"step": 5, "instruction": "Serveer zalm met dillesaus en broccoli."}]'::jsonb,
ARRAY['Vis', 'High Protein', 'Gezond', 'Quick'], 'Vis'),

(gen_random_uuid(), 'Garnalen Scampi', 'Grote garnalen in knoflookboter met witte wijn en peterselie.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', 10, 10, 20, 'Makkelijk', 2,
'[{"name": "garnalen", "quantity": "400", "unit": "g"}, {"name": "knoflook", "quantity": "4", "unit": "teentjes"}, {"name": "boter", "quantity": "50", "unit": "g"}, {"name": "witte wijn", "quantity": "100", "unit": "ml"}, {"name": "peterselie", "quantity": "1", "unit": "bos"}, {"name": "citroen", "quantity": "1", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Pel de garnalen maar laat de staart zitten."}, {"step": 2, "instruction": "Smelt boter in een pan. Bak knoflook 1 minuut."}, {"step": 3, "instruction": "Voeg garnalen toe en bak 2 minuten per kant."}, {"step": 4, "instruction": "Voeg wijn toe en laat 2 minuten pruttelen."}, {"step": 5, "instruction": "Bestrooi met peterselie en serveer met citroen."}]'::jsonb,
ARRAY['Vis', 'Quick', 'High Protein'], 'Vis'),

(gen_random_uuid(), 'Tonijn Tataki', 'Seared tonijn met sesamkorst en soja-gemberdressing.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 15, 5, 20, 'Gemiddeld', 4,
'[{"name": "tonijnsteak", "quantity": "600", "unit": "g"}, {"name": "sesamzaad", "quantity": "50", "unit": "g"}, {"name": "sojasaus", "quantity": "3", "unit": "el"}, {"name": "gember", "quantity": "2", "unit": "cm"}, {"name": "lente-ui", "quantity": "4", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Rol tonijn in sesamzaad."}, {"step": 2, "instruction": "Seer snel 30 seconden per kant in hete pan."}, {"step": 3, "instruction": "Snijd in plakjes."}, {"step": 4, "instruction": "Maak dressing met soja, gember en olie."}, {"step": 5, "instruction": "Serveer met dressing en lente-ui."}]'::jsonb,
ARRAY['Vis', 'Aziatisch', 'High Protein', 'Gezond'], 'Vis'),

(gen_random_uuid(), 'Kabeljauw met Chorizo', 'Witte kabeljauw met pittige chorizo en tomaten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 15, 20, 35, 'Gemiddeld', 4,
'[{"name": "kabeljauwfilet", "quantity": "600", "unit": "g"}, {"name": "chorizo", "quantity": "200", "unit": "g"}, {"name": "tomaten", "quantity": "400", "unit": "g"}, {"name": "knoflook", "quantity": "3", "unit": "teentjes"}, {"name": "witte wijn", "quantity": "100", "unit": "ml"}]'::jsonb,
'[{"step": 1, "instruction": "Bak chorizo uit in een pan."}, {"step": 2, "instruction": "Voeg knoflook en tomaten toe."}, {"step": 3, "instruction": "Voeg wijn toe en laat 10 minuten pruttelen."}, {"step": 4, "instruction": "Leg kabeljauw op de saus en stoom 8 minuten."}, {"step": 5, "instruction": "Serveer met de chorizo-tomatensaus."}]'::jsonb,
ARRAY['Vis', 'Spaans', 'High Protein'], 'Vis'),

(gen_random_uuid(), 'Mosselen met Witte Wijn', 'Verse mosselen gekookt in witte wijn met prei en knoflook.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'[{"name": "mosselen", "quantity": "2", "unit": "kg"}, {"name": "witte wijn", "quantity": "250", "unit": "ml"}, {"name": "prei", "quantity": "2", "unit": "stuk"}, {"name": "knoflook", "quantity": "3", "unit": "teentjes"}, {"name": "peterselie", "quantity": "1", "unit": "bos"}, {"name": "boter", "quantity": "30", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Spoel mosselen en verwijder kapotte exemplaren."}, {"step": 2, "instruction": "Bak prei en knoflook in boter 5 minuten."}, {"step": 3, "instruction": "Voeg wijn toe en breng aan de kook."}, {"step": 4, "instruction": "Voeg mosselen toe en kook 5-7 minuten tot ze open zijn."}, {"step": 5, "instruction": "Bestrooi met peterselie. Serveer met frietjes."}]'::jsonb,
ARRAY['Vis', 'Belgisch', 'Feest'], 'Vis'),

-- Insert 5 Feest recipes
(gen_random_uuid(), 'Beef Wellington', 'Klassiek feestgerecht: rundvlees in bladerdeeg met paté en champignons.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 60, 45, 105, 'Moeilijk', 6,
'[{"name": "rundvleeshaas", "quantity": "1", "unit": "kg"}, {"name": "bladerdeeg", "quantity": "500", "unit": "g"}, {"name": "paté", "quantity": "200", "unit": "g"}, {"name": "champignons", "quantity": "300", "unit": "g"}, {"name": "pancetta", "quantity": "100", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Bak de haas rondom aan. Laat afkoelen."}, {"step": 2, "instruction": "Bak champignons en pancetta fijn."}, {"step": 3, "instruction": "Smeer paté op de haas. Bedek met champignonmengsel."}, {"step": 4, "instruction": "Wikkel in bladerdeeg en bak 25 minuten op 200°C."}, {"step": 5, "instruction": "Laat 15 minuten rusten. Snijd in plakken."}]'::jsonb,
ARRAY['Feest', 'Vlees', 'High Protein'], 'Feest'),

(gen_random_uuid(), 'Coq au Vin', 'Klassieke Franse kip in rode wijn met spek en champignons.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 30, 90, 120, 'Moeilijk', 6,
'[{"name": "kip", "quantity": "1.5", "unit": "kg"}, {"name": "rode wijn", "quantity": "750", "unit": "ml"}, {"name": "spek", "quantity": "200", "unit": "g"}, {"name": "champignons", "quantity": "300", "unit": "g"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "wortelen", "quantity": "3", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Bak spek uit. Bak kipstukken goudbruin."}, {"step": 2, "instruction": "Voeg groenten toe en bak 10 minuten."}, {"step": 3, "instruction": "Voeg wijn toe en breng aan de kook."}, {"step": 4, "instruction": "Stoof 1.5 uur tot kip mals is."}, {"step": 5, "instruction": "Voeg champignons toe laatste 15 minuten. Serveer."}]'::jsonb,
ARRAY['Feest', 'Frans', 'Vlees'], 'Feest'),

(gen_random_uuid(), 'Paella Valenciana', 'Traditionele Spaanse rijstschotel met kip, konijn en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 30, 45, 75, 'Gemiddeld', 6,
'[{"name": "paella rijst", "quantity": "400", "unit": "g"}, {"name": "kip", "quantity": "600", "unit": "g"}, {"name": "konijn", "quantity": "400", "unit": "g"}, {"name": "saffraan", "quantity": "1", "unit": "snufje"}, {"name": "paprika", "quantity": "2", "unit": "stuk"}, {"name": "tomaten", "quantity": "400", "unit": "g"}, {"name": "knoflook", "quantity": "4", "unit": "teentjes"}]'::jsonb,
'[{"step": 1, "instruction": "Bak kip en konijn goudbruin in paellapan."}, {"step": 2, "instruction": "Voeg groenten toe en bak 10 minuten."}, {"step": 3, "instruction": "Voeg rijst en saffraan toe. Roer goed."}, {"step": 4, "instruction": "Voeg bouillon toe en kook 20 minuten zonder te roeren."}, {"step": 5, "instruction": "Laat 10 minuten rusten. Serveer direct uit de pan."}]'::jsonb,
ARRAY['Feest', 'Spaans', 'Comfort Food'], 'Feest'),

(gen_random_uuid(), 'Osso Buco', 'Malse kalfsschenkel gestoofd in witte wijn met gremolata.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80', 30, 120, 150, 'Moeilijk', 4,
'[{"name": "kalfsschenkel", "quantity": "4", "unit": "stuk"}, {"name": "witte wijn", "quantity": "300", "unit": "ml"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "wortelen", "quantity": "2", "unit": "stuk"}, {"name": "selderij", "quantity": "2", "unit": "stuk"}, {"name": "citroenschil", "quantity": "1", "unit": "stuk"}, {"name": "peterselie", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Bak de schenkels goudbruin rondom."}, {"step": 2, "instruction": "Voeg groenten toe en bak 10 minuten."}, {"step": 3, "instruction": "Voeg wijn en bouillon toe. Breng aan de kook."}, {"step": 4, "instruction": "Stoof 2 uur in de oven op 160°C tot mals."}, {"step": 5, "instruction": "Maak gremolata met citroenschil en peterselie. Serveer."}]'::jsonb,
ARRAY['Feest', 'Italiaans', 'Vlees'], 'Feest'),

(gen_random_uuid(), 'Duck à l\'Orange', 'Eend met sinaasappelsaus. Een klassiek Frans feestgerecht.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', 30, 90, 120, 'Moeilijk', 4,
'[{"name": "eend", "quantity": "1.5", "unit": "kg"}, {"name": "sinaasappels", "quantity": "4", "unit": "stuk"}, {"name": "sinaasappellikeur", "quantity": "50", "unit": "ml"}, {"name": "bouillon", "quantity": "500", "unit": "ml"}, {"name": "boter", "quantity": "30", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Prijs de eendenhuid in. Kruid met zout en peper."}, {"step": 2, "instruction": "Bak eend 20 minuten op 200°C. Verlaag naar 180°C."}, {"step": 3, "instruction": "Bak verder 1 uur tot huid krokant is."}, {"step": 4, "instruction": "Maak saus met sinaasappelsap, likeur en bouillon."}, {"step": 5, "instruction": "Serveer eend met sinaasappelsaus en partjes."}]'::jsonb,
ARRAY['Feest', 'Frans', 'Vlees'], 'Feest'),

-- Insert 5 High Protein recipes
(gen_random_uuid(), 'Kipfilet met Quinoa', 'Gegrilde kipfilet met quinoa en groene groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', 15, 25, 40, 'Makkelijk', 4,
'[{"name": "kipfilet", "quantity": "600", "unit": "g"}, {"name": "quinoa", "quantity": "300", "unit": "g"}, {"name": "broccoli", "quantity": "400", "unit": "g"}, {"name": "sperziebonen", "quantity": "300", "unit": "g"}, {"name": "olijfolie", "quantity": "3", "unit": "el"}]'::jsonb,
'[{"step": 1, "instruction": "Kruid kipfilet met zout en peper."}, {"step": 2, "instruction": "Grill kip 6-8 minuten per kant."}, {"step": 3, "instruction": "Kook quinoa volgens verpakking."}, {"step": 4, "instruction": "Stoom broccoli en sperziebonen 5 minuten."}, {"step": 5, "instruction": "Serveer kip met quinoa en groenten."}]'::jsonb,
ARRAY['High Protein', 'Gezond', 'Quick'], 'High Protein'),

(gen_random_uuid(), 'Zalm Bowl met Edamame', 'Geroosterde zalm met edamame, rijst en groenten in een kom.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 20, 20, 40, 'Makkelijk', 2,
'[{"name": "zalmfilet", "quantity": "300", "unit": "g"}, {"name": "edamame", "quantity": "200", "unit": "g"}, {"name": "rijst", "quantity": "200", "unit": "g"}, {"name": "komkommer", "quantity": "1", "unit": "stuk"}, {"name": "wortel", "quantity": "1", "unit": "stuk"}, {"name": "avocado", "quantity": "1", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Rooster zalm 15 minuten op 200°C."}, {"step": 2, "instruction": "Kook rijst en edamame."}, {"step": 3, "instruction": "Snijd groenten in reepjes."}, {"step": 4, "instruction": "Rangschik alles in een kom."}, {"step": 5, "instruction": "Serveer met sojasaus of sesamdressing."}]'::jsonb,
ARRAY['High Protein', 'Gezond', 'Aziatisch'], 'High Protein'),

(gen_random_uuid(), 'Biefstuk met Zoete Aardappel', 'Perfect gegrilde biefstuk met gebakken zoete aardappel.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=80', 15, 25, 40, 'Makkelijk', 2,
'[{"name": "biefstuk", "quantity": "400", "unit": "g"}, {"name": "zoete aardappel", "quantity": "2", "unit": "stuk"}, {"name": "broccoli", "quantity": "300", "unit": "g"}, {"name": "olijfolie", "quantity": "2", "unit": "el"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}]'::jsonb,
'[{"step": 1, "instruction": "Laat biefstuk op kamertemperatuur komen."}, {"step": 2, "instruction": "Bak zoete aardappel in plakken 20 minuten."}, {"step": 3, "instruction": "Grill biefstuk 4-5 minuten per kant."}, {"step": 4, "instruction": "Stoom broccoli met knoflook."}, {"step": 5, "instruction": "Laat vlees rusten 5 minuten. Serveer."}]'::jsonb,
ARRAY['High Protein', 'Vlees', 'Gezond'], 'High Protein'),

(gen_random_uuid(), 'Tonijn Steak met Bonen', 'Gegrilde tonijnsteak met witte bonen en spinazie.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 2,
'[{"name": "tonijnsteak", "quantity": "300", "unit": "g"}, {"name": "witte bonen", "quantity": "400", "unit": "g"}, {"name": "spinazie", "quantity": "200", "unit": "g"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}, {"name": "citroen", "quantity": "1", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Kruid tonijn met zout en peper."}, {"step": 2, "instruction": "Grill tonijn 2-3 minuten per kant."}, {"step": 3, "instruction": "Bak knoflook. Voeg bonen toe en warm door."}, {"step": 4, "instruction": "Voeg spinazie toe en laat slinken."}, {"step": 5, "instruction": "Serveer tonijn met bonen en spinazie. Besprenkel met citroen."}]'::jsonb,
ARRAY['High Protein', 'Vis', 'Gezond', 'Quick'], 'High Protein'),

(gen_random_uuid(), 'Kalkoen Burger', 'Mager kalkoenburger met volkorenbroodje en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=80', 20, 15, 35, 'Makkelijk', 4,
'[{"name": "kalkoengehakt", "quantity": "500", "unit": "g"}, {"name": "volkorenbroodjes", "quantity": "4", "unit": "stuk"}, {"name": "sla", "quantity": "100", "unit": "g"}, {"name": "tomaat", "quantity": "2", "unit": "stuk"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "avocado", "quantity": "1", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Vorm burgers van het kalkoengehakt."}, {"step": 2, "instruction": "Grill burgers 6-7 minuten per kant."}, {"step": 3, "instruction": "Rooster de broodjes licht."}, {"step": 4, "instruction": "Snijd groenten in plakken."}, {"step": 5, "instruction": "Bouw burgers met groenten en serveer."}]'::jsonb,
ARRAY['High Protein', 'Quick', 'Gezond'], 'High Protein'),

-- Insert 5 Italiaans recipes
(gen_random_uuid(), 'Spaghetti Carbonara', 'Klassieke Romeinse pasta met eieren, spek en pecorino.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'[{"name": "spaghetti", "quantity": "400", "unit": "g"}, {"name": "pancetta", "quantity": "200", "unit": "g"}, {"name": "eieren", "quantity": "4", "unit": "stuk"}, {"name": "pecorino", "quantity": "100", "unit": "g"}, {"name": "zwarte peper", "quantity": "1", "unit": "tl"}]'::jsonb,
'[{"step": 1, "instruction": "Kook spaghetti volgens verpakking."}, {"step": 2, "instruction": "Bak pancetta krokant in een pan."}, {"step": 3, "instruction": "Klop eieren met geraspte pecorino."}, {"step": 4, "instruction": "Meng pasta met pancetta en vet."}, {"step": 5, "instruction": "Voeg eimengsel toe en roer snel. Bestrooi met peper."}]'::jsonb,
ARRAY['Italiaans', 'Comfort Food', 'Quick'], 'Italiaans'),

(gen_random_uuid(), 'Risotto ai Funghi', 'Romige risotto met verse champignons en parmezaan.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 15, 30, 45, 'Gemiddeld', 4,
'[{"name": "risotto rijst", "quantity": "300", "unit": "g"}, {"name": "champignons", "quantity": "400", "unit": "g"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "witte wijn", "quantity": "150", "unit": "ml"}, {"name": "bouillon", "quantity": "1", "unit": "liter"}, {"name": "parmezaan", "quantity": "100", "unit": "g"}, {"name": "boter", "quantity": "30", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Bak champignons goudbruin. Zet apart."}, {"step": 2, "instruction": "Fruit ui in boter. Voeg rijst toe en roer 2 minuten."}, {"step": 3, "instruction": "Voeg wijn toe en roer tot opgenomen."}, {"step": 4, "instruction": "Voeg bouillon scheut voor scheut toe, blijf roeren."}, {"step": 5, "instruction": "Voeg champignons, boter en parmezaan toe. Serveer direct."}]'::jsonb,
ARRAY['Italiaans', 'Comfort Food'], 'Italiaans'),

(gen_random_uuid(), 'Margherita Pizza', 'Klassieke pizza met tomaten, mozzarella en basilicum.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80', 60, 15, 75, 'Gemiddeld', 4,
'[{"name": "pizzadeeg", "quantity": "500", "unit": "g"}, {"name": "tomaten", "quantity": "400", "unit": "g"}, {"name": "mozzarella", "quantity": "250", "unit": "g"}, {"name": "basilicum", "quantity": "1", "unit": "bos"}, {"name": "olijfolie", "quantity": "2", "unit": "el"}]'::jsonb,
'[{"step": 1, "instruction": "Maak pizzadeeg en laat 1 uur rijzen."}, {"step": 2, "instruction": "Rol deeg uit tot pizzabodem."}, {"step": 3, "instruction": "Bestrijk met tomatensaus."}, {"step": 4, "instruction": "Beleg met mozzarella en bak 12-15 minuten op 250°C."}, {"step": 5, "instruction": "Bestrooi met basilicum en olijfolie. Serveer."}]'::jsonb,
ARRAY['Italiaans', 'Comfort Food', 'Budget'], 'Italiaans'),

(gen_random_uuid(), 'Penne all\'Arrabbiata', 'Pittige pasta met tomaten, knoflook en rode peper.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'[{"name": "penne", "quantity": "400", "unit": "g"}, {"name": "tomaten", "quantity": "800", "unit": "g"}, {"name": "knoflook", "quantity": "4", "unit": "teentjes"}, {"name": "rode peper", "quantity": "2", "unit": "stuk"}, {"name": "olijfolie", "quantity": "3", "unit": "el"}, {"name": "peterselie", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Kook penne volgens verpakking."}, {"step": 2, "instruction": "Bak knoflook en peper in olie 2 minuten."}, {"step": 3, "instruction": "Voeg tomaten toe en laat 15 minuten pruttelen."}, {"step": 4, "instruction": "Pureer de saus grof."}, {"step": 5, "instruction": "Meng met pasta. Bestrooi met peterselie."}]'::jsonb,
ARRAY['Italiaans', 'Quick', 'Budget'], 'Italiaans'),

(gen_random_uuid(), 'Osso Buco alla Milanese', 'Kalfsschenkel gestoofd in witte wijn met risotto.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80', 30, 120, 150, 'Moeilijk', 4,
'[{"name": "kalfsschenkel", "quantity": "4", "unit": "stuk"}, {"name": "witte wijn", "quantity": "300", "unit": "ml"}, {"name": "risotto rijst", "quantity": "300", "unit": "g"}, {"name": "saffraan", "quantity": "1", "unit": "snufje"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "wortelen", "quantity": "2", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Bak schenkels goudbruin."}, {"step": 2, "instruction": "Voeg groenten en wijn toe. Stoof 2 uur."}, {"step": 3, "instruction": "Maak risotto met saffraan."}, {"step": 4, "instruction": "Serveer osso buco met risotto alla milanese."}, {"step": 5, "instruction": "Bestrooi met gremolata (citroenschil en peterselie)."}]'::jsonb,
ARRAY['Italiaans', 'Feest', 'Vlees'], 'Italiaans'),

-- Insert 5 Aziatisch recipes
(gen_random_uuid(), 'Pad Thai', 'Klassieke Thaise noedels met kip, garnalen en pindas.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=800&q=80', 20, 15, 35, 'Gemiddeld', 4,
'[{"name": "rijstnoedels", "quantity": "400", "unit": "g"}, {"name": "kipfilet", "quantity": "300", "unit": "g"}, {"name": "garnalen", "quantity": "200", "unit": "g"}, {"name": "taugé", "quantity": "200", "unit": "g"}, {"name": "pindas", "quantity": "50", "unit": "g"}, {"name": "lente-ui", "quantity": "4", "unit": "stuk"}, {"name": "tamarindepasta", "quantity": "2", "unit": "el"}]'::jsonb,
'[{"step": 1, "instruction": "Week noedels 30 minuten in warm water."}, {"step": 2, "instruction": "Bak kip en garnalen in wok."}, {"step": 3, "instruction": "Voeg noedels en tamarindesaus toe."}, {"step": 4, "instruction": "Roerbak 3 minuten. Voeg taugé toe."}, {"step": 5, "instruction": "Serveer met pindas, lente-ui en limoen."}]'::jsonb,
ARRAY['Aziatisch', 'Quick', 'High Protein'], 'Aziatisch'),

(gen_random_uuid(), 'Beef Teriyaki', 'Malse biefstuk in zoete teriyakisaus met rijst.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80', 15, 20, 35, 'Makkelijk', 4,
'[{"name": "biefstuk", "quantity": "600", "unit": "g"}, {"name": "sojasaus", "quantity": "100", "unit": "ml"}, {"name": "mirin", "quantity": "50", "unit": "ml"}, {"name": "suiker", "quantity": "2", "unit": "el"}, {"name": "gember", "quantity": "2", "unit": "cm"}, {"name": "rijst", "quantity": "400", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd biefstuk in reepjes."}, {"step": 2, "instruction": "Maak teriyakisaus met soja, mirin en suiker."}, {"step": 3, "instruction": "Bak biefstuk snel in wok."}, {"step": 4, "instruction": "Voeg saus toe en laat 5 minuten pruttelen."}, {"step": 5, "instruction": "Serveer met rijst en gember."}]'::jsonb,
ARRAY['Aziatisch', 'Vlees', 'High Protein', 'Quick'], 'Aziatisch'),

(gen_random_uuid(), 'Chicken Satay', 'Gegrilde kipspiesjes met pindasaus en rijst.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80', 30, 15, 45, 'Gemiddeld', 4,
'[{"name": "kipfilet", "quantity": "600", "unit": "g"}, {"name": "kokosmelk", "quantity": "200", "unit": "ml"}, {"name": "kerrie", "quantity": "2", "unit": "tl"}, {"name": "pindas", "quantity": "100", "unit": "g"}, {"name": "sojasaus", "quantity": "2", "unit": "el"}, {"name": "rijst", "quantity": "400", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd kip in reepjes. Marineer in kokosmelk en kerrie."}, {"step": 2, "instruction": "Rijg aan satéstokjes."}, {"step": 3, "instruction": "Grill 8-10 minuten tot goudbruin."}, {"step": 4, "instruction": "Maak pindasaus met pindas, soja en kokosmelk."}, {"step": 5, "instruction": "Serveer met rijst en pindasaus."}]'::jsonb,
ARRAY['Aziatisch', 'Vlees', 'High Protein'], 'Aziatisch'),

(gen_random_uuid(), 'Ramen met Kip', 'Rijke noedelsoep met kip, ei en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 20, 30, 50, 'Gemiddeld', 4,
'[{"name": "ramen noedels", "quantity": "400", "unit": "g"}, {"name": "kipfilet", "quantity": "400", "unit": "g"}, {"name": "eieren", "quantity": "4", "unit": "stuk"}, {"name": "bouillon", "quantity": "1.5", "unit": "liter"}, {"name": "sojasaus", "quantity": "3", "unit": "el"}, {"name": "lente-ui", "quantity": "4", "unit": "stuk"}, {"name": "zeewier", "quantity": "4", "unit": "vel"}]'::jsonb,
'[{"step": 1, "instruction": "Kook kip in bouillon 20 minuten. Haal eruit en snijd."}, {"step": 2, "instruction": "Kook eieren zacht 6 minuten."}, {"step": 3, "instruction": "Kook noedels volgens verpakking."}, {"step": 4, "instruction": "Verwarm bouillon met sojasaus."}, {"step": 5, "instruction": "Serveer noedels in bouillon met kip, ei, lente-ui en zeewier."}]'::jsonb,
ARRAY['Aziatisch', 'Comfort Food', 'High Protein'], 'Aziatisch'),

(gen_random_uuid(), 'Sushi Bowl', 'Bowl met zalm, rijst, avocado en groenten in sushistijl.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=800&q=80', 30, 20, 50, 'Gemiddeld', 2,
'[{"name": "sushirijst", "quantity": "200", "unit": "g"}, {"name": "zalm", "quantity": "200", "unit": "g"}, {"name": "avocado", "quantity": "1", "unit": "stuk"}, {"name": "komkommer", "quantity": "1", "unit": "stuk"}, {"name": "zeewier", "quantity": "2", "unit": "vel"}, {"name": "sojasaus", "quantity": "2", "unit": "el"}, {"name": "wasabi", "quantity": "1", "unit": "tl"}]'::jsonb,
'[{"step": 1, "instruction": "Kook sushirijst en laat afkoelen."}, {"step": 2, "instruction": "Snijd zalm in blokjes."}, {"step": 3, "instruction": "Snijd avocado en komkommer in reepjes."}, {"step": 4, "instruction": "Rangschik rijst in kom met zalm en groenten."}, {"step": 5, "instruction": "Serveer met sojasaus, wasabi en zeewier."}]'::jsonb,
ARRAY['Aziatisch', 'Vis', 'Gezond', 'High Protein'], 'Aziatisch'),

-- Insert 5 Plant-based recipes
(gen_random_uuid(), 'Vegan Buddha Bowl', 'Kleurrijke bowl met quinoa, kikkererwten en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', 20, 25, 45, 'Makkelijk', 2,
'[{"name": "quinoa", "quantity": "200", "unit": "g"}, {"name": "kikkererwten", "quantity": "400", "unit": "g"}, {"name": "zoete aardappel", "quantity": "1", "unit": "stuk"}, {"name": "broccoli", "quantity": "200", "unit": "g"}, {"name": "avocado", "quantity": "1", "unit": "stuk"}, {"name": "tahini", "quantity": "2", "unit": "el"}]'::jsonb,
'[{"step": 1, "instruction": "Kook quinoa volgens verpakking."}, {"step": 2, "instruction": "Rooster kikkererwten en zoete aardappel 25 minuten."}, {"step": 3, "instruction": "Stoom broccoli 5 minuten."}, {"step": 4, "instruction": "Maak tahinidressing met tahini, citroen en water."}, {"step": 5, "instruction": "Rangschik alles in kom. Serveer met dressing."}]'::jsonb,
ARRAY['Plant-based', 'Vegan', 'Gezond', 'High Protein'], 'Plant-based'),

(gen_random_uuid(), 'Tofu Curry', 'Kruidige curry met tofu en groenten in kokosmelk.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80', 15, 25, 40, 'Makkelijk', 4,
'[{"name": "tofu", "quantity": "400", "unit": "g"}, {"name": "kokosmelk", "quantity": "400", "unit": "ml"}, {"name": "curry pasta", "quantity": "2", "unit": "el"}, {"name": "groenten", "quantity": "400", "unit": "g"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "rijst", "quantity": "400", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd tofu in blokjes en bak goudbruin."}, {"step": 2, "instruction": "Bak ui en currypasta 2 minuten."}, {"step": 3, "instruction": "Voeg kokosmelk en groenten toe."}, {"step": 4, "instruction": "Laat 15 minuten pruttelen."}, {"step": 5, "instruction": "Voeg tofu toe. Serveer met rijst."}]'::jsonb,
ARRAY['Plant-based', 'Vegan', 'Aziatisch'], 'Plant-based'),

(gen_random_uuid(), 'Lentil Bolognese', 'Hartige linzensaus met pasta. Vegan alternatief voor bolognese.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 15, 30, 45, 'Makkelijk', 4,
'[{"name": "linzen", "quantity": "400", "unit": "g"}, {"name": "pasta", "quantity": "400", "unit": "g"}, {"name": "tomaten", "quantity": "800", "unit": "g"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "knoflook", "quantity": "3", "unit": "teentjes"}, {"name": "wortelen", "quantity": "2", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Kook linzen gaar."}, {"step": 2, "instruction": "Bak ui, knoflook en wortelen 10 minuten."}, {"step": 3, "instruction": "Voeg tomaten en linzen toe."}, {"step": 4, "instruction": "Laat 30 minuten pruttelen."}, {"step": 5, "instruction": "Serveer met pasta en basilicum."}]'::jsonb,
ARRAY['Plant-based', 'Vegan', 'Budget', 'High Protein'], 'Plant-based'),

(gen_random_uuid(), 'Chickpea Burger', 'Krokante kikkererwtenburger met volkorenbroodje.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=80', 20, 20, 40, 'Makkelijk', 4,
'[{"name": "kikkererwten", "quantity": "400", "unit": "g"}, {"name": "broodkruim", "quantity": "100", "unit": "g"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}, {"name": "komijn", "quantity": "1", "unit": "tl"}, {"name": "volkorenbroodjes", "quantity": "4", "unit": "stuk"}]'::jsonb,
'[{"step": 1, "instruction": "Pureer kikkererwten grof."}, {"step": 2, "instruction": "Meng met ui, knoflook, komijn en broodkruim."}, {"step": 3, "instruction": "Vorm burgers en bak 8 minuten per kant."}, {"step": 4, "instruction": "Serveer in volkorenbroodje met groenten."}, {"step": 5, "instruction": "Bestrooi met tahinidressing."}]'::jsonb,
ARRAY['Plant-based', 'Vegan', 'High Protein', 'Budget'], 'Plant-based'),

(gen_random_uuid(), 'Ratatouille', 'Provençaalse groenteschotel met aubergine, courgette en tomaten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?auto=format&fit=crop&w=800&q=80', 30, 45, 75, 'Gemiddeld', 6,
'[{"name": "aubergine", "quantity": "2", "unit": "stuk"}, {"name": "courgette", "quantity": "2", "unit": "stuk"}, {"name": "paprika", "quantity": "3", "unit": "stuk"}, {"name": "tomaten", "quantity": "800", "unit": "g"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "knoflook", "quantity": "4", "unit": "teentjes"}, {"name": "basilicum", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd alle groenten in plakken."}, {"step": 2, "instruction": "Bak ui en knoflook 5 minuten."}, {"step": 3, "instruction": "Voeg groenten toe en bak 10 minuten."}, {"step": 4, "instruction": "Voeg tomaten toe en laat 30 minuten pruttelen."}, {"step": 5, "instruction": "Bestrooi met basilicum. Serveer warm of koud."}]'::jsonb,
ARRAY['Plant-based', 'Vegan', 'Frans', 'Gezond'], 'Plant-based'),

-- Insert 5 Budget recipes
(gen_random_uuid(), 'Pasta Aglio e Olio', 'Eenvoudige pasta met knoflook en olijfolie. Budgetvriendelijk en lekker.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 5, 10, 15, 'Makkelijk', 4,
'[{"name": "spaghetti", "quantity": "400", "unit": "g"}, {"name": "knoflook", "quantity": "6", "unit": "teentjes"}, {"name": "olijfolie", "quantity": "6", "unit": "el"}, {"name": "rode peper", "quantity": "1", "unit": "stuk"}, {"name": "peterselie", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Kook spaghetti volgens verpakking."}, {"step": 2, "instruction": "Bak knoflook en peper in olie 2 minuten."}, {"step": 3, "instruction": "Voeg pasta toe met kookvocht."}, {"step": 4, "instruction": "Roer goed tot een romige saus ontstaat."}, {"step": 5, "instruction": "Bestrooi met peterselie. Serveer direct."}]'::jsonb,
ARRAY['Budget', 'Italiaans', 'Quick'], 'Budget'),

(gen_random_uuid(), 'Rijst met Bonen', 'Vullende maaltijd met rijst, bonen en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80', 10, 25, 35, 'Makkelijk', 4,
'[{"name": "rijst", "quantity": "400", "unit": "g"}, {"name": "zwarte bonen", "quantity": "400", "unit": "g"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "paprika", "quantity": "2", "unit": "stuk"}, {"name": "komijn", "quantity": "1", "unit": "tl"}, {"name": "koriander", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Kook rijst volgens verpakking."}, {"step": 2, "instruction": "Bak ui en paprika 5 minuten."}, {"step": 3, "instruction": "Voeg bonen en komijn toe."}, {"step": 4, "instruction": "Laat 10 minuten pruttelen."}, {"step": 5, "instruction": "Serveer met rijst en koriander."}]'::jsonb,
ARRAY['Budget', 'Plant-based', 'High Protein'], 'Budget'),

(gen_random_uuid(), 'Omelet met Groenten', 'Vullende omelet met seizoensgroenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1615197349903-9b8b83b8a3a0?auto=format&fit=crop&w=800&q=80', 10, 10, 20, 'Makkelijk', 2,
'[{"name": "eieren", "quantity": "4", "unit": "stuk"}, {"name": "paprika", "quantity": "1", "unit": "stuk"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "champignons", "quantity": "100", "unit": "g"}, {"name": "kaas", "quantity": "50", "unit": "g"}, {"name": "boter", "quantity": "20", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Bak groenten 5 minuten in boter."}, {"step": 2, "instruction": "Klop eieren los met zout en peper."}, {"step": 3, "instruction": "Giet eieren over groenten."}, {"step": 4, "instruction": "Bak 3 minuten. Voeg kaas toe."}, {"step": 5, "instruction": "Vouw dubbel en serveer."}]'::jsonb,
ARRAY['Budget', 'Quick', 'High Protein'], 'Budget'),

(gen_random_uuid(), 'Groentesoep', 'Huisgemaakte groentesoep met seizoensgroenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80', 15, 30, 45, 'Makkelijk', 6,
'[{"name": "wortelen", "quantity": "3", "unit": "stuk"}, {"name": "selderij", "quantity": "3", "unit": "stuk"}, {"name": "ui", "quantity": "2", "unit": "stuk"}, {"name": "aardappelen", "quantity": "3", "unit": "stuk"}, {"name": "bouillon", "quantity": "1.5", "unit": "liter"}, {"name": "peterselie", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd alle groenten in blokjes."}, {"step": 2, "instruction": "Bak ui 5 minuten."}, {"step": 3, "instruction": "Voeg andere groenten toe en bak 5 minuten."}, {"step": 4, "instruction": "Voeg bouillon toe en kook 25 minuten."}, {"step": 5, "instruction": "Bestrooi met peterselie. Serveer warm."}]'::jsonb,
ARRAY['Budget', 'Gezond', 'Plant-based'], 'Budget'),

(gen_random_uuid(), 'Pasta Puttanesca', 'Pittige pasta met ansjovis, kappertjes en olijven.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'[{"name": "pasta", "quantity": "400", "unit": "g"}, {"name": "ansjovis", "quantity": "50", "unit": "g"}, {"name": "kappertjes", "quantity": "2", "unit": "el"}, {"name": "zwarte olijven", "quantity": "100", "unit": "g"}, {"name": "tomaten", "quantity": "400", "unit": "g"}, {"name": "knoflook", "quantity": "3", "unit": "teentjes"}]'::jsonb,
'[{"step": 1, "instruction": "Kook pasta volgens verpakking."}, {"step": 2, "instruction": "Bak ansjovis en knoflook 2 minuten."}, {"step": 3, "instruction": "Voeg tomaten, olijven en kappertjes toe."}, {"step": 4, "instruction": "Laat 10 minuten pruttelen."}, {"step": 5, "instruction": "Meng met pasta. Serveer direct."}]'::jsonb,
ARRAY['Budget', 'Italiaans', 'Quick'], 'Budget'),

-- Insert 5 Quick recipes
(gen_random_uuid(), 'Snelle Wok met Kip', 'Snelle wokschotel met kip en groenten in 20 minuten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80', 10, 10, 20, 'Makkelijk', 4,
'[{"name": "kipfilet", "quantity": "500", "unit": "g"}, {"name": "groentenmix", "quantity": "400", "unit": "g"}, {"name": "sojasaus", "quantity": "3", "unit": "el"}, {"name": "gember", "quantity": "2", "unit": "cm"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}, {"name": "rijst", "quantity": "400", "unit": "g"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd kip in reepjes."}, {"step": 2, "instruction": "Bak kip snel in wok 5 minuten."}, {"step": 3, "instruction": "Voeg groenten, gember en knoflook toe."}, {"step": 4, "instruction": "Roerbak 5 minuten. Voeg sojasaus toe."}, {"step": 5, "instruction": "Serveer met rijst."}]'::jsonb,
ARRAY['Quick', 'Aziatisch', 'High Protein'], 'Quick'),

(gen_random_uuid(), 'Quesadilla', 'Snelle quesadilla met kaas en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?auto=format&fit=crop&w=800&q=80', 5, 10, 15, 'Makkelijk', 2,
'[{"name": "tortilla", "quantity": "4", "unit": "stuk"}, {"name": "cheddar kaas", "quantity": "200", "unit": "g"}, {"name": "paprika", "quantity": "1", "unit": "stuk"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "koriander", "quantity": "1", "unit": "bos"}]'::jsonb,
'[{"step": 1, "instruction": "Snijd groenten fijn."}, {"step": 2, "instruction": "Beleg tortilla met kaas en groenten."}, {"step": 3, "instruction": "Vouw dubbel."}, {"step": 4, "instruction": "Bak 3-4 minuten per kant tot kaas gesmolten is."}, {"step": 5, "instruction": "Snijd in punten. Serveer met salsa."}]'::jsonb,
ARRAY['Quick', 'Budget', 'Comfort Food'], 'Quick'),

(gen_random_uuid(), 'Avocado Toast met Ei', 'Gezonde en snelle maaltijd met avocado en ei.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=800&q=80', 5, 5, 10, 'Makkelijk', 2,
'[{"name": "volkorenbrood", "quantity": "4", "unit": "snee"}, {"name": "avocado", "quantity": "2", "unit": "stuk"}, {"name": "eieren", "quantity": "2", "unit": "stuk"}, {"name": "citroen", "quantity": "1", "unit": "stuk"}, {"name": "chilivlokken", "quantity": "1", "unit": "snufje"}]'::jsonb,
'[{"step": 1, "instruction": "Rooster het brood."}, {"step": 2, "instruction": "Prak avocado met citroensap en zout."}, {"step": 3, "instruction": "Kook eieren zacht 6 minuten."}, {"step": 4, "instruction": "Smeer avocado op brood."}, {"step": 5, "instruction": "Leg ei erop. Bestrooi met chilivlokken."}]'::jsonb,
ARRAY['Quick', 'Gezond', 'Ontbijt'], 'Quick'),

(gen_random_uuid(), 'Pita met Falafel', 'Snelle pita met zelfgemaakte falafel en groenten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?auto=format&fit=crop&w=800&q=80', 15, 10, 25, 'Makkelijk', 4,
'[{"name": "kikkererwten", "quantity": "400", "unit": "g"}, {"name": "pita", "quantity": "4", "unit": "stuk"}, {"name": "ui", "quantity": "1", "unit": "stuk"}, {"name": "knoflook", "quantity": "2", "unit": "teentjes"}, {"name": "komijn", "quantity": "1", "unit": "tl"}, {"name": "tahini", "quantity": "3", "unit": "el"}]'::jsonb,
'[{"step": 1, "instruction": "Pureer kikkererwten met ui, knoflook en komijn."}, {"step": 2, "instruction": "Vorm balletjes en bak 8 minuten."}, {"step": 3, "instruction": "Warm pita op."}, {"step": 4, "instruction": "Vul met falafel en groenten."}, {"step": 5, "instruction": "Serveer met tahinidressing."}]'::jsonb,
ARRAY['Quick', 'Plant-based', 'Budget'], 'Quick'),

(gen_random_uuid(), 'Stir-fry Noodles', 'Snelle noedels met groenten en tofu in 15 minuten.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=800&q=80', 5, 10, 15, 'Makkelijk', 2,
'[{"name": "noedels", "quantity": "200", "unit": "g"}, {"name": "tofu", "quantity": "200", "unit": "g"}, {"name": "groentenmix", "quantity": "300", "unit": "g"}, {"name": "sojasaus", "quantity": "2", "unit": "el"}, {"name": "sesamolie", "quantity": "1", "unit": "el"}]'::jsonb,
'[{"step": 1, "instruction": "Kook noedels volgens verpakking."}, {"step": 2, "instruction": "Bak tofu goudbruin."}, {"step": 3, "instruction": "Voeg groenten toe en roerbak 5 minuten."}, {"step": 4, "instruction": "Voeg noedels en sojasaus toe."}, {"step": 5, "instruction": "Roerbak 2 minuten. Serveer met sesamolie."}]'::jsonb,
ARRAY['Quick', 'Aziatisch', 'Plant-based'], 'Quick')
on conflict do nothing;

-- Insert recipe categories for all new recipes
insert into public.recipe_categories (recipe_id, category)
select r.id, unnest(r.tags)
from public.recipes r
where r.created_at > now() - interval '1 hour'  -- Only new recipes from this migration
on conflict (recipe_id, category) do nothing;

-- Also add main category
insert into public.recipe_categories (recipe_id, category)
select r.id, r.category
from public.recipes r
where r.created_at > now() - interval '1 hour'
  and r.category is not null
on conflict (recipe_id, category) do nothing;

