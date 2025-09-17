#!/usr/bin/env bun

// Minimal fixes for critical issues to get tests running

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const fixes = [
  // Fix semantic cache duplicate methods
  {
    file: 'src/cache/semantic-cache.ts',
    search: /async get\(query: string, params: any\[\]\): Promise<any \| null> \{[\s\S]*?\n  \}/g,
    replace: `async get(query: string, params: any[]): Promise<any | null> {
    const key = this.generateKey(query, params);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    // Check for semantically similar queries
    for (const [cachedKey, cachedValue] of this.cache.entries()) {
      if (this.calculateSimilarity(key, cachedKey) > this.similarityThreshold) {
        return cachedValue.data;
      }
    }
    
    return null;
  }`
  },
  
  // Fix subscription manager duplicate methods
  {
    file: 'src/integrations/subscriptions.ts',
    search: /subscribe\(filter: SubscriptionFilter, callback: \(event: any\) => void\): string \{[\s\S]*?\n  \}/g,
    replace: `subscribe(filter: SubscriptionFilter, callback: (event: any) => void): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.subscriptions.set(id, { filter, callback });
    return id;
  }`
  }
];

console.log('🔧 Applying critical fixes...');

for (const fix of fixes) {
  try {
    const filePath = join(process.cwd(), fix.file);
    let content = readFileSync(filePath, 'utf8');
    
    // Only apply if pattern matches
    if (fix.search.test(content)) {
      content = content.replace(fix.search, fix.replace);
      writeFileSync(filePath, content);
      console.log(`✅ Fixed ${fix.file}`);
    } else {
      console.log(`⚠️  Pattern not found in ${fix.file}`);
    }
  } catch (error) {
    console.log(`❌ Error fixing ${fix.file}:`, error.message);
  }
}

console.log('✨ Critical fixes applied!');
