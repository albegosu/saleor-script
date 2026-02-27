import 'dotenv/config';
import { initAuth } from './apollo/apollo-client.js';
import { config } from './config/defaults.js';
import { createEmptyContext } from './seeders/utils.js';
import { seedTaxClasses } from './seeders/taxClasses.js';
import { seedWarehouses } from './seeders/warehouses.js';
import { seedChannels } from './seeders/channels.js';
import { seedShipping } from './seeders/shipping.js';
import { seedAttributes } from './seeders/attributes.js';
import { seedProductTypes } from './seeders/productTypes.js';
import { seedCategories } from './seeders/categories.js';
import { seedCollections } from './seeders/collections.js';
import { seedPageTypes } from './seeders/pageTypes.js';
import { seedPages } from './seeders/pages.js';
import { seedMenus } from './seeders/menus.js';
import type { SeedConfig } from './config/defaults.js';

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------
type SectionKey = keyof SeedConfig;

const ALL_SECTIONS: SectionKey[] = [
  'taxClasses',
  'warehouses',
  'channels',
  'shipping',
  'attributes',
  'productTypes',
  'categories',
  'collections',
  'pageTypes',
  'pages',
  'menus',
];

/**
 * Dependencies: a section may only run after the sections it depends on.
 * Used to warn the user when a required dependency is being skipped.
 */
const DEPENDENCIES: Partial<Record<SectionKey, SectionKey[]>> = {
  channels: ['taxClasses', 'warehouses'],
  shipping: ['channels', 'warehouses'],
  productTypes: ['attributes'],
  collections: ['channels'],
  pages: ['pageTypes'],
  menus: ['categories', 'collections', 'pages'],
};

function parseCliArgs(): { only: SectionKey[] | null; skip: SectionKey[] } {
  const args = process.argv.slice(2);
  let only: SectionKey[] | null = null;
  const skip: SectionKey[] = [];

  for (const arg of args) {
    const onlyMatch = arg.match(/^--only=(.+)$/);
    const skipMatch = arg.match(/^--skip=(.+)$/);

    if (onlyMatch) {
      only = onlyMatch[1].split(',').map((s) => s.trim()) as SectionKey[];
    } else if (skipMatch) {
      skip.push(...(skipMatch[1].split(',').map((s) => s.trim()) as SectionKey[]));
    }
  }

  return { only, skip };
}

function resolveSections(
  { only, skip }: { only: SectionKey[] | null; skip: SectionKey[] },
): SectionKey[] {
  // Start from all sections enabled in config
  let active = ALL_SECTIONS.filter((key) => config[key].enabled);

  // --only overrides the enabled flags entirely
  if (only !== null) {
    active = only.filter((key) => ALL_SECTIONS.includes(key));
  }

  // --skip removes entries (applied after --only)
  if (skip.length > 0) {
    active = active.filter((key) => !skip.includes(key));
  }

  return active;
}

function warnMissingDependencies(sections: SectionKey[]): void {
  const activeSet = new Set(sections);

  for (const section of sections) {
    const deps = DEPENDENCIES[section];
    if (!deps) continue;

    for (const dep of deps) {
      if (!activeSet.has(dep)) {
        console.warn(
          `  ⚠ Warning: "${section}" depends on "${dep}", but "${dep}" is not enabled. ` +
            `IDs may be missing and the seeder may fail or skip items.`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Seeder registry — maps section key → function
// ---------------------------------------------------------------------------
async function runSection(key: SectionKey, ctx: ReturnType<typeof createEmptyContext>): Promise<void> {
  switch (key) {
    case 'taxClasses':
      await seedTaxClasses(config.taxClasses, ctx);
      break;
    case 'warehouses':
      await seedWarehouses(config.warehouses, ctx);
      break;
    case 'channels':
      await seedChannels(config.channels, ctx);
      break;
    case 'shipping':
      await seedShipping(config.shipping, ctx);
      break;
    case 'attributes':
      await seedAttributes(config.attributes, ctx);
      break;
    case 'productTypes':
      await seedProductTypes(config.productTypes, ctx);
      break;
    case 'categories':
      await seedCategories(config.categories, ctx);
      break;
    case 'collections':
      await seedCollections(config.collections, ctx);
      break;
    case 'pageTypes':
      await seedPageTypes(config.pageTypes, ctx);
      break;
    case 'pages':
      await seedPages(config.pages, ctx);
      break;
    case 'menus':
      await seedMenus(config.menus, ctx);
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════╗');
  console.log('║   Saleor Default Structures Seed  ║');
  console.log('╚═══════════════════════════════════╝');

  // Validate required env
  if (!process.env.SALEOR_API_URL) {
    console.error('Error: SALEOR_API_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  // Resolve which sections to run
  const cliArgs = parseCliArgs();
  const sections = resolveSections(cliArgs);

  if (sections.length === 0) {
    console.log('No sections to run. Check your config or --only/--skip flags.');
    process.exit(0);
  }

  console.log(`\nSections to run: ${sections.join(', ')}`);
  warnMissingDependencies(sections);

  // Authenticate
  console.log('\n[Auth]');
  await initAuth();

  // Run seeders in order, passing shared context
  const ctx = createEmptyContext();

  for (const key of sections) {
    try {
      await runSection(key, ctx);
    } catch (err) {
      console.error(`\n  ✖ Fatal error in section "${key}":`, err);
      console.error('  Continuing with remaining sections...');
    }
  }

  console.log('\n✔ Seeding complete.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal: ${message}`);
  process.exit(1);
});
