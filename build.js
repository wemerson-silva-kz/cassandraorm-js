#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building CassandraORM JS for publication...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}
fs.mkdirSync('dist', { recursive: true });

// Build main package
console.log('📦 Building main package...');
try {
  execSync('bun build src/index.ts --outdir dist --target node --format esm --outfile index.mjs', { stdio: 'inherit' });
  execSync('bun build src/index.ts --outdir dist --target node --format cjs --outfile index.js', { stdio: 'inherit' });
  console.log('✅ Main package built');
} catch (error) {
  console.error('❌ Failed to build main package:', error.message);
}

// Generate TypeScript declarations
console.log('📝 Generating TypeScript declarations...');
try {
  execSync('tsc --declaration --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });
  console.log('✅ TypeScript declarations generated');
} catch (error) {
  console.error('❌ Failed to generate declarations:', error.message);
}

// Build CLI
console.log('🛠️ Building CLI...');
try {
  execSync('cd cli && npm run build', { stdio: 'inherit' });
  console.log('✅ CLI built');
} catch (error) {
  console.error('❌ Failed to build CLI:', error.message);
}

// Build VS Code Extension
console.log('💻 Building VS Code Extension...');
try {
  execSync('cd vscode-extension && npm run compile', { stdio: 'inherit' });
  console.log('✅ VS Code Extension built');
} catch (error) {
  console.error('❌ Failed to build VS Code Extension:', error.message);
}

// Build Dashboard
console.log('🌐 Building Dashboard...');
try {
  execSync('cd dashboard && npm run build', { stdio: 'inherit' });
  console.log('✅ Dashboard built');
} catch (error) {
  console.error('❌ Failed to build Dashboard:', error.message);
}

console.log('🎉 Build completed successfully!');
console.log('\n📋 Next steps:');
console.log('   npm publish');
console.log('   git tag v2.0.0');
console.log('   git push --tags');
