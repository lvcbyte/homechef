# Stap 2: Deploy WebSocket Edge Function

## ✅ Actie Vereist

Deploy de timer-sync Edge Function naar Supabase:

### Optie A: Via Supabase CLI (Aanbevolen)

```bash
# 1. Zorg dat je bent ingelogd
supabase login

# 2. Link je project (als je dat nog niet hebt gedaan)
supabase link --project-ref YOUR_PROJECT_REF

# 3. Deploy de function
supabase functions deploy timer-sync
```

### Optie B: Via Supabase Dashboard

1. Ga naar je Supabase Dashboard
2. Navigeer naar **Edge Functions**
3. Klik op **Create a new function**
4. Naam: `timer-sync`
5. Kopieer de inhoud van `supabase/functions/timer-sync/index.ts`
6. Klik op **Deploy**

## ✅ Verificatie

Na deployment, test de function:

```bash
# Test health check endpoint
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/timer-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Je zou moeten zien: `{"status":"ok","connections":0}`

## ⚙️ Environment Variables

Zorg dat deze environment variables zijn ingesteld in Supabase:
- `SUPABASE_URL` (automatisch beschikbaar)
- `SUPABASE_SERVICE_ROLE_KEY` (automatisch beschikbaar)

## 📝 Volgende Stap

Als de function is gedeployed, ga door naar **Stap 3: Configureer Timer Sync Service**

