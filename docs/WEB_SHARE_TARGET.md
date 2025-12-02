# Web Share Target API - Recept Import

## Overzicht

STOCKPIT ondersteunt nu de **Web Share Target API**, waardoor gebruikers recepten direct kunnen delen vanuit hun browser naar de app. Dit maakt het importeren van recepten van externe websites naadloos en gebruiksvriendelijk.

## Functionaliteit

### Hoe het werkt:

1. **Gebruiker vindt een recept** op een externe website
2. **Gebruiker klikt op "Delen"** in de browser (native share button)
3. **STOCKPIT verschijnt** als optie in het deelmenu
4. **Recept wordt automatisch geïmporteerd** en geparsed
5. **Gebruiker kan het recept bewerken** en opslaan

## Technische Implementatie

### 1. Manifest Configuratie (`app.config.js`)

De `shareTarget` configuratie is toegevoegd aan de PWA manifest:

```javascript
shareTarget: {
  action: '/import',
  method: 'GET',
  enctype: 'application/x-www-form-urlencoded',
  params: {
    title: 'title',
    text: 'text',
    url: 'url',
  },
}
```

### 2. Import Route (`app/import.tsx`)

De `/import` route ontvangt de gedeelde content via URL parameters:
- `url`: De URL van de gedeelde pagina
- `text`: Gedeelde tekst
- `title`: Titel van de gedeelde pagina

### 3. Recipe Parser Service (`services/recipeParser.ts`)

De parser service:
- **Haalt HTML op** van de gedeelde URL
- **Extracteert tekst** uit de HTML
- **Parseert ingrediënten** met regex patterns
- **Parseert bereidingswijze** met regex patterns
- **Extracteert metadata** (tijd, porties, moeilijkheidsgraad)

### 4. Database (`supabase/migrations/95_recipe_imports.sql`)

Optionele tabel voor het tracken van geïmporteerde recepten (voor analytics).

## Gebruik

### Voor Gebruikers:

1. **Installeer STOCKPIT als PWA** (voeg toe aan home screen)
2. **Bezoek een recept website** (bijv. Allerhande, 24Kitchen)
3. **Klik op "Delen"** in de browser
4. **Selecteer STOCKPIT** uit het deelmenu
5. **Bewerk en sla op** het geïmporteerde recept

### Voor Developers:

#### Testen:

1. **Deploy de PWA** (of gebruik localhost met HTTPS)
2. **Installeer de PWA** op je device
3. **Test met een recept URL**:
   ```
   https://your-domain.com/import?url=https://example.com/recipe&title=Test%20Recept
   ```

#### Handmatig Testen:

```javascript
// In browser console:
navigator.share({
  title: 'Test Recept',
  text: 'Dit is een test recept',
  url: 'https://example.com/recipe'
});
```

## Parsing Logica

### Ingrediënten Parsing:

De parser herkent verschillende formaten:
- `2 eetlepels olijfolie`
- `200g bloem`
- `1 kopje melk`
- `zout` (zonder hoeveelheid)

### Bereidingswijze Parsing:

- Genummerde stappen: `1. Doe dit...`
- Lijst items met bullets
- Paragraaf tekst

### Metadata Extractie:

- **Tijd**: `30 minuten`, `prep: 15 min`, etc.
- **Porties**: `4 personen`, `servings: 6`, etc.
- **Moeilijkheid**: `makkelijk`, `gemiddeld`, `moeilijk`

## Mobile-First Design

De import pagina is volledig geoptimaliseerd voor mobile:
- ✅ Responsive layout
- ✅ Touch-friendly inputs
- ✅ STOCKPIT branding
- ✅ Smooth scrolling
- ✅ Safe area support

## Browser Support

- ✅ **Chrome/Edge** (Android, Desktop)
- ✅ **Safari** (iOS 12.1+)
- ⚠️ **Firefox** (beperkte support)
- ❌ **Safari Desktop** (geen share target support)

## Troubleshooting

### PWA verschijnt niet in deelmenu:

1. **Check of PWA geïnstalleerd is** (niet alleen in browser tab)
2. **Check manifest.json** (moet `share_target` bevatten)
3. **Check HTTPS** (vereist voor PWA features)
4. **Herstart browser** na installatie

### Recept wordt niet correct geparsed:

1. **Check console logs** voor parsing errors
2. **Bewerk handmatig** de geïmporteerde data
3. **Rapporteer issue** met voorbeeld URL

## SQL Scripts

Run de migration om de `recipe_imports` tabel aan te maken:

```sql
-- Zie: supabase/migrations/95_recipe_imports.sql
```

## Toekomstige Verbeteringen

- [ ] AI-powered parsing voor betere extractie
- [ ] Image extraction van recept pagina's
- [ ] Support voor meerdere talen
- [ ] Batch import van meerdere recepten
- [ ] Automatische categorisering

