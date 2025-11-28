# Admin Dashboard Setup Guide

## Stap 1: SQL Migrations Uitvoeren

Run de volgende migrations in volgorde in je Supabase SQL Editor:

1. `36_admin_system.sql` - Basis admin systeem
2. `37_admin_functions.sql` - Admin functies voor database operaties
3. `38_create_admin_user.sql` - Helper functies voor admin user creatie

## Stap 2: Admin User Aanmaken

### Optie A: Via Supabase Dashboard

1. Ga naar **Authentication** > **Users** in Supabase Dashboard
2. Klik op **Add User** > **Create new user**
3. Email: `ADMINDIETMAR@admin.stockpit.app` (of je eigen email)
4. Password: [je wachtwoord]
5. Klik **Create User**
6. Kopieer de **User UUID** (bijv. `123e4567-e89b-12d3-a456-426614174000`)

### Optie B: Via SQL

Na het aanmaken van de auth user, run:

```sql
-- Vervang 'YOUR_EMAIL@example.com' met je email
SELECT set_admin_by_email('YOUR_EMAIL@example.com', 'owner');
```

Of als je de UUID hebt:

```sql
-- Vervang 'USER_UUID_HERE' met de UUID van je user
SELECT set_admin_user('USER_UUID_HERE', 'owner');
```

## Stap 3: Inloggen op Admin Dashboard

1. Ga naar `/admin` in je app
2. Log in met:
   - **Gebruikersnaam**: `ADMINDIETMAR` (of je email)
   - **Wachtwoord**: [je wachtwoord]

## Features

### Dashboard Metrics
- Totaal aantal gebruikers
- Totaal aantal recepten
- Totaal aantal inventory items
- API call statistieken

### AI Assistent
De admin AI assistent kan:
- Recepten toevoegen, bewerken of verwijderen
- Database queries uitvoeren (veilig)
- Statistieken bekijken
- Gebruikers beheren

### Monitoring
- Recente admin activiteit logs
- System metrics
- Error tracking

### Security
- Row Level Security (RLS) policies
- Admin-only functies
- Activity logging
- API key management

## Use Cases

### 1. Recept Toevoegen via AI
```
"Voeg een nieuw recept toe: Pasta Carbonara met spek en eieren"
```

### 2. Recept Verwijderen
```
"Verwijder het recept met ID abc-123-def"
```

### 3. Statistieken Bekijken
```
"Hoeveel gebruikers hebben we?"
"Laat me de laatste 10 recepten zien"
```

### 4. Database Query
```
"Toon alle recepten die de afgelopen week zijn toegevoegd"
```

## API Keys Beheren

Admin kan API keys aanmaken voor externe integraties:
- API credentials voor widgets
- Webhook endpoints
- Third-party integrations

## Security Best Practices

1. **Gebruik sterke wachtwoorden** voor admin accounts
2. **Log alle admin acties** - alles wordt gelogd in `admin_logs`
3. **Beperk admin toegang** - alleen vertrouwde personen
4. **Review logs regelmatig** - check `admin_logs` voor verdachte activiteit
5. **API keys roteren** - regelmatig nieuwe keys genereren

## Troubleshooting

### "Toegang geweigerd"
- Check of `is_admin = true` in je `profiles` tabel
- Check of je ingelogd bent met het juiste account

### "Function does not exist"
- Run alle migrations in volgorde
- Check of de functies bestaan in Supabase SQL Editor

### "RLS policy violation"
- Check of je admin permissions correct zijn ingesteld
- Check of de RLS policies correct zijn aangemaakt

## Volgende Stappen

- [ ] SSO integratie (Google, GitHub, etc.)
- [ ] API versioning systeem
- [ ] Advanced monitoring dashboard
- [ ] Automated backups
- [ ] Rate limiting voor API calls

