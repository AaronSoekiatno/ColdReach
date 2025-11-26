#!/bin/bash

# Setup script to create .env.local file from .env.example

# Check for .env.local first (preferred for Next.js)
if [ -f .env.local ]; then
    echo ".env.local file already exists. Skipping..."
    exit 0
fi

# Also check for .env
if [ -f .env ]; then
    echo ".env file exists. Consider using .env.local instead (it's gitignored)."
    read -p "Create .env.local anyway? (y/n): " answer
    if [ "$answer" != "y" ]; then
        exit 0
    fi
fi

if [ ! -f .env.example ]; then
    echo "Creating .env.example file..."
    cat > .env.example << 'EOF'
# Google Gemini API Key
# Get your API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Helix Database URL (optional - defaults to http://localhost:6969)
HELIX_URL=http://localhost:6969

# Helix API Key (optional - only needed if your Helix instance requires authentication)
# HELIX_API_KEY=your_helix_api_key_here
EOF
fi

echo "Creating .env.local file from .env.example..."
cp .env.example .env.local

echo ""
echo "✅ .env.local file created!"
echo ""
echo "⚠️  IMPORTANT: Edit .env.local and add your GEMINI_API_KEY"
echo "   Get your API key from: https://aistudio.google.com/app/apikey"
echo ""
echo "   You can edit it with: nano .env.local"
echo ""
echo "   Note: .env.local is gitignored and is the preferred file for local development."
echo ""

