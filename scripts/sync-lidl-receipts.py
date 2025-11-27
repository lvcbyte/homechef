#!/usr/bin/env python3
"""
Sync Lidl products from receipts to Supabase catalog
Uses the lidl-plus Python library: https://pypi.org/project/lidl-plus/
"""

import os
import sys
import json
from typing import Dict, List, Any
from supabase import create_client, Client
from lidlplus import LidlPlusApi

# Load environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('EXPO_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
LIDL_LANGUAGE = os.getenv('LIDL_LANGUAGE', 'nl')  # nl, de, fr, etc.
LIDL_COUNTRY = os.getenv('LIDL_COUNTRY', 'BE')  # BE, NL, DE, AT, etc.
LIDL_REFRESH_TOKEN = os.getenv('LIDL_REFRESH_TOKEN')
LIDL_PHONE = os.getenv('LIDL_PHONE')
LIDL_PASSWORD = os.getenv('LIDL_PASSWORD')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing required environment variables:")
    print(f"   SUPABASE_URL: {'✅' if SUPABASE_URL else '❌'}")
    print(f"   SUPABASE_SERVICE_ROLE_KEY: {'✅' if SUPABASE_SERVICE_ROLE_KEY else '❌'}")
    sys.exit(1)

if not LIDL_REFRESH_TOKEN and (not LIDL_PHONE or not LIDL_PASSWORD):
    print("❌ Missing Lidl credentials:")
    print("   Either set LIDL_REFRESH_TOKEN or both LIDL_PHONE and LIDL_PASSWORD")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def map_category(category: str = None) -> str:
    """Map Lidl category to our category system"""
    if not category:
        return 'pantry'
    
    cat_lower = category.lower()
    
    if any(word in cat_lower for word in ['groente', 'fruit', 'vegetable', 'legume']):
        return 'fresh_produce'
    if any(word in cat_lower for word in ['vis', 'fish', 'seafood', 'poisson']):
        return 'seafood'
    if any(word in cat_lower for word in ['zuivel', 'yoghurt', 'melk', 'dairy', 'lait', 'kaas', 'cheese']):
        return 'dairy_eggs'
    if any(word in cat_lower for word in ['vlees', 'eiwit', 'meat', 'viande', 'worst', 'sausage']):
        return 'proteins'
    if any(word in cat_lower for word in ['kruiden', 'saus', 'condiment', 'spice', 'épice']):
        return 'spices_condiments'
    if any(word in cat_lower for word in ['diepvries', 'frozen', 'congelé']):
        return 'frozen'
    if any(word in cat_lower for word in ['maaltijd', 'meal', 'repas']):
        return 'ready_meals'
    if any(word in cat_lower for word in ['snack', 'chips', 'chocolade', 'chocolate']):
        return 'snacks'
    if any(word in cat_lower for word in ['bakkerij', 'brood', 'bakery', 'boulangerie']):
        return 'bakery'
    if any(word in cat_lower for word in ['drank', 'beverage', 'drink', 'boisson']):
        return 'beverages'
    if 'baby' in cat_lower:
        return 'baby'
    if any(word in cat_lower for word in ['verzorging', 'care', 'soin']):
        return 'personal_care'
    if any(word in cat_lower for word in ['huishoud', 'household', 'ménage']):
        return 'household'
    
    return 'pantry'

def normalize_product(item: Dict[str, Any], receipt_id: str = None) -> Dict[str, Any]:
    """Normalize Lidl receipt item to our product catalog format"""
    # Extract product name
    product_name = item.get('name', 'Unknown product')
    
    # Try to extract brand (might be in name like "Lidl Goudse kaas")
    brand = 'Lidl'
    if ' ' in product_name:
        parts = product_name.split(' ', 1)
        # If first word looks like a brand, use it
        if parts[0].isupper() or len(parts[0]) > 2:
            brand = parts[0]
            product_name = parts[1] if len(parts) > 1 else product_name
    
    # Extract price
    price_str = item.get('currentUnitPrice') or item.get('originalAmount', '0')
    # Remove currency symbols and convert comma to dot
    price_str = price_str.replace('€', '').replace(',', '.').strip()
    try:
        price = float(price_str)
    except (ValueError, TypeError):
        price = None
    
    # Extract barcode
    barcode = item.get('codeInput') or item.get('barcode') or item.get('ean')
    
    # Extract quantity/unit
    quantity = item.get('quantity', '1')
    unit_size = f"{quantity} {item.get('unit', 'stuks')}" if item.get('unit') else quantity
    
    return {
        'id': f"lidl-{barcode or receipt_id or 'unknown'}-{hash(product_name) % 1000000}",
        'product_name': product_name,
        'brand': brand,
        'category': map_category(item.get('category') or item.get('taxGroupName')),
        'barcode': barcode,
        'description': None,
        'image_url': None,
        'unit_size': unit_size,
        'nutrition': None,
        'price': price,
        'is_available': True,
        'source': 'lidl',
    }

def sync_lidl_receipts():
    """Fetch receipts from Lidl Plus and sync products to Supabase"""
    print("📥 Connecting to Lidl Plus...")
    
    try:
        # Initialize Lidl Plus API
        if LIDL_REFRESH_TOKEN:
            print("🔑 Using refresh token for authentication...")
            lidl = LidlPlusApi(language=LIDL_LANGUAGE, country=LIDL_COUNTRY, refresh_token=LIDL_REFRESH_TOKEN)
        else:
            print("🔑 Authenticating with phone and password...")
            lidl = LidlPlusApi(language=LIDL_LANGUAGE, country=LIDL_COUNTRY)
            
            def get_verify_code():
                return input("Enter verification code received via phone: ")
            
            lidl.login(phone=LIDL_PHONE, password=LIDL_PASSWORD, verify_token_func=get_verify_code)
            print(f"✅ Authenticated! Refresh token: {lidl.refresh_token}")
            print("💡 Save this token as LIDL_REFRESH_TOKEN for future use")
        
        print("📋 Fetching receipts...")
        receipts = lidl.tickets()
        
        if not receipts:
            print("⚠️  No receipts found")
            return
        
        print(f"✅ Found {len(receipts)} receipts")
        
        all_products = []
        processed_count = 0
        
        for receipt in receipts:
            receipt_id = receipt.get('id')
            print(f"📄 Processing receipt {receipt_id}...")
            
            try:
                receipt_details = lidl.ticket(receipt_id)
                items = receipt_details.get('items', [])
                
                for item in items:
                    normalized = normalize_product(item, receipt_id)
                    all_products.append(normalized)
                    processed_count += 1
                    
            except Exception as e:
                print(f"⚠️  Error processing receipt {receipt_id}: {e}")
                continue
        
        print(f"\n📤 Importing {len(all_products)} products to Supabase...")
        
        imported = 0
        failed = 0
        
        for product in all_products:
            try:
                result = supabase.rpc('upsert_product_catalog', {
                    'payload': product
                }).execute()
                
                if result.data:
                    imported += 1
                    if imported % 50 == 0:
                        print(f"  ✅ Imported {imported}/{len(all_products)}...")
                else:
                    failed += 1
                    
            except Exception as e:
                print(f"  ❌ Failed to import {product['product_name']}: {e}")
                failed += 1
        
        print(f"\n✨ Done! Imported: {imported}, Failed: {failed}")
        
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    sync_lidl_receipts()

