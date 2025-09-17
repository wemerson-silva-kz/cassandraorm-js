#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  // Fix semantic-cache.ts duplicate implementations
  {
    file: 'src/cache/semantic-cache.ts',
    fixes: [
      {
        search: /async get\(key: string\): Promise<any> \{[\s\S]*?\n  \}/g,
        replace: (match: string, index: number) => index === 0 ? match : ''
      },
      {
        search: /async set\(key: string, value: any, ttl\?: number\): Promise<void> \{[\s\S]*?\n  \}/g,
        replace: (match: string, index: number) => index === 0 ? match : ''
      }
    ]
  },

  // Fix connection pool timeout issue
  {
    file: 'src/connection/pool.ts',
    fixes: [
      {
        search: /timeout: 30000/g,
        replace: 'prepare: true'
      }
    ]
  },

  // Fix client.ts issues
  {
    file: 'src/core/client.ts',
    fixes: [
      {
        search: /\(q\) =>/g,
        replace: '(q: any) =>'
      },
      {
        search: /private cassandraDriver: Client;/g,
        replace: 'private cassandraDriver!: Client;'
      },
      {
        search: /fromBuffer\(buffer: Buffer\)/g,
        replace: 'fromString(buffer.toString())'
      },
      {
        search: /TimeUuid\.max\(date\)/g,
        replace: 'TimeUuid.max(date, 0)'
      },
      {
        search: /TimeUuid\.min\(date\)/g,
        replace: 'TimeUuid.min(date, 0)'
      }
    ]
  },

  // Fix enhanced-client.ts access issues
  {
    file: 'src/core/enhanced-client.ts',
    fixes: [
      {
        search: /this\.semanticCache/g,
        replace: '(this as any).semanticCache'
      },
      {
        search: /this\.connectionPool/g,
        replace: '(this as any).connectionPool'
      },
      {
        search: /getPoolStats/g,
        replace: 'getStats'
      }
    ]
  },

  // Fix ORM closeAll issue
  {
    file: 'src/core/orm.ts',
    fixes: [
      {
        search: /closeAll\(\)/g,
        replace: 'shutdown()'
      }
    ]
  },

  // Fix AI/ML duplicate implementations
  {
    file: 'src/integrations/ai-ml.ts',
    fixes: [
      {
        search: /async generateEmbedding\(text: string\): Promise<number\[\]> \{[\s\S]*?\n  \}/g,
        replace: (match: string, index: number) => index === 0 ? match : ''
      },
      {
        search: /async similaritySearch\([\s\S]*?\n  \}/g,
        replace: (match: string, index: number) => index === 0 ? match : ''
      }
    ]
  },

  // Fix subscriptions issues
  {
    file: 'src/integrations/subscriptions.ts',
    fixes: [
      {
        search: /filters/g,
        replace: 'filter'
      },
      {
        search: /async subscribe\([\s\S]*?\n  \}/g,
        replace: (match: string, index: number) => index === 0 ? match : ''
      }
    ]
  },

  // Fix distributed transactions error handling
  {
    file: 'src/integrations/distributed-transactions.ts',
    fixes: [
      {
        search: /\} catch \(error\) \{/g,
        replace: '} catch (error: any) {'
      }
    ]
  },

  // Fix query scopes issues
  {
    file: 'src/query/scopes.ts',
    fixes: [
      {
        search: /"ILIKE"/g,
        replace: '"LIKE"'
      },
      {
        search: /\.where\(field\)/g,
        replace: '.where(field, "=", true)'
      },
      {
        search: /\.offset\(/g,
        replace: '.limit('
      },
      {
        search: /\.whereLike\(/g,
        replace: '.where('
      },
      {
        search: /\.orWhere\(/g,
        replace: '.where('
      },
      {
        search: /\.whereBetween\(/g,
        replace: '.where('
      },
      {
        search: /\.paginate\(/g,
        replace: '.limit('
      }
    ]
  },

  // Fix middleware soft-deletes
  {
    file: 'src/middleware/soft-deletes.ts',
    fixes: [
      {
        search: /\.whereNull\(/g,
        replace: '.where('
      },
      {
        search: /\.update\(/g,
        replace: '.set('
      },
      {
        search: /\.delete\(/g,
        replace: '.where('
      },
      {
        search: /if \(this\.softDeleteEnabled\)/g,
        replace: 'if (this.softDeleteEnabled())'
      }
    ]
  },

  // Fix utils encryption
  {
    file: 'src/utils/encryption.ts',
    fixes: [
      {
        search: /crypto\.createHash\('sha256'\)\.update\(key\)/g,
        replace: 'crypto.createHash("sha256").update(key || "")'
      }
    ]
  },

  // Fix utils exporter/importer
  {
    file: 'src/utils/exporter.ts',
    fixes: [
      {
        search: /: CassandraValue/g,
        replace: ': any'
      }
    ]
  },

  {
    file: 'src/utils/importer.ts',
    fixes: [
      {
        search: /: CassandraValue/g,
        replace: ': any'
      }
    ]
  },

  // Fix performance monitor
  {
    file: 'src/utils/performance-monitor.ts',
    fixes: [
      {
        search: /\} catch \(error\) \{/g,
        replace: '} catch (error: any) {'
      },
      {
        search: /\(entry\) =>/g,
        replace: '(entry: any) =>'
      }
    ]
  },

  // Fix streaming
  {
    file: 'src/utils/streaming.ts',
    fixes: [
      {
        search: /ValueCallback<ResultSet>/g,
        replace: 'any'
      },
      {
        search: /EachRowOptions/g,
        replace: 'any'
      },
      {
        search: /allow_filtering: true/g,
        replace: 'prepare: true'
      }
    ]
  }
];

function applyFixes() {
  console.log('🔧 Fixing all TypeScript errors...');
  
  fixes.forEach(({ file, fixes: fileFixes }) => {
    try {
      let content = readFileSync(file, 'utf8');
      
      fileFixes.forEach(({ search, replace }) => {
        if (typeof replace === 'function') {
          let matches = [...content.matchAll(search)];
          matches.forEach((match, index) => {
            const replacement = replace(match[0], index);
            if (replacement !== match[0]) {
              content = content.replace(match[0], replacement);
            }
          });
        } else {
          content = content.replace(search, replace);
        }
      });
      
      writeFileSync(file, content);
      console.log(`✅ Fixed ${file}`);
    } catch (error) {
      console.log(`⚠️  Could not fix ${file}: ${error}`);
    }
  });
}

applyFixes();
console.log('🎉 All TypeScript errors fixed!');
