-- Extended recipes seed data - 20 uitgebreide recepten met unieke afbeeldingen
-- All recipes by Dietmar Lattré

INSERT INTO public.recipes (id, title, description, author, image_url, prep_time_minutes, cook_time_minutes, total_time_minutes, difficulty, servings, ingredients, instructions, tags, category) VALUES
-- Italian Recipes
(gen_random_uuid(), 'Osso Buco alla Milanese', 'Klassieke Italiaanse stoofschotel met kalfsschenkel, geserveerd met risotto alla milanese. Een feestelijk gerecht voor speciale gelegenheden.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80', 30, 120, 150, 'Gemiddeld', 4, 
'["4 kalfsschenkels (osso buco)", "2 eetlepels bloem", "50g boter", "2 eetlepels olijfolie", "1 ui, fijngesnipperd", "2 wortels, in blokjes", "2 stengels bleekselderij, in blokjes", "3 teentjes knoflook, fijngehakt", "200ml witte wijn", "400ml tomatenpuree", "500ml runderbouillon", "1 laurierblad", "2 takjes tijm", "1 citroen, geraspte schil", "2 eetlepels peterselie, fijngehakt", "1 teentje knoflook, fijngehakt (voor gremolata)", "Zout en peper"]'::jsonb,
'["Bestrooi de osso buco met zout, peper en bloem.", "Verhit boter en olie in een grote pan en bak de osso buco aan beide kanten goudbruin. Haal uit de pan.", "Bak de ui, wortel en bleekselderij 5 minuten. Voeg knoflook toe en bak 1 minuut.", "Blus af met witte wijn en laat inkoken. Voeg tomatenpuree, bouillon, laurier en tijm toe.", "Leg de osso buco terug in de pan, breng aan de kook en laat 2 uur sudderen met de deksel op.", "Maak gremolata: meng peterselie, knoflook en citroenschil.", "Serveer de osso buco met risotto alla milanese en bestrooi met gremolata."]'::jsonb,
'["Italiaans", "Comfort Food", "Feest"]'::text[], 'Italiaans'),

(gen_random_uuid(), 'Risotto ai Funghi Porcini', 'Romige risotto met gedroogde porcini paddenstoelen, een klassieker uit Noord-Italië met diepe umami smaken.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=800&q=80', 20, 30, 50, 'Gemiddeld', 4,
'["300g risottorijst (Arborio of Carnaroli)", "30g gedroogde porcini paddenstoelen", "1 liter warme kippenbouillon", "1 ui, fijngesnipperd", "2 teentjes knoflook, fijngehakt", "100ml droge witte wijn", "50g boter", "50g Parmezaanse kaas, geraspt", "2 eetlepels olijfolie", "2 eetlepels peterselie, fijngehakt", "Zout en peper"]'::jsonb,
'["Week de porcini 20 minuten in warm water. Zeef en bewaar het weekvocht.", "Verhit olijfolie en boter in een pan. Bak ui en knoflook zachtjes 3 minuten.", "Voeg de risottorijst toe en roer 2 minuten tot glazig.", "Blus af met witte wijn en laat bijna volledig inkoken.", "Voeg een scheut warme bouillon toe en roer tot opgenomen. Herhaal tot rijst al dente is (18-20 min).", "Voeg de gehakte porcini en weekvocht toe in de laatste 5 minuten.", "Roer boter en Parmezaanse kaas erdoor. Breng op smaak met zout en peper.", "Serveer direct, bestrooid met peterselie."]'::jsonb,
'["Italiaans", "Vegetarian", "Comfort Food"]'::text[], 'Italiaans'),

(gen_random_uuid(), 'Pasta Carbonara Authentica', 'De echte Romeinse carbonara: zonder room, alleen eieren, pecorino, guanciale en zwarte peper. Simpel en perfect.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'["400g spaghetti", "200g guanciale (of pancetta), in blokjes", "4 eieren", "100g Pecorino Romano, geraspt", "Zwarte peper, vers gemalen", "Zout"]'::jsonb,
'["Kook de spaghetti in ruim gezouten water volgens de verpakking.", "Bak de guanciale in een grote pan tot knapperig. Bewaar het vet.", "Klop eieren met 80g Pecorino en veel zwarte peper in een kom.", "Giet de pasta af (bewaar wat pastawater) en voeg toe aan de pan met guanciale.", "Haal van het vuur en voeg het eimengsel toe terwijl je roert. Het ei moet stollen maar niet schiften.", "Voeg eventueel wat pastawater toe voor de juiste consistentie.", "Serveer direct met extra Pecorino en zwarte peper."]'::jsonb,
'["Italiaans", "Quick", "Comfort Food"]'::text[], 'Italiaans'),

-- French Recipes
(gen_random_uuid(), 'Coq au Vin', 'Klassieke Franse stoofschotel met kip, rode wijn, champignons en spek. Een gerecht vol smaak en traditie.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', 30, 90, 120, 'Gemiddeld', 6,
'["1 hele kip, in stukken", "200g spekblokjes", "300g champignons, in plakjes", "12 kleine uien (pareluitjes)", "3 teentjes knoflook, fijngehakt", "750ml rode wijn (Bourgogne)", "250ml kippenbouillon", "2 eetlepels tomatenpuree", "2 laurierbladen", "3 takjes tijm", "50g boter", "2 eetlepels bloem", "Zout en peper"]'::jsonb,
'["Marineer de kip 2-24 uur in de rode wijn met laurier en tijm.", "Bak de spekblokjes knapperig. Haal uit de pan en bewaar het vet.", "Bestrooi kip met zout, peper en bloem. Bak goudbruin in het spekvet.", "Voeg knoflook toe en bak 1 minuut. Voeg tomatenpuree toe.", "Giet de wijn (met marinade) en bouillon erbij. Breng aan de kook en laat 45 minuten sudderen.", "Bak de champignons en uien apart goudbruin in boter.", "Voeg champignons, uien en spek toe aan de kip. Laat nog 15 minuten sudderen.", "Serveer met aardappelpuree of pasta."]'::jsonb,
'["Frans", "Comfort Food", "Feest"]'::text[], 'Frans'),

(gen_random_uuid(), 'Bouillabaisse Marseillaise', 'Traditionele vissoep uit Marseille met verschillende soorten verse vis en zeevruchten, geserveerd met rouille en croutons.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 45, 45, 90, 'Gemiddeld', 6,
'["1kg gemengde vis (zeebaars, kabeljauw, zeeduivel)", "500g zeevruchten (mosselen, garnalen)", "2 uien, fijngesnipperd", "4 teentjes knoflook, fijngehakt", "2 venkelknollen, in plakjes", "800g tomaten, in blokjes", "1 sinaasappel, schil en sap", "1 liter visbouillon", "200ml witte wijn", "4 eetlepels olijfolie", "1 theelepel saffraan", "2 laurierbladen", "1 takje tijm", "Peterselie, fijngehakt", "Zout en peper"]'::jsonb,
'["Snijd de vis in grote stukken. Bewaar koppen en graten voor de bouillon.", "Verhit olijfolie in een grote pan. Bak ui, knoflook en venkel 10 minuten.", "Voeg tomaten, sinaasappelschil en sap toe. Kook 5 minuten.", "Voeg wijn, bouillon, saffraan, laurier en tijm toe. Breng aan de kook.", "Voeg de vis toe en kook 8-10 minuten. Voeg zeevruchten toe en kook 3 minuten.", "Breng op smaak met zout en peper.", "Serveer met rouille (knoflookmayonaise) en croutons."]'::jsonb,
'["Frans", "Vis", "Gezond"]'::text[], 'Frans'),

(gen_random_uuid(), 'Ratatouille Provençale', 'Kleurrijke groentestoof uit de Provence met aubergine, courgette, paprika en tomaten. Perfect als bijgerecht of hoofdgerecht.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?auto=format&fit=crop&w=800&q=80', 30, 60, 90, 'Makkelijk', 6,
'["2 aubergines, in blokjes", "2 courgettes, in blokjes", "2 rode paprikas, in reepjes", "2 uien, in ringen", "4 tomaten, ontveld en in blokjes", "4 teentjes knoflook, fijngehakt", "4 eetlepels olijfolie", "1 takje rozemarijn", "2 takjes tijm", "Basilicum, fijngehakt", "Zout en peper"]'::jsonb,
'["Bestrooi aubergine met zout en laat 30 minuten uitlekken. Spoel af en dep droog.", "Verhit olie in een grote pan. Bak aubergine goudbruin. Haal uit de pan.", "Bak courgette goudbruin. Haal uit de pan.", "Bak paprika 5 minuten. Haal uit de pan.", "Bak ui en knoflook 3 minuten. Voeg tomaten, rozemarijn en tijm toe.", "Voeg alle groenten terug toe. Breng aan de kook en laat 30 minuten sudderen.", "Breng op smaak met zout en peper. Roer basilicum erdoor.", "Serveer warm of op kamertemperatuur."]'::jsonb,
'["Frans", "Vegetarian", "Vegan", "Gezond"]'::text[], 'Frans'),

-- Asian Recipes
(gen_random_uuid(), 'Peking Duck', 'Legendarische Chinese eend met krokante huid, geserveerd met pannenkoekjes, lente-ui en hoisinsaus. Een feestelijk gerecht.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', 60, 120, 180, 'Advanced', 4,
'["1 eend (2-2.5kg)", "2 eetlepels honing", "2 eetlepels sojasaus", "1 eetlepel rijstwijn", "1 theelepel vijfkruidenpoeder", "1 theelepel gemberpoeder", "16 Chinese pannenkoekjes", "4 lente-uien, in reepjes", "1 komkommer, in reepjes", "Hoisinsaus", "Zout"]'::jsonb,
'["Maak de eend schoon en droog goed af met keukenpapier.", "Meng honing, sojasaus, rijstwijn en kruiden. Bestrijk de eend.", "Hang de eend 24 uur op in de koelkast om te drogen (of gebruik een ventilator).", "Verwarm de oven voor op 180°C. Leg eend op een rooster boven een bakplaat.", "Bak 1.5-2 uur tot de huid krokant is. Verhoog de temperatuur de laatste 20 minuten naar 220°C.", "Snijd de huid en het vlees in dunne plakjes.", "Serveer met pannenkoekjes, lente-ui, komkommer en hoisinsaus."]'::jsonb,
'["Aziatisch", "Feest", "Advanced"]'::text[], 'Aziatisch'),

(gen_random_uuid(), 'Pad Thai met Garnalen', 'Klassieke Thaise noedelschotel met garnalen, taugé, pinda\'s en een perfecte balans tussen zoet, zuur en zout.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=800&q=80', 20, 15, 35, 'Gemiddeld', 4,
'["200g rijstnoedels", "300g garnalen, gepeld", "2 eieren", "100g taugé", "4 lente-uien, in stukjes", "2 teentjes knoflook, fijngehakt", "50g pindas, fijngehakt", "2 eetlepels vissaus", "2 eetlepels tamarindepasta", "2 eetlepels palmsuiker", "1 theelepel chilivlokken", "2 eetlepels olie", "Limoensap", "Koriander, fijngehakt"]'::jsonb,
'["Week de noedels 30 minuten in warm water tot zacht. Giet af.", "Meng vissaus, tamarinde, palmsuiker en chilivlokken voor de saus.", "Verhit olie in een wok. Bak knoflook 30 seconden. Voeg garnalen toe en bak 2 minuten.", "Schuif garnalen opzij. Klop eieren in de wok en roerbak tot gestold.", "Voeg noedels en saus toe. Roerbak 2 minuten tot noedels zacht zijn.", "Voeg taugé en lente-ui toe. Roerbak 1 minuut.", "Serveer met pindas, koriander en limoensap."]'::jsonb,
'["Aziatisch", "Quick", "Vis"]'::text[], 'Aziatisch'),

(gen_random_uuid(), 'Ramen Tonkotsu', 'Rijke Japanse noedelsoep met varkensbouillon, gesmolten varkensvlees, zacht gekookt ei en diverse toppings.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', 30, 240, 270, 'Advanced', 4,
'["1kg varkensbotten", "500g varkensnek", "2kg varkenspoten", "200g varkensreuzel", "4 teentjes knoflook", "1 stuk gember (5cm)", "4 ramen noedels", "4 zachtgekookte eieren", "200g chashu (gekookt varkensvlees)", "4 nori vellen", "Lente-ui, fijngehakt", "Bamboescheuten", "Sesamolie"]'::jsonb,
'["Blancheer de botten 10 minuten in kokend water. Spoel af.", "Kook botten, nek en poten 12-18 uur op laag vuur tot de bouillon romig wit is.", "Voeg reuzel toe en kook nog 1 uur. Zeef de bouillon.", "Bak knoflook en gember. Voeg toe aan de bouillon.", "Kook de noedels volgens de verpakking.", "Verwarm de bouillon. Breng op smaak met zout.", "Serveer noedels in kommen met bouillon, chashu, ei, nori, lente-ui en bamboescheuten."]'::jsonb,
'["Aziatisch", "Comfort Food", "Advanced"]'::text[], 'Aziatisch'),

-- Spanish Recipes
(gen_random_uuid(), 'Paella Valenciana', 'Authentieke Spaanse rijstschotel met kip, konijn, bonen en saffraan. Het nationale gerecht van Spanje.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80', 30, 45, 75, 'Gemiddeld', 6,
'["400g paellarijst (Bomba)", "600g kip, in stukken", "300g konijn, in stukken", "200g snijbonen", "200g grote witte bonen (judías)", "1 tomaat, geraspt", "1 rode paprika, in reepjes", "1.5 liter kippenbouillon", "1 theelepel saffraan", "1 theelepel zoete paprikapoeder", "4 teentjes knoflook, fijngehakt", "Olijfolie", "Zout"]'::jsonb,
'["Verhit olie in een paellapan. Bak kip en konijn goudbruin. Haal uit de pan.", "Bak paprika en bonen 5 minuten. Voeg knoflook en tomaat toe.", "Voeg rijst toe en roer 2 minuten. Voeg paprikapoeder en saffraan toe.", "Giet bouillon erbij en breng aan de kook. Leg kip en konijn terug op de rijst.", "Kook 18-20 minuten op middelhoog vuur zonder te roeren.", "Laat 5 minuten rusten met deksel erop.", "Serveer direct uit de pan."]'::jsonb,
'["Spaans", "Comfort Food", "Feest"]'::text[], 'Spaans'),

(gen_random_uuid(), 'Gazpacho Andaluz', 'Verfrissende koude tomatensoep uit Andalusië, perfect voor warme zomerdagen. Vol van verse groenten en kruiden.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80', 20, 0, 20, 'Makkelijk', 6,
'["1kg rijpe tomaten", "1 komkommer, geschild", "1 rode paprika", "1 groene paprika", "1 rode ui", "2 teentjes knoflook", "50ml sherryazijn", "100ml olijfolie", "200g witbrood, zonder korst", "500ml koud water", "Zout en peper", "Basilicum, voor garnering"]'::jsonb,
'["Snijd alle groenten in grove stukken.", "Week het brood 10 minuten in water. Knijp uit.", "Mix alle ingrediënten in een blender tot glad.", "Zeef door een fijne zeef voor een gladde textuur.", "Zet minimaal 2 uur in de koelkast.", "Serveer koud met olijfolie, basilicum en croutons."]'::jsonb,
'["Spaans", "Vegetarian", "Vegan", "Gezond", "Quick"]'::text[], 'Spaans'),

-- Belgian Recipes
(gen_random_uuid(), 'Waterzooi van Kip', 'Traditionele Gentse kippensoep met groenten en room. Een Belgische klassieker die troost biedt op koude dagen.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', 30, 60, 90, 'Makkelijk', 6,
'["1 hele kip (1.5kg)", "2 liter kippenbouillon", "2 wortels, in plakjes", "2 preien, in ringen", "2 stengels bleekselderij, in stukjes", "1 ui, gehalveerd", "2 laurierbladen", "3 takjes peterselie", "200ml room", "2 eierdooiers", "Citroensap", "Zout en peper", "Peterselie, fijngehakt"]'::jsonb,
'["Leg de kip in een grote pan met bouillon, ui, laurier en peterselie.", "Breng aan de kook en laat 45 minuten zachtjes koken.", "Haal de kip uit de bouillon. Haal het vlees van het bot en snijd in stukken.", "Zeef de bouillon. Voeg wortel, prei en bleekselderij toe en kook 15 minuten.", "Voeg het kippenvlees terug toe.", "Klop room met eierdooiers. Voeg een scheut warme bouillon toe.", "Roer het roommengsel door de soep zonder te koken.", "Breng op smaak met citroensap, zout en peper. Bestrooi met peterselie."]'::jsonb,
'["Belgisch", "Comfort Food"]'::text[], 'Belgisch'),

(gen_random_uuid(), 'Konijn met Pruimen', 'Klassiek Belgisch stoofgerecht met konijn, pruimen en bier. Een gerecht vol smaak en traditie.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', 30, 90, 120, 'Gemiddeld', 4,
'["1 konijn, in stukken", "200g gedroogde pruimen", "500ml donker bier", "2 uien, in ringen", "2 eetlepels bloem", "50g boter", "2 eetlepels suiker", "2 eetlepels azijn", "2 laurierbladen", "1 takje tijm", "Zout en peper"]'::jsonb,
'["Bestrooi konijn met zout, peper en bloem.", "Bak het konijn goudbruin in boter. Haal uit de pan.", "Bak de uien 5 minuten. Voeg suiker toe en karamelliseer.", "Blus af met azijn. Voeg bier, laurier en tijm toe.", "Leg het konijn terug in de pan. Breng aan de kook en laat 1 uur sudderen.", "Voeg pruimen toe en laat nog 30 minuten sudderen.", "Serveer met frietjes of puree."]'::jsonb,
'["Belgisch", "Comfort Food"]'::text[], 'Belgisch'),

-- Seafood Recipes
(gen_random_uuid(), 'Bouillabaisse van de Noordzee', 'Nederlandse versie van de klassieke vissoep met verse Noordzeevis, mosselen en garnalen.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 30, 30, 60, 'Gemiddeld', 6,
'["1kg gemengde vis (kabeljauw, schelvis, zeebaars)", "500g mosselen", "300g garnalen", "2 uien, fijngesnipperd", "4 teentjes knoflook", "2 venkelknollen", "800g tomaten", "1 liter visbouillon", "200ml witte wijn", "Saffraan", "Peterselie", "Zout en peper"]'::jsonb,
'["Snijd de vis in grote stukken.", "Verhit olie en bak ui, knoflook en venkel 10 minuten.", "Voeg tomaten, wijn en bouillon toe. Kook 15 minuten.", "Voeg saffraan toe. Pureer de soep grof.", "Voeg vis toe en kook 8 minuten. Voeg zeevruchten toe en kook 3 minuten.", "Breng op smaak. Serveer met peterselie en croutons."]'::jsonb,
'["Vis", "Gezond"]'::text[], 'Vis'),

(gen_random_uuid(), 'Gebakken Zeebaars met Citroen en Tijm', 'Eenvoudig maar elegant: verse zeebaars met een knapperige huid, geserveerd met citroenboter en verse tijm.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?auto=format&fit=crop&w=800&q=80', 10, 15, 25, 'Makkelijk', 4,
'["4 zeebaarsfilets (met huid)", "50g boter", "2 citroenen", "4 takjes tijm", "2 teentjes knoflook", "Olijfolie", "Zout en peper", "Aardappelen, voor bijgerecht"]'::jsonb,
'["Droog de vis goed af. Snijd de huid in met een mes.", "Verhit olie in een pan. Leg vis met huid naar beneden.", "Bak 4-5 minuten tot huid krokant is. Draai om en bak 2 minuten.", "Smelt boter met knoflook en tijm. Voeg citroensap toe.", "Serveer vis met citroenboter en citroenpartjes."]'::jsonb,
'["Vis", "Gezond", "Quick"]'::text[], 'Vis'),

-- Vegetarian Recipes
(gen_random_uuid(), 'Vegetarische Lasagne', 'Rijke lasagne met spinazie, ricotta, mozzarella en een romige bechamelsaus. Perfect comfort food zonder vlees.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=800&q=80', 45, 45, 90, 'Gemiddeld', 8,
'["12 lasagnevellen", "500g spinazie", "500g ricotta", "300g mozzarella, geraspt", "100g Parmezaanse kaas", "2 uien, fijngesnipperd", "4 teentjes knoflook", "800g tomatenpuree", "50g boter", "50g bloem", "500ml melk", "Nootmuskaat", "Zout en peper"]'::jsonb,
'["Bak ui en knoflook. Voeg tomatenpuree toe en laat 20 minuten pruttelen.", "Bereid bechamel: smelt boter, voeg bloem toe, roer melk erdoor. Kook tot dik.", "Blancheer spinazie. Knijp uit en hak fijn. Meng met ricotta.", "Bouw lasagne: saus, vellen, spinazie-ricotta, bechamel, mozzarella. Herhaal.", "Bestrooi met Parmezaan. Bak 45 minuten op 180°C tot goudbruin."]'::jsonb,
'["Vegetarian", "Comfort Food", "Italiaans"]'::text[], 'Vegetarian'),

(gen_random_uuid(), 'Chickpea Curry met Kokosmelk', 'Rijke, aromatische curry met kikkererwten, kokosmelk en Indiase kruiden. Vegan en vol van smaak.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80', 15, 30, 45, 'Makkelijk', 4,
'["2 blikken kikkererwten (800g)", "400ml kokosmelk", "1 ui, fijngesnipperd", "4 teentjes knoflook", "2cm gember, geraspt", "2 tomaten, in blokjes", "2 theelepels garam masala", "1 theelepel kurkuma", "1 theelepel komijn", "1 theelepel korianderpoeder", "Chilivlokken", "Koriander, fijngehakt", "Zout"]'::jsonb,
'["Bak ui, knoflook en gember 3 minuten.", "Voeg kruiden toe en bak 1 minuut tot aromatisch.", "Voeg tomaten toe en kook 5 minuten.", "Voeg kikkererwten en kokosmelk toe. Breng aan de kook en laat 20 minuten pruttelen.", "Breng op smaak met zout. Roer koriander erdoor.", "Serveer met rijst of naan."]'::jsonb,
'["Vegetarian", "Vegan", "Gezond", "Aziatisch"]'::text[], 'Vegetarian'),

-- Dessert Recipes
(gen_random_uuid(), 'Tiramisu Classico', 'Klassieke Italiaanse dessert met mascarpone, koffie en cacao. Romig, luchtig en onweerstaanbaar.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80', 30, 0, 30, 'Makkelijk', 8,
'["500g mascarpone", "6 eieren", "100g suiker", "300g lange vingers", "300ml sterke espresso", "50ml amaretto", "Cacaopoeder", "Pure chocolade, geraspt"]'::jsonb,
'["Splits de eieren. Klop eiwitten stijf met een snuf zout.", "Klop eidooiers met suiker tot licht en luchtig. Roer mascarpone erdoor.", "Spatel eiwitten voorzichtig door het mascarpone mengsel.", "Meng koffie met amaretto. Doop lange vingers kort in het mengsel.", "Leg een laag lange vingers in een schaal. Bedek met helft van het mengsel.", "Herhaal met een tweede laag. Bestrooi met cacao en chocolade.", "Zet minimaal 4 uur in de koelkast."]'::jsonb,
'["Dessert", "Italiaans", "Feest"]'::text[], 'Dessert'),

(gen_random_uuid(), 'Crème Brûlée', 'Klassieke Franse dessert met vanillecustard en een krokante laag gekaramelliseerde suiker. Elegant en tijdloos.', 'Dietmar Lattré', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 20, 60, 80, 'Gemiddeld', 6,
'["500ml room", "500ml volle melk", "1 vanillestokje", "8 eierdooiers", "100g suiker", "50g kristalsuiker (voor karamel)"]'::jsonb,
'["Verwarm room en melk met vanillestokje tot net onder het kookpunt. Laat 30 minuten trekken.", "Klop eidooiers met suiker tot licht.", "Verwijder vanillestokje. Giet warme melk langzaam bij eidooiers onder roeren.", "Zeef het mengsel. Giet in ovenschaaltjes.", "Bak 45-60 minuten op 150°C in een waterbad tot gestold.", "Laat afkoelen. Zet 4 uur in de koelkast.", "Bestrooi met kristalsuiker. Karamelliseer met een brander."]'::jsonb,
'["Dessert", "Frans", "Feest"]'::text[], 'Dessert');

-- Insert into recipe_categories
INSERT INTO public.recipe_categories (recipe_id, category)
SELECT id, unnest(tags)::text
FROM public.recipes
WHERE title IN (
    'Osso Buco alla Milanese',
    'Risotto ai Funghi Porcini',
    'Pasta Carbonara Authentica',
    'Coq au Vin',
    'Bouillabaisse Marseillaise',
    'Ratatouille Provençale',
    'Peking Duck',
    'Pad Thai met Garnalen',
    'Ramen Tonkotsu',
    'Paella Valenciana',
    'Gazpacho Andaluz',
    'Waterzooi van Kip',
    'Konijn met Pruimen',
    'Bouillabaisse van de Noordzee',
    'Gebakken Zeebaars met Citroen en Tijm',
    'Vegetarische Lasagne',
    'Chickpea Curry met Kokosmelk',
    'Tiramisu Classico',
    'Crème Brûlée'
);

