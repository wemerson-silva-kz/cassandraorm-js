# Full-Text Search

## Overview
Advanced full-text search capabilities with indexing, ranking, faceting, and multi-language support.

## Search Index Creation

```typescript
import { SearchManager } from 'cassandraorm-js';

const searchManager = new SearchManager(client);

// Create search index
await searchManager.createIndex('posts_search', {
  table: 'posts',
  fields: {
    title: { boost: 2.0, analyzer: 'standard' },
    content: { analyzer: 'standard' },
    tags: { analyzer: 'keyword' },
    author: { analyzer: 'keyword' }
  },
  settings: {
    numberOfShards: 3,
    numberOfReplicas: 1
  }
});
```

## Basic Search

```typescript
// Simple text search
const results = await searchManager.search('posts_search', {
  query: 'cassandra database performance',
  fields: ['title', 'content'],
  limit: 20,
  offset: 0
});

console.log(`Found ${results.total} results`);
results.hits.forEach(hit => {
  console.log(`${hit.title} (score: ${hit.score})`);
});
```

## Advanced Query Types

```typescript
// Boolean query
const booleanResults = await searchManager.search('posts_search', {
  query: {
    bool: {
      must: [
        { match: { title: 'cassandra' } }
      ],
      should: [
        { match: { content: 'performance' } },
        { match: { content: 'optimization' } }
      ],
      must_not: [
        { match: { tags: 'deprecated' } }
      ],
      filter: [
        { range: { created_at: { gte: '2024-01-01' } } }
      ]
    }
  }
});

// Phrase search
const phraseResults = await searchManager.search('posts_search', {
  query: {
    match_phrase: {
      content: 'distributed database system'
    }
  }
});

// Fuzzy search
const fuzzyResults = await searchManager.search('posts_search', {
  query: {
    fuzzy: {
      title: {
        value: 'casandra', // Misspelled
        fuzziness: 'AUTO'
      }
    }
  }
});
```

## Faceted Search

```typescript
// Search with facets
const facetedResults = await searchManager.search('posts_search', {
  query: { match_all: {} },
  facets: {
    categories: {
      terms: { field: 'category' }
    },
    authors: {
      terms: { field: 'author', size: 10 }
    },
    date_ranges: {
      date_range: {
        field: 'created_at',
        ranges: [
          { to: '2024-01-01', key: 'older' },
          { from: '2024-01-01', to: '2024-06-01', key: 'recent' },
          { from: '2024-06-01', key: 'latest' }
        ]
      }
    }
  }
});

console.log('Facets:', facetedResults.facets);
```

## Auto-complete and Suggestions

```typescript
// Auto-complete
const suggestions = await searchManager.suggest('posts_search', {
  text: 'cass',
  field: 'title',
  size: 5
});

// Did you mean
const corrections = await searchManager.suggest('posts_search', {
  text: 'casandra databse',
  type: 'phrase',
  field: 'title'
});

// Search as you type
const typeahead = await searchManager.searchAsYouType('posts_search', {
  query: 'cass',
  fields: ['title.search_as_you_type', 'content.search_as_you_type']
});
```

## Highlighting

```typescript
// Search with highlighting
const highlightedResults = await searchManager.search('posts_search', {
  query: { match: { content: 'cassandra performance' } },
  highlight: {
    fields: {
      title: { fragment_size: 150, number_of_fragments: 1 },
      content: { fragment_size: 200, number_of_fragments: 3 }
    },
    pre_tags: ['<mark>'],
    post_tags: ['</mark>']
  }
});

highlightedResults.hits.forEach(hit => {
  console.log('Highlighted content:', hit.highlight.content);
});
```

## Multi-language Support

```typescript
// Create multilingual index
await searchManager.createIndex('posts_multilingual', {
  table: 'posts',
  fields: {
    title_en: { analyzer: 'english' },
    title_es: { analyzer: 'spanish' },
    title_fr: { analyzer: 'french' },
    content_en: { analyzer: 'english' },
    content_es: { analyzer: 'spanish' },
    content_fr: { analyzer: 'french' }
  }
});

// Language-specific search
const multilingualResults = await searchManager.search('posts_multilingual', {
  query: {
    multi_match: {
      query: 'base de datos',
      fields: ['title_es^2', 'content_es'],
      analyzer: 'spanish'
    }
  }
});
```

## Custom Analyzers

```typescript
// Define custom analyzer
await searchManager.createAnalyzer('custom_analyzer', {
  tokenizer: 'standard',
  filters: [
    'lowercase',
    'stop',
    {
      type: 'synonym',
      synonyms: [
        'db,database',
        'cassandra,scylla'
      ]
    }
  ]
});

// Use custom analyzer in index
await searchManager.createIndex('posts_custom', {
  table: 'posts',
  fields: {
    title: { analyzer: 'custom_analyzer' },
    content: { analyzer: 'custom_analyzer' }
  }
});
```
