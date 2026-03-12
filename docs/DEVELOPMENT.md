## Development overview

This repository is a Node.js seeding tool for Saleor. It connects to a Saleor GraphQL API and creates or updates core structures that a storefront or backoffice expects to find: catalog taxonomies, basic configuration, generic pages, manufacturer pages, and demo blog content.

At a high level the code is organised into:

- `apollo/`: low-level Apollo Client used by all seeders and scripts.
- `config/`: declarative seed configuration (what should exist).
- `seeders/`: imperative logic that turns config into GraphQL mutations (how to create it).
- `mutations/` + `queries/`: typed GraphQL documents shared across seeders and one-off scripts.
- `scripts/`: specialised scripts that are not part of the main `npm run seed` flow.

The entry point is `src/index.ts`, which reads CLI flags, loads `config`, and runs each seeder in the correct order using a shared `SeedContext`.

## Seed configuration model

All seed data lives under `src/config/`:

- `taxClasses.ts`, `warehouses.ts`, `channels.ts`, `shipping.ts`, `attributes.ts`, `productTypes.ts`, `categories.ts`, `collections.ts`, `pageTypes.ts`, `pages.ts`, `menus.ts` describe what should exist.
- `index.ts` assembles the final `SeedConfig` consumed by the orchestrator.

Most files export a `SeederSection<T>`:

- `enabled: boolean` controls whether that section runs by default in `npm run seed`.
- `data: T[]` is the list of items to create.

`src/config/index.ts` merges additional page sources into the main pages section:

- `pagesBase`: core legal/standard pages.
- `companyPages`: company-specific landing pages.
- `manufacturerPages`: auto-generated manufacturer landing pages (see below).

## Seeding pipeline and context

`src/seeders/` contains one seeder per structure type. They all share:

- A `SeedContext` from `seeders/utils.ts` that stores IDs created so far (tax classes, attributes, page types, pages, etc.).
- A common `executeMutation` helper that standardises logging and error handling.

The orchestrator always runs sections in this order:

1. Tax classes
2. Warehouses
3. Channels
4. Shipping
5. Attributes
6. Product types
7. Categories
8. Collections
9. Page types
10. Pages
11. Menus

Later seeders only use IDs from the context; they never hard-code UUIDs. This keeps the flow repeatable across environments and Saleor instances.

## Manufacturers flow

Manufacturers are driven from logo images and turned into pages in two steps:

1. **Generate page configs from images**

   - Put logo files under `public/manufacturers` (for example `aeg-logo.png`).
   - Run:

   ```bash
   npx tsx src/scripts/seeds/seed-manufacturers.ts
   ```

   This script:

   - Scans `public/manufacturers`.
   - Derives a human title and slug for each file.
   - Regenerates `src/config/manufacturers.ts` exporting `manufacturerPages: PageConfig[]`.
   - Those configs are merged into `config.pages.data` in `src/config/index.ts`.

2. **Create pages and update attributes**

   - `npm run seed` creates:
     - The `fabricantes` page type (from `config/pageTypes.ts`).
     - One page per entry in `manufacturerPages`.
   - `npx tsx src/scripts/update-manufacturers-attributes.ts` then:
     - Looks up attribute IDs by slug (`marca`, `activo`, `mostrar-en-la-home-y-pagina-de-fabricantes`, and optionally `logo`).
     - Fetches existing pages by slug.
     - Updates each manufacturer page with attribute values (brand name, booleans, logo path).

You only need to re-run the propagation script and the attributes script when the set of manufacturer logos changes.

## Blog flow

Blog content is added on top of the base seed using dedicated scripts and attributes:

1. **Prerequisites**

   - A page type with slug `post` must exist (created by `config/pageTypes.ts` + `seedPageTypes`).
   - Blog-related attributes must exist, at least:
     - `title-post`
     - `content-post`
     - Optionally `imagen-post` (see below).
   - Blog menu entries live in `config/menus.ts` and point to slugs `post-blog-1` .. `post-blog-10`.

2. **Relax the optional image attribute (one-time)**

   ```bash
   npx tsx src/scripts/relax-blog-image-attribute.ts
   ```

   This script:

   - Finds the attribute with slug `imagen-post`.
   - If `valueRequired` is `true`, sends an `AttributeUpdate` to set it to `false`.

3. **Seed blog posts**

   ```bash
   npx tsx src/scripts/seeds/seed-blog-posts.ts
   ```

   Behaviour:

   - Resolves the page type ID for slug `post`.
   - Resolves attribute IDs for slugs `title-post` and `content-post`.
   - Builds 10 blog-page configs (`post-blog-1` .. `post-blog-10`) associated with images under `public/blog/`.
   - Calls `PageCreate` for each post, wiring attributes and SEO fields.

Once this script has been run, the `Blog` menu (seeded by `npm run seed`) points to real post pages.

## One-off propagation scripts

The following scripts replay data exported from another Saleor instance into the current target:

- `src/scripts/seeds/seed-attributes-from-export.ts`
- `src/scripts/seeds/seed-productTypes.ts`
- `src/scripts/seeds/seed-categories.ts`
- `src/scripts/seeds/seed-sample-products.ts`

They are documented in detail in `README.md` and should be run in the given order (attributes → product types → categories → sample products) when cloning an existing catalog.

## Adding new seed sections

To add a new type of seeded structure:

1. Add configuration under `src/config/`:

   - Define a TypeScript interface for the config if needed.
   - Export a `SeederSection<T>` with `enabled` and `data`.
   - Wire it into `SeedConfig` in `src/config/index.ts`.

2. Add a seeder under `src/seeders/`:

   - Export a `seedXxx(section, ctx)` function.
   - Use `executeMutation` for GraphQL calls.
   - Store any relevant IDs in `SeedContext` for later sections.

3. Register the new seeder in `src/index.ts` in the correct position with respect to dependencies.

4. Extend tests or manual scripts as needed to verify the new flow against a development Saleor instance.

