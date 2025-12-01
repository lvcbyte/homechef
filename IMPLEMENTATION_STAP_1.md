# Implementatie Stap 1: OCR van Kassabonnen ✅

## Wat is geïmplementeerd:

1. **ReceiptOCR Component** (`components/inventory/ReceiptOCR.tsx`)
   - Tesseract.js integratie voor OCR op web
   - Foto selectie (web: file input, native: image picker)
   - Automatische tekstherkenning van kassabonnen
   - Parsing van items, prijzen en hoeveelheden
   - Categorie detectie voor elk item
   - Selectie interface om items te bevestigen voordat ze worden toegevoegd

2. **SQL Migration** (`supabase/migrations/89_receipt_ocr_enhancements.sql`)
   - Uitbreiding van `receipt_uploads` tabel met extra velden
   - `parse_receipt_items()` functie voor backend parsing
   - `match_receipt_items_to_inventory()` functie voor automatische matching

3. **Integratie in Scan Pagina**
   - ReceiptOCR component toegevoegd aan `/scan` pagina
   - Geplaatst tussen "Shelf shot" en "Snelle invoer"

## Test Instructies:

1. **Database Migration uitvoeren:**
   ```bash
   # In Supabase dashboard of via CLI:
   # Run migration: 89_receipt_ocr_enhancements.sql
   ```

2. **Lokaal testen:**
   ```bash
   npm start
   # Open http://localhost:8081 (of de poort die Expo gebruikt)
   ```

3. **Test stappen:**
   - Ga naar de `/scan` pagina
   - Klik op "Scan Kassabon" knop
   - Selecteer een foto van een kassabon (of maak een foto)
   - Wacht tot OCR verwerking klaar is
   - Controleer de gedetecteerde items
   - Selecteer items die je wilt toevoegen
   - Klik "Items toevoegen"
   - Controleer in `/inventory` of items zijn toegevoegd

## Opmerkingen:

- Tesseract.js werkt alleen op web (browser). Voor native apps zou je een native OCR library moeten gebruiken.
- De parsing logica heeft een fallback voor als de backend functie niet beschikbaar is.
- Items worden automatisch gematched met de product catalogus waar mogelijk.

## Volgende Stap:

Na testen van Stap 1, kunnen we doorgaan met **Stap 2: Offline Data & Synchronisatie**.

