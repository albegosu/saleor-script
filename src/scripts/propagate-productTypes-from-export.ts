import 'dotenv/config';
import { initAuth } from '../apollo/apollo-client.js';
import { createEmptyContext, type SeedContext } from '../seeders/utils.js';
import { seedProductTypes } from '../seeders/productTypes.js';
import { fetchAttributeIdsBySlug } from '../queries/attributes.js';
import type { SeederSection, ProductTypeConfig } from '../config/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

interface ProductAttributeRef {
  id: string;
  name: string;
  slug: string;
}

interface ProductTypeExportNode {
  id: string;
  name: string;
  slug: string;
  kind: 'NORMAL' | 'GIFT_CARD';
  hasVariants: boolean;
  isShippingRequired: boolean;
  isDigital: boolean;
  weight: { value: number; unit: string } | null;
  taxClass: { id: string; name: string } | null;
  productAttributes: ProductAttributeRef[];
  variantAttributes: ProductAttributeRef[];
}

interface ProductTypesExport {
  data: {
    productTypes: {
      edges: { node: ProductTypeExportNode }[];
    };
  };
}

function toProductTypeConfig(node: ProductTypeExportNode): ProductTypeConfig {
  const config: ProductTypeConfig = {
    name: node.name,
    slug: node.slug,
    kind: node.kind,
    hasVariants: node.hasVariants,
    isShippingRequired: node.isShippingRequired,
    isDigital: node.isDigital,
  };

  if (node.weight) {
    config.weight = {
      value: node.weight.value,
      unit: node.weight.unit,
    };
  }

  if (node.taxClass) {
    // ProductTypeInput.taxClass expects an ID string.
    config.taxClass = node.taxClass.id;
  }

  if (node.productAttributes?.length) {
    config.productAttributeSlugs = node.productAttributes.map((attr) => attr.slug);
  }

  if (node.variantAttributes?.length) {
    config.variantAttributeSlugs = node.variantAttributes.map((attr) => attr.slug);
  }

  return config;
}

async function loadExport(filePath: string): Promise<ProductTypesExport> {
  const absPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absPath, 'utf8');
  return JSON.parse(raw) as ProductTypesExport;
}

async function main(): Promise<void> {
  const [filePath] = process.argv.slice(2);

  if (!filePath) {
    console.error(
      'Usage: tsx src/scripts/propagate-productTypes-from-export.ts <productTypes-export.json>',
    );
    process.exit(1);
  }

  if (!process.env.SALEOR_API_URL) {
    console.error('Error: SALEOR_API_URL is not set in environment (.env).');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Propagate Product Types from Export      ║');
  console.log('╚════════════════════════════════════════════╝');

  console.log('\n[Auth]');
  await initAuth();

  console.log('\n[Load export]');
  const exportData = await loadExport(filePath);
  const nodes = exportData.data.productTypes.edges.map(({ node }) => node);

  const section: SeederSection<ProductTypeConfig> = {
    enabled: true,
    data: nodes.map((node) => toProductTypeConfig(node)),
  };

  const ctx: SeedContext = createEmptyContext();

  console.log('\n[Fetch existing attributes]');
  ctx.attributeIds = await fetchAttributeIdsBySlug();
  console.log(`  Loaded ${Object.keys(ctx.attributeIds).length} attribute(s) from API.`);

  console.log('\n[Seed Product Types]');
  await seedProductTypes(section, ctx);

  console.log('\n✔ Product type propagation complete.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal: ${message}`);
  process.exit(1);
});

