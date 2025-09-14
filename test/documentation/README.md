# Documentation Tests

Tests organized by documentation sessions to validate all features and examples.

## Structure

```
test/documentation/
├── session1-foundation/     # Phase 1: Foundation Features
├── session2-data-queries/   # Phase 2: Data Management + Advanced Queries  
├── session3-middleware/     # Phase 2: Middleware + Utilities
├── session4-ai-realtime/    # Phase 2: AI/ML + Real-time
├── session5-distributed/    # Phase 3: Event Sourcing + Distributed
├── session6-integrations/   # Phase 3: Integrations + Tools + Examples
└── utils/                   # Test utilities
```

## Running Tests

```bash
# Run all documentation tests
npm run test:docs

# Run specific session
npm run test:docs:session1
npm run test:docs:session2
npm run test:docs:session3
npm run test:docs:session4
npm run test:docs:session5
npm run test:docs:session6

# Run by type
npm run test:docs:unit
npm run test:docs:integration
npm run test:docs:examples
```
