import 'dotenv/config';
import { initAuth } from '../apollo/apollo-client.js';
import { createEmptyContext, type SeedContext } from '../seeders/utils.js';
import { seedAttributes } from '../seeders/attributes.js';
import type { SeederSection } from '../config/index.js';
import type {
  AttributeCreateInput,
  AttributeValueCreateInput,
} from '../mutations/attribute.js';
import fs from 'node:fs/promises';
import path from 'node:path';

interface AttributeChoiceNode {
  id: string;
  name: string;
  slug: string;
  value: string;
  externalReference: string | null;
}

interface AttributeExportNode {
  id: string;
  name: string;
  slug: string;
  type: 'PRODUCT_TYPE' | 'PAGE_TYPE';
  inputType:
    | 'DROPDOWN'
    | 'MULTISELECT'
    | 'FILE'
    | 'REFERENCE'
    | 'NUMERIC'
    | 'RICH_TEXT'
    | 'PLAIN_TEXT'
    | 'SWATCH'
    | 'BOOLEAN'
    | 'DATE'
    | 'DATE_TIME';
  entityType: 'PAGE' | 'PRODUCT' | 'PRODUCT_VARIANT' | null;
  referenceTypes: { name: string };
  valueRequired: boolean;
  visibleInStorefront: boolean;
  filterableInStorefront: boolean;
  filterableInDashboard: boolean;
  availableInGrid: boolean;
  storefrontSearchPosition: number;
  choices: {
    edges: { node: AttributeChoiceNode }[];
  };
}

interface AttributesExport {
  data: {
    attributes: {
      edges: { node: AttributeExportNode }[];
    };
  };
}

function toAttributeValues(nodes: AttributeChoiceNode[]): AttributeValueCreateInput[] | undefined {
  if (!nodes.length) return undefined;

  const values: AttributeValueCreateInput[] = nodes.map((node) => {
    const value: AttributeValueCreateInput = {
      name: node.name,
    };
    if (node.value) {
      value.value = node.value;
    }
    if (node.externalReference) {
      value.externalReference = node.externalReference;
    }
    return value;
  });

  return values.length > 0 ? values : undefined;
}

function toAttributeConfig(node: AttributeExportNode): AttributeCreateInput {
  const config: AttributeCreateInput = {
    name: node.name,
    slug: node.slug,
    type: node.type,
    inputType: node.inputType,
    valueRequired: node.valueRequired,
    visibleInStorefront: node.visibleInStorefront,
    filterableInStorefront: node.filterableInStorefront,
    filterableInDashboard: node.filterableInDashboard,
    availableInGrid: node.availableInGrid,
  };

  if (node.entityType) {
    config.entityType = node.entityType;
  }

  if (typeof node.storefrontSearchPosition === 'number') {
    config.storefrontSearchPosition = node.storefrontSearchPosition;
  }

  const valueNodes = node.choices?.edges?.map(({ node: choice }) => choice) ?? [];
  const values = toAttributeValues(valueNodes);

  if (values) {
    config.values = values;
  }

  return config;
}

async function loadExport(filePath: string): Promise<AttributesExport> {
  const absPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absPath, 'utf8');
  return JSON.parse(raw) as AttributesExport;
}

async function main(): Promise<void> {
  const [filePath] = process.argv.slice(2);

  if (!filePath) {
    console.error(
      'Usage: tsx src/scripts/propagate-attributes-from-export.ts <attributes-export.json>',
    );
    process.exit(1);
  }

  if (!process.env.SALEOR_API_URL) {
    console.error('Error: SALEOR_API_URL is not set in environment (.env).');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Propagate Attributes from Export    ║');
  console.log('╚══════════════════════════════════════╝');

  console.log('\n[Auth]');
  await initAuth();

  console.log('\n[Load export]');
  const exportData = await loadExport(filePath);
  const nodes = exportData.data.attributes.edges.map(({ node }) => node);

  const section: SeederSection<AttributeCreateInput> = {
    enabled: true,
    data: nodes.map((node) => toAttributeConfig(node)),
  };

  const ctx: SeedContext = createEmptyContext();

  console.log('\n[Seed Attributes]');
  await seedAttributes(section, ctx);

  console.log('\n✔ Attribute propagation complete.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal: ${message}`);
  process.exit(1);
});

