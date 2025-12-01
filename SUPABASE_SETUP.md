# Supabase Email Verification Setup

## Redirect URL Configuration

Voor email verificatie te laten werken, moet je de volgende redirect URLs toevoegen in je Supabase Dashboard:

### Stap 1: Ga naar Supabase Dashboard
1. Open je Supabase project dashboard
2. Ga naar **Authentication** → **URL Configuration**
3. Scroll naar **Redirect URLs**

### Stap 2: Voeg Redirect URLs toe

Voeg de volgende URLs toe (zonder trailing slash):

**Voor development (localhost):**
```
http://localhost:8081/auth-callback
http://localhost:3000/auth-callback
```

**Voor production (Vercel):**
```
https://homechef-alpha.vercel.app/auth-callback
```

### Stap 3: Site URL

Zorg dat de **Site URL** is ingesteld op:
- Development: `http://localhost:8081`
- Production: `https://homechef-alpha.vercel.app`

### Stap 4: Email Templates (optioneel)

Als je de email template wilt aanpassen:
1. Ga naar **Authentication** → **Email Templates**
2. Selecteer **Confirm signup**
3. Zorg dat de redirect link naar `/auth-callback` gaat

### Stap 5: PKCE Flow

Zorg dat **PKCE** is ingeschakeld:
1. Ga naar **Authentication** → **Providers**
2. Zorg dat **Enable PKCE** is ingeschakeld (dit zou standaard aan moeten staan)

## Troubleshooting

Als email verificatie niet werkt:

1. **Check de redirect URL in de email**: De link moet naar `/auth-callback` gaan
2. **Check de console logs**: Open browser console en kijk naar `[auth-callback]` logs
3. **Check Supabase logs**: Ga naar **Logs** → **Auth Logs** in Supabase dashboard
4. **Verify code is not expired**: PKCE codes verlopen na enkele minuten

## Test Flow

1. Maak een nieuw account aan via `/sign-up`
2. Check je email voor de verificatie link
3. Klik op de link - je zou naar `/auth-callback` moeten gaan
4. De code wordt automatisch uitgewisseld voor een sessie
5. Je ziet het success scherm met "E-mail bevestigd!"

