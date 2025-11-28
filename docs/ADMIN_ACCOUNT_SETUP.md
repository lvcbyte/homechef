# Admin Account Setup: ADMIN / ADMIN123

## Stap 1: Maak Auth User aan in Supabase Dashboard

1. Ga naar je **Supabase Dashboard**
2. Navigeer naar **Authentication** > **Users**
3. Klik op **"Add User"** > **"Create new user"**
4. Vul in:
   - **Email**: `admin@stockpit.app`
   - **Password**: `ADMIN123`
   - **Auto Confirm User**: ✅ (vink aan)
5. Klik **"Create User"**

## Stap 2: Run SQL Script

Run het SQL script `42_create_admin_account.sql` in je Supabase SQL Editor.

Dit script zal:
- De user vinden op basis van email
- Het profiel aanmaken/updaten met admin rechten
- Alle verplichte velden correct invullen

## Stap 3: Test Login

1. Ga naar `/admin` in je app
2. Log in met:
   - **Gebruikersnaam**: `ADMIN` (of `admin@stockpit.app`)
   - **Password**: `ADMIN123`

## Login Opties

Je kunt inloggen met:
- `ADMIN` → wordt automatisch `admin@stockpit.app`
- `admin@stockpit.app` → direct email

## Verificatie

Na het runnen van het script, check of het werkt:

```sql
SELECT 
    p.id,
    u.email,
    p.is_admin,
    p.admin_role,
    p.archetype
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@stockpit.app';
```

Je zou moeten zien:
- `is_admin = true`
- `admin_role = 'owner'`
- `archetype = 'Minimalist'`

## Troubleshooting

### "User not found"
- Zorg dat je eerst de auth user hebt aangemaakt in Supabase Dashboard
- Check of de email exact overeenkomt: `admin@stockpit.app`

### "Toegang geweigerd"
- Check of `is_admin = true` in de profiles tabel
- Run het SQL script opnieuw
- Refresh de pagina na login

