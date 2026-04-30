#!/bin/bash

echo "🔄 Restoring working configuration..."
echo ""

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🏗️  Building..."
npm run build

echo ""
echo "📋 Checking dist/ contents..."
ls -lh dist/

echo ""
echo "✅ Build complete!"
echo ""
echo "To deploy, run: clasp push"
echo ""
echo "Files in dist/:"
ls dist/
