#!/bin/bash

echo "🛠️ Installing CassandraORM Zed Extension..."

# Check if Zed is installed
if ! command -v zed &> /dev/null; then
    echo "❌ Zed editor not found. Please install Zed first:"
    echo "   brew install zed"
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source ~/.cargo/env
fi

# Build the extension
echo "🔨 Building extension..."
cargo build --release

# Create extension directory
ZED_EXTENSIONS_DIR="$HOME/.config/zed/extensions/cassandraorm"
mkdir -p "$ZED_EXTENSIONS_DIR"

# Copy files
echo "📦 Installing extension files..."
cp extension.toml "$ZED_EXTENSIONS_DIR/"
cp -r grammars "$ZED_EXTENSIONS_DIR/"
cp target/wasm32-wasi/release/cassandraorm_zed.wasm "$ZED_EXTENSIONS_DIR/cassandraorm.wasm" 2>/dev/null || echo "⚠️  WASM file not found, using basic extension"

echo "✅ CassandraORM Zed Extension installed successfully!"
echo "🔄 Restart Zed to activate the extension."
