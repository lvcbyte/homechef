# Admin Account Aanmaken: dietmar@stockpit.com

## Stap 1: Maak Auth User aan in Supabase Dashboard

1. Ga naar je **Supabase Dashboard**
2. Navigeer naar **Authentication** > **Users**
3. Klik op **"Add User"** > **"Create new user"**
4. Vul in:
   - **Email**: `dietmar@stockpit.com`
   - **Password**: `Ikbendebeste`
   - **Auto Confirm User**: ✅ (vink aan)
5. Klik **"Create User"**
6. Kopieer de **User UUID** (je hebt deze later nodig)

## Stap 2: Run SQL Script

Run het SQL script `39_create_dietmar_admin.sql` in je Supabase SQL Editor.

Dit script zal:
- De user vinden op basis van email
- Het profiel aanmaken/updaten met admin rechten
- Admin permissions instellen

## Stap 3: Verifieer

Na het runnen van het script, check of het werkt:

```sql
SELECT 
    email,
    is_admin,
    admin_role
FROM public.profiles
WHERE email = 'dietmar@stockpit.com';
```

Je zou moeten zien:
- `is_admin = true`
- `admin_role = 'owner'`

## Stap 4: Test Login

1. Ga naar `/admin` in je app
2. Log in met:
   - **Email**: `dietmar@stockpit.com`
   - **Password**: `Ikbendebeste`

Je zou nu toegang moeten hebben tot het admin dashboard!

## Troubleshooting

### "User with email not found"
- Zorg dat je eerst de auth user hebt aangemaakt in Supabase Dashboard
- Check of de email exact overeenkomt: `dietmar@stockpit.com`

### "Toegang geweigerd" na login
- Check of `is_admin = true` in de profiles tabel
- Run het SQL script opnieuw
- Refresh de pagina na login

### "Profile does not exist"
- Het script maakt automatisch een profiel aan als deze niet bestaat
- Als dit niet werkt, maak handmatig een profiel aan:

```sql
INSERT INTO public.profiles (id, email, is_admin, admin_role)
SELECT 
    id,
    email,
    true,
    'owner'
FROM auth.users
WHERE email = 'dietmar@stockpit.com';
```

