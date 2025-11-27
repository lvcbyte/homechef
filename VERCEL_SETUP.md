# Vercel Deployment Setup

## Environment Variables

Deze applicatie heeft Supabase credentials nodig om te werken. Je moet de volgende environment variables instellen in je Vercel project:

### Vereiste Environment Variables

1. **EXPO_PUBLIC_SUPABASE_URL**
   - Je Supabase project URL
   - Voorbeeld: `https://xxxxx.supabase.co`

2. **EXPO_PUBLIC_SUPABASE_ANON_KEY**
   - Je Supabase anonymous/public key
   - Deze vind je in je Supabase project settings onder API

### Hoe te configureren in Vercel

1. Ga naar je Vercel project dashboard
2. Klik op **Settings** → **Environment Variables**
3. Voeg de volgende variabelen toe:
   - Key: `EXPO_PUBLIC_SUPABASE_URL`
     Value: `https://jouw-project.supabase.co`
   - Key: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
     Value: `jouw-anon-key-hier`

4. Zorg ervoor dat de variabelen beschikbaar zijn voor:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. Na het toevoegen van de variabelen, trigger een nieuwe deployment:
   - Ga naar **Deployments**
   - Klik op de drie puntjes naast de laatste deployment
   - Kies **Redeploy**

### Optionele Environment Variables

- `EXPO_PUBLIC_OPENAI_KEY` - Voor AI features (optioneel)

### Verificatie

Na het instellen van de environment variables en het redeployen, zou de applicatie moeten werken zonder errors. Als je nog steeds een witte pagina ziet, controleer dan:

1. Of de environment variables correct zijn ingesteld
2. Of de deployment is voltooid
3. De browser console voor eventuele errors

