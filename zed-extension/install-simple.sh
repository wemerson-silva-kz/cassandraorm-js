#!/bin/bash

echo "🛠️ Installing CassandraORM Zed Extension (Simple Version)..."

# Check if Zed is installed
if ! command -v zed &> /dev/null; then
    echo "❌ Zed editor not found. Please install Zed first:"
    echo "   brew install zed"
    exit 1
fi

# Create extension directory
ZED_EXTENSIONS_DIR="$HOME/.config/zed/extensions/cassandraorm"
mkdir -p "$ZED_EXTENSIONS_DIR"

# Copy files
echo "📦 Installing extension files..."
cp extension-simple.toml "$ZED_EXTENSIONS_DIR/extension.toml"
cp -r grammars "$ZED_EXTENSIONS_DIR/" 2>/dev/null || echo "⚠️  Grammar files not found"

echo "✅ CassandraORM Zed Extension installed successfully!"
echo "🔄 Restart Zed to activate the extension."
echo ""
echo "📝 To use the extension:"
echo "   1. Create files with .cassandra.ts or .cassandra.js extension"
echo "   2. Or add '// @cassandraorm' at the top of your TypeScript/JavaScript files"
echo "   3. Enjoy syntax highlighting for CassandraORM schemas!"
