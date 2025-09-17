#!/usr/bin/env bun

/**
 * Fix all 3 critical issues for v1.0.1-alpha release
 * Issues: #37, #38, #39
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('🔥 Fixing Critical Issues #37, #38, #39...');

// Issue #38: Fix Jest mock types by adding type assertions
function fixJestMocks(filePath: string) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix jest.fn().mockResolvedValue() type issues
  const mockPatterns = [
    {
      search: /jest\.fn\(\)\.mockResolvedValue\(([^)]+)\)/g,
      replace: '(jest.fn() as any).mockResolvedValue($1)'
    },
    {
      search: /jest\.fn\(\)\.mockImplementation\(/g,
      replace: '(jest.fn() as any).mockImplementation('
    },
    {
      search: /global\.fetch = jest\.fn\(\)/g,
      replace: 'global.fetch = jest.fn() as any'
    }
  ];

  mockPatterns.forEach(({ search, replace }) => {
    if (search.test(content)) {
      content = content.replace(search, replace);
      changed = true;
    }
  });

  if (changed) {
    writeFileSync(filePath, content);
    console.log(`✅ Fixed Jest mocks in ${filePath}`);
  }
}

// Issue #39: Fix import paths
function fixImportPaths(filePath: string) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;

  const importFixes = [
    {
      search: /from ['"]\.\.\/src\/index\.js['"]/g,
      replace: 'from "../src/index"'
    },
    {
      search: /from ['"]\.\.\/\.\.\/src\/([^'"]+)\.js['"]/g,
      replace: 'from "../../src/$1"'
    },
    {
      search: /from ['"]\.\/core\/enhanced-client\.js['"]/g,
      replace: 'from "./core/enhanced-client"'
    },
    {
      search: /from ['"]\.\/ai-ml\/real-integration\.js['"]/g,
      replace: 'from "./ai-ml/real-integration"'
    }
  ];

  importFixes.forEach(({ search, replace }) => {
    if (search.test(content)) {
      content = content.replace(search, replace);
      changed = true;
    }
  });

  if (changed) {
    writeFileSync(filePath, content);
    console.log(`✅ Fixed imports in ${filePath}`);
  }
}

// Recursively process all test files
function processDirectory(dir: string) {
  const items = readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      processDirectory(fullPath);
    } else if (item.endsWith('.test.ts') || item.endsWith('.test.js')) {
      fixJestMocks(fullPath);
      fixImportPaths(fullPath);
    }
  });
}

// Issue #37: Already fixed in previous script, but let's verify
console.log('📝 Verifying Cassandra Driver API fixes...');
const clientPath = 'src/core/client.ts';
const clientContent = readFileSync(clientPath, 'utf8');

if (clientContent.includes('TimeUuid.max(date, 0)')) {
  console.log('✅ Cassandra Driver API already fixed');
} else {
  console.log('❌ Cassandra Driver API needs manual fix');
}

// Issue #38 & #39: Fix Jest and imports
console.log('📝 Fixing Jest mocks and import paths...');
processDirectory('test');

// Fix specific problematic files
const problematicFiles = [
  'test/client.test.ts',
  'test/basic.test.js',
  'test/advanced.test.js'
];

problematicFiles.forEach(file => {
  try {
    fixImportPaths(file);
    fixJestMocks(file);
  } catch (error) {
    console.log(`⚠️  Could not fix ${file}: File may not exist`);
  }
});

// Fix src/index.ts exports
console.log('📝 Fixing main index exports...');
const indexPath = 'src/index.ts';
let indexContent = readFileSync(indexPath, 'utf8');

// Ensure all exports use correct paths
indexContent = indexContent.replace(/\.js'/g, "'");
indexContent = indexContent.replace(/\.js"/g, '"');

writeFileSync(indexPath, indexContent);
console.log('✅ Fixed main index exports');

console.log('\n🎉 Critical Issues Fixed!');
console.log('\n📋 Next steps:');
console.log('1. Run: npm run build');
console.log('2. Run: npm test');
console.log('3. Verify test pass rate improvement');
console.log('4. Update GitHub issues');
console.log('\n🚀 Target: 80% test pass rate for v1.0.1-alpha');
