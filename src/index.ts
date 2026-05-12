import 'dotenv/config';
import { initAuth, initStaffAuth } from './apollo/apollo-client.js';
import { config } from './config/index.js';
import { createEmptyContext } from './seeders/utils.js';
import { seedTaxClasses } from './seeders/taxClasses.js';
import { seedWarehouses } from './seeders/warehouses.js';
import { seedChannels } from './seeders/channels.js';
import { seedShipping } from './seeders/shipping.js';
import { seedAttributes, hydrateAttributeIdsFromApi } from './seeders/attributes.js';
import { seedProductTypes } from './seeders/productTypes.js';
import { seedCategories } from './seeders/categories.js';
import { seedCollections } from './seeders/collections.js';
import { seedPageTypes } from './seeders/pageTypes.js';
import { seedPages } from './seeders/pages.js';
import { seedMenus } from './seeders/menus.js';
import { seedPermissionGroups } from './seeders/permissionGroups.js';
import type { SeedConfig } from './config/index.js';

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
  'permissionGroups',
];

/**
 * Direct dependencies: each section must run after these sections (transitive
 * closure is applied in {@link expandSectionsWithDependencies}).
 */
const DEPENDENCIES: Partial<Record<SectionKey, SectionKey[]>> = {
  channels: ['taxClasses', 'warehouses'],
  shipping: ['channels', 'warehouses'],
  productTypes: ['attributes'],
  collections: ['channels'],
  pageTypes: ['attributes'],
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

/**
 * Adds any missing prerequisite sections and returns the list sorted like
 * {@link ALL_SECTIONS}. Fails if a dependency is `--skip`ped or disabled in config.
 *
 * @param sections - Sections selected after `--only` / `--skip` / `enabled` flags
 * @param skip - Section keys passed with `--skip` (must not block a required dep)
 * @returns Same sections plus dependencies, in canonical seed order
 */
function expandSectionsWithDependencies(
  sections: SectionKey[],
  skip: SectionKey[],
): SectionKey[] {
  const skipSet = new Set(skip);
  const expanded = new Set<SectionKey>(sections);

  for (;;) {
    let addedAny = false;
    for (const section of [...expanded]) {
      const deps = DEPENDENCIES[section];
      if (!deps) continue;

      for (const dep of deps) {
        if (skipSet.has(dep)) {
          console.error(
            `Error: la sección "${section}" requiere "${dep}", pero "${dep}" está en --skip. ` +
              `Quita "${dep}" de --skip o no ejecutes "${section}".`,
          );
          process.exit(1);
        }

        if (!expanded.has(dep)) {
          if (!config[dep].enabled) {
            console.error(
              `Error: "${section}" requiere que "${dep}" se ejecute antes, pero "${dep}" está ` +
                `deshabilitada en la configuración (src/config). Actívala o ajusta --only.`,
            );
            process.exit(1);
          }
          expanded.add(dep);
          addedAny = true;
        }
      }
    }
    if (!addedAny) break;
  }

  return [...expanded].sort((a, b) => ALL_SECTIONS.indexOf(a) - ALL_SECTIONS.indexOf(b));
}

function warnMissingDependencies(sections: SectionKey[]): void {
  const activeSet = new Set(sections);

  for (const section of sections) {
    const deps = DEPENDENCIES[section];
    if (!deps) continue;

    for (const dep of deps) {
      if (!activeSet.has(dep)) {
        console.warn(
          `  ⚠ Aviso: "${section}" depende de "${dep}", pero "${dep}" no está activada. ` +
            'Es posible que falten IDs y que el seeder falle u omita elementos.',
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
    case 'permissionGroups':
      await seedPermissionGroups(config.permissionGroups);
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════╗');
  console.log('║  Seed de estructuras por defecto  ║');
  console.log('╚═══════════════════════════════════╝');

  // Validate required env
  if (!process.env.SALEOR_API_URL) {
    console.error(
      'Error: SALEOR_API_URL no está definida. Copia .env.example a .env y rellena los valores.',
    );
    process.exit(1);
  }

  // Resolve which sections to run
  const cliArgs = parseCliArgs();
  const requested = resolveSections(cliArgs);

  if (requested.length === 0) {
    console.log(
      'No hay secciones para ejecutar. Revisa la configuración o los flags --only/--skip.',
    );
    process.exit(0);
  }

  const sections = expandSectionsWithDependencies(requested, cliArgs.skip);
  const injected = sections.filter((key) => !requested.includes(key));
  if (injected.length > 0) {
    console.log(
      `\nSecciones añadidas por dependencias: ${injected.join(', ')} ` +
        '(se ejecutan antes que las que las requieren).',
    );
  }

  console.log(`\nSecciones a ejecutar: ${sections.join(', ')}`);
  warnMissingDependencies(sections);

  // Authenticate
  console.log('\n[Autenticación]');
  if (sections.includes('permissionGroups')) {
    await initStaffAuth();
  } else {
    await initAuth();
  }

  // Run seeders in order, passing shared context
  const ctx = createEmptyContext();

  for (const key of sections) {
    try {
      if (key === 'attributes' && injected.includes('attributes')) {
        await hydrateAttributeIdsFromApi(ctx);
      } else {
        await runSection(key, ctx);
      }
    } catch (err) {
      console.error(`\n  ✖ Error fatal en la sección "${key}":`, err);
      console.error('  Continuando con las secciones restantes...');
    }
  }

  console.log('\n✔ Seed completado.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});
