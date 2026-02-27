# saleor-script

Script to apply basic structures in a new Saleor instance.

Connects to any Saleor GraphQL API and seeds default structures via mutations: tax classes, warehouses, channels, shipping zones, attributes, product types, categories, collections, page types, and pages.

## Requirements

- Node.js 18+
- A running Saleor instance (Cloud or self-hosted)
- A staff account or app token with the following permissions:
  - `MANAGE_TAXES`
  - `MANAGE_CHANNELS`
  - `HANDLE_TAXES`
  - `MANAGE_SHIPPING`
  - `MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES`
  - `MANAGE_PRODUCTS`
  - `MANAGE_PAGES`

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in SALEOR_API_URL + credentials (see below)
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SALEOR_API_URL` | Yes | Full URL to the Saleor GraphQL endpoint, e.g. `https://your-store.saleor.cloud/graphql/` |
| `SALEOR_APP_TOKEN` | One of these | Long-lived app token from Dashboard → Apps → Tokens (preferred) |
| `SALEOR_EMAIL` | One of these | Staff user email (calls `tokenCreate` on startup) |
| `SALEOR_PASSWORD` | One of these | Staff user password |

`SALEOR_APP_TOKEN` takes priority if both are set.

## Running

```bash
# Run all enabled seeders (as configured in src/config/defaults.ts)
npm run seed

# Run only specific sections (ignores enabled flags in config)
npm run seed -- --only=taxClasses,channels,warehouses

# Run all enabled sections except specific ones
npm run seed -- --skip=shipping,pages

# Combine (only takes precedence, then skip is applied)
npm run seed -- --only=channels,collections --skip=collections
```

### Available section names

`taxClasses` · `warehouses` · `channels` · `shipping` · `attributes` · `productTypes` · `categories` · `collections` · `pageTypes` · `pages`

## Customising defaults

All seed data lives in a single file: **`src/config/defaults.ts`**.

Each section has an `enabled` flag and a `data` array:

```ts
export const config = {
  taxClasses: {
    enabled: true,           // set false to permanently skip this section
    data: [
      { name: 'Standard Rate' },
      { name: 'Reduced Rate' },
    ],
  },
  shipping: {
    enabled: false,          // disabled — won't run unless --only=shipping is passed
    data: [],
  },
  // ...
};
```

Edit only `defaults.ts` — no other files need changing.

## Seeding order and dependencies

Sections are always run in this order regardless of flags, because later sections depend on IDs from earlier ones:

```
Tax Classes → Warehouses → Channels → Shipping
                                    ↑
Attributes → Product Types          |
                                 Collections
Categories
Page Types → Pages
```

The script warns you if you run a section whose dependency was skipped (e.g. running `collections` without `channels`).

## Project structure

```
src/
├── index.ts                  # orchestrator + CLI flag parsing
├── apollo/
│   └── apollo-client.ts      # Apollo Client (mirrors production pattern)
├── config/
│   └── defaults.ts           # ← edit this to customise seed data
├── mutations/                # gql-tagged GraphQL mutation documents + TS types
│   ├── taxClass.ts
│   ├── warehouse.ts
│   ├── channel.ts
│   ├── shipping.ts
│   ├── attribute.ts
│   ├── productType.ts
│   ├── category.ts
│   ├── collection.ts
│   ├── pageType.ts
│   └── page.ts
└── seeders/                  # one seeder per structure type
    ├── utils.ts              # shared logging + SeedContext
    ├── taxClasses.ts
    ├── warehouses.ts
    ├── channels.ts
    ├── shipping.ts
    ├── attributes.ts
    ├── productTypes.ts
    ├── categories.ts
    ├── collections.ts
    ├── pageTypes.ts
    └── pages.ts
```

## Reusing mutations in Apollo projects

The files in `src/mutations/` use `gql` from `@apollo/client/core` and export typed TypeScript interfaces. They are designed to be copy-pasted directly into any project that uses the same `apollo/apollo-client.ts` pattern.
