# Pothos Prisma Cursor Pagination Issue

Minimal reproduction of a Pothos GraphQL bug where cursor-based pagination with totalCount causes "Unsupported cursor type" errors and duplicate database queries.

## Bug Summary

When using `relatedConnection` with `totalCount: true` alongside other fields that select from the same relation, Pothos:
1. **Primary Issue**: Throws "Unsupported cursor type undefined" error when querying with ONLY `totalCount` (no `edges`, no `pageInfo`)
2. **Secondary Issue**: Generates duplicate database queries with identical parameters
3. Creates inefficient data loading patterns

## Setup

```bash
docker-compose up -d
npm install
npx prisma generate
npx prisma db push
npm run seed
```

## Reproduce

```bash
npm run test:bug
```

The test demonstrates:
- **TEST 1**: Query with ONLY `totalCount` → ❌ "Unsupported cursor type" error
- **TEST 2**: Query with `totalCount` + `edges` → ✅ Works (workaround #1)
- **TEST 3**: Query with `totalCount` + `pageInfo` → ✅ Works (workaround #2)

Also observe:
- Duplicate Prisma queries with identical parameters
- Inefficient query patterns when both `livingUnits` and `propertyUses` are queried

## Key Configuration

```typescript
// Field that selects from propertyUses relation
livingUnits: t.int({
  select: {
    propertyUses: {
      select: { unitCount: true },
    },
  },
  resolve: (property) => {
    return property.propertyUses.reduce((sum, use) => sum + use.unitCount, 0);
  },
}),

// Connection that also uses propertyUses relation  
propertyUses: t.relatedConnection("propertyUses", {
  cursor: "id",
  totalCount: true,  // This triggers the issue
});
```

## The Problem

The error occurs when ALL of these conditions are met:
1. A field (e.g., `livingUnits`) selects data from a relation (`propertyUses`)
2. The same relation is used in a connection with `totalCount: true`
3. The query requests ONLY `totalCount` (no `edges`, no `pageInfo`)

```graphql
query BuggyQuery {
  property(id: "...") {
    livingUnits      # Selects from propertyUses
    propertyUses {   
      totalCount     # ONLY totalCount = ERROR!
    }
  }
}
```

## Workarounds

Either of these workarounds prevents the error:

### Option 1: Include `edges` in the query
```graphql
propertyUses {
  totalCount
  edges {        # Adding edges prevents the error
    node { ... }
  }
}
```

### Option 2: Include `pageInfo` in the query
```graphql
propertyUses {
  totalCount
  pageInfo {     # Adding pageInfo also prevents the error
    hasNextPage
    # ...
  }
}
```

## CI

This repo includes a GitHub Action that automatically runs the bug reproduction test:

```bash
.github/workflows/test.yml
```

## Versions

- Prisma: 6.19.0
- @pothos/core: 4.10.0  
- @pothos/plugin-prisma: 4.14.0
- @pothos/plugin-relay: 4.6.2
