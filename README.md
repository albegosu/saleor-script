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

`taxClasses` · `warehouses` · `channels` · `shipping` · `attributes` · `productTypes` · `categories` · `collections` · `pageTypes` · `pages` · `menus`

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

---

## Integrating into a larger project

If this script is part of a larger project (e.g. a UI repo pointing to a Saleor backoffice), there are several integration options depending on project scale.

### Option 1 — Standalone script (simplest)

Keep this repo separate and run it once per environment. No integration needed in the UI repo:

```bash
# Whenever a new environment needs seeding:
cd ../saleor-script && npm run seed
cd ../my-ui-repo && npm run dev
```

Best for: staging/production environments that are configured once.

---

### Option 2 — `scripts/seed/` inside the UI repo

Move the contents of this repo into a `scripts/seed/` folder inside the UI repo:

```
my-ui-repo/
├── src/                          # UI source code
├── apollo/
│   └── apollo-client.ts          # production Apollo client
├── scripts/
│   └── seed/
│       ├── apollo/
│       │   └── apollo-client.ts  # Node.js-only client for the script
│       ├── mutations/            # same mutations the UI uses
│       ├── seeders/
│       ├── config/
│       │   └── defaults.ts
│       └── index.ts
└── package.json
```

Add a script to the UI repo's `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "seed": "tsx scripts/seed/index.ts",
    "setup": "npm run seed && npm run dev"
  }
}
```

The mutations in `scripts/seed/mutations/` can be the **same files** imported by the UI — no duplication.

---

### Option 3 — Monorepo with shared workspaces (most scalable)

If the project uses a monorepo (Turborepo, pnpm workspaces, Nx):

```
my-project/
├── apps/
│   └── web/                      # UI app
├── packages/
│   └── saleor-seed/              # this repo as a workspace package
│       ├── src/
│       │   ├── mutations/        # shared with apps/web
│       │   └── ...
│       └── package.json
├── package.json                  # "workspaces": ["apps/*", "packages/*"]
└── turbo.json
```

The UI app imports mutations and types directly from the package:

```ts
// apps/web/src/apollo/mutations/productType.ts
import { PRODUCT_TYPE_CREATE } from '@my-project/saleor-seed/mutations/productType';
```

Add a root-level seed script:

```json
{
  "scripts": {
    "seed": "turbo run seed --filter=saleor-seed"
  }
}
```

Best for: multiple apps sharing the same Saleor instance, or when TypeScript types need to be shared across packages.

---

### Option 4 — CI/CD: automatic seed per environment

For ephemeral environments (a new Saleor instance per branch or PR), run the seed automatically in the pipeline before deploying the UI:

```yaml
# .github/workflows/preview.yml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Seed Saleor instance
        env:
          SALEOR_API_URL: ${{ secrets.SALEOR_API_URL }}
          SALEOR_APP_TOKEN: ${{ secrets.SALEOR_APP_TOKEN }}
        run: npm run seed
      - name: Deploy UI
        run: npm run build && npm run deploy
```

Best for: preview environments, automated QA pipelines, or infrastructure-as-code workflows.

---

### Choosing an option

| Situation | Recommended option |
|---|---|
| Small project / single environment | 1 — standalone script |
| Growing project, want to share types | 2 — `scripts/seed/` inside UI repo |
| Multiple apps sharing one Saleor instance | 3 — monorepo |
| Ephemeral environments per PR/branch | 4 — CI/CD pipeline |

The key advantage of this script's structure is that `src/mutations/` files are written in the exact same format used by Apollo in production — `gql`-tagged documents with TypeScript types — so they can be moved into any UI project and used directly without adaptation.
