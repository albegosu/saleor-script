import 'dotenv/config';
import { initAuth } from '../../apollo/apollo-client.js';
import { createEmptyContext, type SeedContext } from '../../seeders/utils.js';
import { seedCategories } from '../../seeders/categories.js';
import type { SeederSection, CategoryConfig } from '../../config/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

interface CategoryExportNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  backgroundImage: { url: string; alt: string } | null;
  level: number;
  parent: { id: string } | null;
  children?: {
    edges: { node: CategoryExportNode }[];
  };
}

interface CategoriesExport {
  data: {
    categories: {
      edges: { node: CategoryExportNode }[];
    };
  };
}

function toCategoryConfig(node: CategoryExportNode): CategoryConfig {
  const config: CategoryConfig = {
    name: node.name,
    slug: node.slug,
  };

  if (node.description) {
    // Keep raw rich-text JSON string as-is; CategoryInput.description is `unknown`.
    config.description = node.description;
  }

  if (node.seoTitle || node.seoDescription) {
    config.seo = {};
    if (node.seoTitle) {
      config.seo.title = node.seoTitle;
    }
    if (node.seoDescription) {
      config.seo.description = node.seoDescription;
    }
  }

  if (node.backgroundImage) {
    config.backgroundImage = node.backgroundImage.url;
    if (node.backgroundImage.alt) {
      config.backgroundImageAlt = node.backgroundImage.alt;
    }
  }

  if (node.children && node.children.edges.length > 0) {
    config.children = node.children.edges.map(({ node: child }) => toCategoryConfig(child));
  }

  return config;
}

async function loadExport(filePath: string): Promise<CategoriesExport> {
  const absPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absPath, 'utf8');
  return JSON.parse(raw) as CategoriesExport;
}

async function main(): Promise<void> {
  const [filePath] = process.argv.slice(2);

  if (!filePath) {
    console.error(
      'Usage: tsx src/scripts/seeds/seed-categories.ts <categories-export.json>',
    );
    process.exit(1);
  }

  if (!process.env.SALEOR_API_URL) {
    console.error(
      'Error: SALEOR_API_URL no está definida en el entorno (.env).',
    );
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Propagar categorías desde un export║');
  console.log('╚══════════════════════════════════════╝');

  console.log('\n[Autenticación]');
  await initAuth();

  console.log('\n[Cargar export]');
  const exportData = await loadExport(filePath);
  const roots = exportData.data.categories.edges.map(({ node }) => node);

  const section: SeederSection<CategoryConfig> = {
    enabled: true,
    data: roots.map((node) => toCategoryConfig(node)),
  };

  const ctx: SeedContext = createEmptyContext();

  console.log('\n[Seed de categorías]');
  await seedCategories(section, ctx);

  console.log('\n✔ Propagación de categorías completada.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});

