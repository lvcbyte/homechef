# Scripts

## Lidl Product Sync

Sync Lidl products from your Lidl Plus receipts to Supabase catalog.

### Prerequisites

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Get Lidl Plus credentials**:
   - You need a Lidl Plus account
   - Get your refresh token by running: `lidl-plus auth`
   - Or use phone + password (requires 2FA code each time)

### Usage

1. **Set environment variables**:
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   export LIDL_LANGUAGE="nl"  # nl, de, fr, etc.
   export LIDL_COUNTRY="BE"   # BE, NL, DE, AT, etc.
   export LIDL_REFRESH_TOKEN="your-refresh-token"
   ```

2. **Run the script**:
   ```bash
   python scripts/sync-lidl-receipts.py
   ```

The script will:
- Connect to Lidl Plus API
- Fetch all your receipts
- Extract products from receipts
- Import products into Supabase catalog

### Getting Refresh Token

First time setup:

```bash
# Install lidl-plus with auth support
pip install "lidl-plus[auth]"

# Run auth command
lidl-plus auth
# Follow prompts:
# - Enter language (nl, de, fr, etc.)
# - Enter country (BE, NL, DE, AT, etc.)
# - Enter phone number
# - Enter password
# - Enter verification code (received via SMS)

# Copy the refresh token and save it as LIDL_REFRESH_TOKEN
```

### Notes

- The script extracts products from your purchase history (receipts)
- Products are automatically categorized
- Prices reflect what you actually paid
- Barcodes are included when available
- Source is set to 'lidl' for filtering

## Direct Web Scraping (Lidl, Colruyt, Delhaize)

Scrape product catalogi direct van de websites zonder Apify.

### Prerequisites

1. **Install dependencies** (already installed):
   ```bash
   npm install
   ```

### Usage

**Belangrijk:** De scripts lezen automatisch uit `.env.local`. Je hoeft geen environment variables te exporteren!

**Lidl:**
```bash
cd /Users/dietmar/chef
node scripts/scrape-lidl-direct.js
```

**Colruyt:**
```bash
node scripts/scrape-colruyt-direct.js
```

**Delhaize:**
```bash
node scripts/scrape-delhaize-direct.js
```

**Let op:** Als de scripts geen producten vinden, kan het zijn dat:
- De websites JavaScript gebruiken om producten te laden (dan is Puppeteer nodig)
- De website structuur is veranderd (selectors aanpassen)
- De website blokkeert geautomatiseerde requests

### How it works

1. **Puppeteer** opent een echte browser en laadt de website (JavaScript rendering)
2. Scripts scrollen door de pagina om lazy-loaded content te laden
3. Product informatie wordt geëxtraheerd uit de DOM
4. Producten worden direct geïmporteerd naar Supabase via RPC

### Notes

- **Puppeteer** is nodig omdat moderne websites JavaScript gebruiken om producten te laden
- Selectors kunnen aanpassing nodig hebben als websites veranderen
- Scripts wachten 3 seconden tussen requests om de server niet te overbelasten
- Als er nog steeds geen producten worden gevonden, check de Network tab in de browser om te zien of er API calls zijn
- Zie `docs/DIRECT_SCRAPING.md` voor details

## Albert Heijn Catalog Sync

See `sync-ah-catalog.ts` for Albert Heijn product import (via Apify).

