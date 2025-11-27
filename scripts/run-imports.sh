#!/bin/bash

# Script to run all importers and build massive product catalog

echo "🚀 Starting product import process..."
echo ""

# Run Open Food Facts (most products, can take a while)
echo "📦 Step 1/5: Importing from Open Food Facts (this will take 30-60 minutes)..."
node scripts/scrape-openfoodfacts.js > logs/openfoodfacts.log 2>&1 &
OPENFOODFACTS_PID=$!

# Wait a bit before starting next
sleep 10

# Run Lidl
echo "📦 Step 2/5: Importing from Lidl..."
node scripts/scrape-lidl-direct.js > logs/lidl.log 2>&1 &
LIDL_PID=$!

sleep 10

# Run Colruyt
echo "📦 Step 3/5: Importing from Colruyt..."
node scripts/scrape-colruyt-direct.js > logs/colruyt.log 2>&1 &
COLRUYT_PID=$!

sleep 10

# Run Jumbo
echo "📦 Step 4/5: Importing from Jumbo..."
node scripts/scrape-jumbo.js > logs/jumbo.log 2>&1 &
JUMBO_PID=$!

sleep 10

# Run Carrefour
echo "📦 Step 5/5: Importing from Carrefour..."
node scripts/scrape-carrefour.js > logs/carrefour.log 2>&1 &
CARREFOUR_PID=$!

echo ""
echo "✅ All importers started in background!"
echo ""
echo "📊 Monitor progress:"
echo "   tail -f logs/openfoodfacts.log"
echo "   tail -f logs/lidl.log"
echo "   tail -f logs/colruyt.log"
echo ""
echo "🔍 Check database:"
echo "   node scripts/check-database.js"
echo ""
echo "⏹️  To stop all importers:"
echo "   kill $OPENFOODFACTS_PID $LIDL_PID $COLRUYT_PID $JUMBO_PID $CARREFOUR_PID"

