# saleor-script

Small Node.js tool that connects to a Saleor GraphQL API and initializes a new instance with default catalog, pages (including manufacturers and blog), and navigation structures.

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

Quick reference:

- **`npm run seed`**: Seeds all enabled core sections (`taxClasses`, `warehouses`, `channels`, `shipping`, `attributes`, `productTypes`, `categories`, `collections`, `pageTypes`, `pages`, `menus`, plus manufacturer/company pages).
- **`npm run seed:attributes -- <attributes-export.json>`**: Replays attributes (definitions + values) from a Saleor export JSON.
- **`npm run seed:productTypes -- <productTypes-export.json>`**: Replays product types and their product/variant attributes from an export JSON.
- **`npm run seed:categories -- <categories-export.json>`**: Replays categories + subcategories (tree) from an export JSON.
- **`npm run seed:sample-products -- --count=2`**: Creates demo products using the propagated attributes/product types/categories and local product images.
- **`npm run seed:manufacturers`**: Generates manufacturer pages + attributes from logo files under `public/manufacturers`.
- **`npm run seed:blog-posts`**: Seeds demo blog posts and relaxes blog image requirements if needed.

```bash
# Run all enabled seeders (as configured in src/config/*.ts via src/config/index.ts)
npm run seed
```

### Available section names

`taxClasses` · `warehouses` · `channels` · `shipping` · `attributes` · `productTypes` · `categories` · `collections` · `pageTypes` · `pages` · `menus`

## Customising defaults

Seed data lives under **`src/config/`**, with one file per section:

- `taxClasses.ts`
- `warehouses.ts`
- `channels.ts`
- `shipping.ts`
- `attributes.ts`
- `productTypes.ts`
- `categories.ts`
- `collections.ts`
- `pageTypes.ts`
- `pages.ts` (base pages)
- `companies.ts` / `manufacturers.ts` (extra pages)
- `menus.ts`

Each file exports a `SeederSection<...>` with an `enabled` flag and a `data` array, and `src/config/index.ts` combines them into the final `config` used by the seeders. For example, `src/config/categories.ts`:

```ts
export const categories: SeederSection<CategoryConfig> = {
  enabled: false,
  data: [
    {
      name: 'Clothing',
      slug: 'clothing',
      children: [
        { name: 'Men', slug: 'men' },
        { name: 'Women', slug: 'women' },
        { name: 'Kids', slug: 'kids' },
      ],
    },
    // ...
  ],
};
```

To customise defaults, edit the corresponding `src/config/*.ts` file; toggling `enabled` or changing `data` is all that is needed.

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

## Project-specific seeding flow

For this repository, the typical flow to fully prepare a new Saleor instance (catalog, products, manufacturers, blog) is:

0. (Optional, only when cloning an existing catalog and creating demo products) Seed catalog structures and sample products from exports, in this exact order (see detailed section above):

   ```bash
   # 1) Attributes → 2) Product types → 3) Categories → 4) Sample products
   npx tsx src/scripts/seeds/seed-attributes.ts <attributes-export.json>
   npx tsx src/scripts/seeds/seed-productTypes.ts <productTypes-export.json>
   npx tsx src/scripts/seeds/seed-categories.ts <categories-export.json>
   npx tsx src/scripts/seeds/seed-sample-products.ts --count=2
   ```

1. Seed manufacturer pages and attributes from logo images (only when logos change):

   - Place logo files under `public/manufacturers` (for example `aeg-logo.png`).
   - Generate/refresh `src/config/manufacturers.ts` and sync manufacturer pages + attributes:

   ```bash
   npx tsx src/scripts/seeds/seed-manufacturers.ts
   ```

2. Run the base seed (core configuration, page types, pages, menus):

   ```bash
   npm run seed
   ```

3. Seed demo blog posts (the script will relax the blog image attribute if still required):

   ```bash
   npx tsx src/scripts/seeds/seed-blog-posts.ts
   ```

You can re-run step 1 whenever you add or remove manufacturer logos; the base seed remains idempotent.

## Propagating data from an existing Saleor instance

In addition to seeding from static config, this repo includes several standalone scripts that can **replay** data exported from another Saleor via GraphQL queries and generate demo catalog data.

All three scripts:
- Use the same auth and `SALEOR_API_URL` settings as `npm run seed`
- Expect a **JSON file** containing the raw GraphQL response (`data.*.edges[...]`)
- Can be run with `npx tsx ...` but **must be run in this order**: Attributes → Product Types → Categories (later scripts depend on IDs created by earlier ones)

### 1. Attributes (definition + values)

Script:

```bash
npx tsx src/scripts/seeds/seed-attributes.ts src/scripts/grupo-bet/attributes-export.json
```

Expected JSON shape:

```jsonc
{
  "data": {
    "attributes": {
      "edges": [
        { "node": { /* Attribute fields + choices */ } }
      ]
    }
  }
}
```

Each attribute `node` should include:
- `name`, `slug`, `type`, `inputType`, `entityType`
- Flags: `valueRequired`, `visibleInStorefront`, `filterableInStorefront`, `filterableInDashboard`, `availableInGrid`, `storefrontSearchPosition`
- `choices.edges[*].node` with `name`, `value` (optional), `externalReference` (optional)

The script maps this into `AttributeCreateInput`:
- Copies all core fields and flags
- Converts `choices` into `values[]` (skipping empty lists)
- Calls `seedAttributes` to create them and populate `ctx.attributeIds` as usual.

### 2. Product types + product/variant attributes

Script:

```bash
npx tsx src/scripts/seeds/seed-productTypes.ts src/scripts/grupo-bet/productTypes-export.json
```

Expected JSON shape:

```jsonc
{
  "data": {
    "productTypes": {
      "edges": [
        { "node": { /* ProductType fields */ } }
      ]
    }
  }
}
```

Each `node` should include at least:
- `name`, `slug`, `kind`, `hasVariants`, `isShippingRequired`, `isDigital`
- Optional: `weight { value unit }`, `taxClass { id name }`
- `productAttributes[]` and `variantAttributes[]` with `slug`

The script builds `ProductTypeConfig` and fills:
- `productAttributeSlugs` from `productAttributes[*].slug`
- `variantAttributeSlugs` from `variantAttributes[*].slug`

Then it calls `seedProductTypes`, which creates the types and assigns attributes using the internal `SeedContext`.

### 3. Categories + subcategories

Script:

```bash
npx tsx src/scripts/seeds/seed-categories.ts src/scripts/grupo-bet/categories-subcategories-export.json
```

Expected JSON shape (top-level):

```jsonc
{
  "data": {
    "categories": {
      "edges": [
        { "node": { /* Category fields incl. children.edges */ } }
      ]
    }
  }
}
```

This script:
- Maps each root category and its `children.edges[*].node` to `CategoryConfig`
- Preserves `description` (rich text JSON), `seoTitle`/`seoDescription`, and `backgroundImage.url`
- Reuses the existing `seedCategories` logic to create the full tree.

### 4. Sample products (Grupo Bet demo)

Once you have propagated attributes, product types, and categories into the target Saleor instance with the three scripts above (and run the base `npm run seed` so that tax classes, warehouses, channels, etc. exist), you can quickly populate the catalog with demo products.

Script:

```bash
npx tsx src/scripts/seeds/seed-sample-products.ts --count=2
```

- **`--count`**: optional, exact number of demo products to create. If omitted, the script creates **2** demo products, choosing random leaf categories whose slugs exist in the target instance.
- Uses the same authentication/environment configuration as `npm run seed` (reads `SALEOR_API_URL`, `SALEOR_APP_TOKEN` / `SALEOR_EMAIL` + `SALEOR_PASSWORD`).
- Expects the export JSON files used by the propagation scripts in `src/scripts/grupo-bet/` (`attributes-export.json`, `productTypes-export.json`, `categories-subcategories-export.json`).
- Assumes there is a channel with slug `canal-test` and at least one warehouse (it will try `default-warehouse`, then `default`, and finally any available warehouse).
- Uploads product images from local files located at `public/products/product-<n>.png` (1-based index, up to 50 images) using a multipart request directly against the GraphQL API (those files must exist).

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
├── scripts/                  # one-off seed scripts (exports, demo data, etc.)
│   └── seeds/
│       ├── seed-blog-posts.ts
│       ├── seed-sample-products.ts
│       ├── seed-attributes.ts
│       ├── seed-productTypes.ts
│       ├── seed-categories.ts
│       └── seed-manufacturers.ts
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

## Documentation

Additional guides and context live in the **`docs/`** folder:

| Document | Description |
|----------|-------------|
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development overview: architecture (`apollo/`, `config/`, `seeders/`, `mutations/`, `scripts/`), seed configuration model, seeding pipeline and shared `SeedContext`, and how manufacturer/blog scripts fit in. |
| [docs/large_project.md](docs/large_project.md) | Integrating this script into a larger project: standalone usage, embedding under `scripts/seed/` in a UI repo, or using it as a Git submodule, with setup examples. |

Use these when onboarding, extending seeders, or wiring the script into an existing codebase.
