import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initAuth, getAuthHeaders } from '../apollo/apollo-client.js';
import { slugify, executeMutation, logError } from '../seeders/utils.js';
import { fetchAttributeIdsBySlug } from '../queries/attributes.js';
import { fetchChannelIdsBySlug } from '../queries/channels.js';
import { fetchWarehouseIdsBySlug } from '../queries/warehouses.js';
import { fetchCategoryIdsBySlug } from '../queries/categories.js';
import { fetchProductTypeIdsBySlug } from '../queries/productTypes.js';
import {
  PRODUCT_CREATE,
  PRODUCT_CHANNEL_LISTING_UPDATE,
  PRODUCT_VARIANT_CREATE,
  PRODUCT_VARIANT_CHANNEL_LISTING_UPDATE,
  type AttributeValueInput,
  type ProductCreateInput,
  type ProductCreateResult,
  type ProductChannelListingUpdateInput,
  type ProductChannelListingUpdateResult,
  type ProductVariantCreateInput,
  type ProductVariantCreateResult,
  type ProductVariantChannelListingAddInput,
  type ProductVariantChannelListingUpdateResult,
} from '../mutations/product.js';
import { apollo } from '../apollo/apollo-client.js';
import fetch from 'cross-fetch';
import FormData from 'form-data';

interface CategoryExportNode {
  id: string;
  name: string;
  slug: string;
  children?: { edges: { node: CategoryExportNode }[] };
}

interface CategoriesExport {
  data: {
    categories: {
      edges: { node: CategoryExportNode }[];
    };
  };
}

interface ProductTypeAttributeRef {
  id: string;
  name: string;
  slug: string;
}

interface ProductTypeExportNode {
  id: string;
  name: string;
  slug: string;
  productAttributes: ProductTypeAttributeRef[];
  variantAttributes: ProductTypeAttributeRef[];
}

interface ProductTypesExport {
  data: {
    productTypes: {
      edges: { node: ProductTypeExportNode }[];
    };
  };
}

interface AttributeChoiceNode {
  id: string;
  name: string;
  slug: string;
  value: string;
}

interface AttributeExportNode {
  id: string;
  name: string;
  slug: string;
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

interface SampleProductSpec {
  name: string;
  description: string;
  categorySlug: string;
  productTypeSlug: string;
  basePrice: number;
  stockQuantity: number;
  imageFileIndex: number;
}

async function loadJson<T>(relativePath: string): Promise<T> {
  const absPath = path.resolve(process.cwd(), relativePath);
  const raw = await fs.readFile(absPath, 'utf8');
  return JSON.parse(raw) as T;
}

async function uploadProductImageFromFile(options: {
  productId: string;
  alt: string;
  fileIndex: number;
}): Promise<void> {
  const { productId, alt, fileIndex } = options;

  const apiUrl = process.env.SALEOR_API_URL;
  if (!apiUrl) {
    throw new Error('SALEOR_API_URL no está definido en el entorno.');
  }

  const filePath = path.resolve(process.cwd(), `public/products/product-${fileIndex}.png`);
  const fileBuffer = await fs.readFile(filePath);

  const form = new FormData();

  const query = `
    mutation ProductMediaCreateFromFile($productId: ID!, $file: Upload!, $alt: String) {
      productMediaCreate(input: { product: $productId, image: $file, alt: $alt }) {
        media {
          id
          url
          alt
        }
        errors {
          field
          message
          code
        }
      }
    }
  `;

  const operations = JSON.stringify({
    query,
    variables: {
      productId,
      file: null,
      alt,
    },
  });

  const map = JSON.stringify({
    '0': ['variables.file'],
  });

  form.append('operations', operations);
  form.append('map', map);
  form.append('0', fileBuffer, {
    filename: `product-${fileIndex}.png`,
    contentType: 'image/png',
  });

  const headers = {
    ...getAuthHeaders(),
    ...form.getHeaders(),
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: form as unknown as BodyInit,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} al subir imagen: ${text}`);
  }

  const result = (await response.json()) as {
    data?: {
      productMediaCreate?: {
        media: { id: string } | null;
        errors: { field: string | null; message: string; code: string }[];
      };
    };
    errors?: { message: string }[];
  };

  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Errores GraphQL al subir imagen: ${result.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const mediaResult = result.data?.productMediaCreate;
  const mediaErrors = mediaResult?.errors ?? [];
  if (mediaErrors.length > 0) {
    logError('ProductMedia', alt, mediaErrors);
  }
}

function collectLeafCategories(roots: CategoryExportNode[]): CategoryExportNode[] {
  const leaves: CategoryExportNode[] = [];

  const visit = (node: CategoryExportNode): void => {
    const children = node.children?.edges?.map((e) => e.node) ?? [];
    if (children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of children) visit(child);
    }
  };

  for (const root of roots) visit(root);
  return leaves;
}

function pickDefaultProductType(types: ProductTypeExportNode[]): ProductTypeExportNode {
  const bySlug = types.find((t) => t.slug === 'default-type');
  return bySlug ?? types[0];
}

function buildProductAttributesForType(
  typeNode: ProductTypeExportNode,
  attributeIdsBySlug: Record<string, string>,
): AttributeValueInput[] {
  const attrs: AttributeValueInput[] = [];

  for (const ref of typeNode.productAttributes) {
    const id = attributeIdsBySlug[ref.slug];
    if (!id) continue;

    let value = 'Demo';
    if (ref.slug === 'sku') value = 'DEMO-SKU';
    else if (ref.slug === 'stock-total') value = '100';
    else if (ref.slug === 'color') value = 'azul';

    attrs.push({
      id,
      plainText: value,
    });
  }

  return attrs;
}

function buildVariantAttributesForType(
  typeNode: ProductTypeExportNode,
  attributeIdsBySlug: Record<string, string>,
): AttributeValueInput[] {
  const attrs: AttributeValueInput[] = [];

  for (const ref of typeNode.variantAttributes) {
    const id = attributeIdsBySlug[ref.slug];
    if (!id) continue;

    let value = 'Demo';
    if (ref.slug === 'garantia') value = '5';
    else if (ref.slug === 'color') value = 'negro';

    attrs.push({
      id,
      plainText: value,
    });
  }

  return attrs;
}

async function createProductWithVariant(options: {
  spec: SampleProductSpec;
  productTypeId: string;
  categoryId: string;
  channelId: string;
  warehouseId: string;
  productAttributes: AttributeValueInput[];
}): Promise<void> {
  const { spec, productTypeId, categoryId, channelId, warehouseId } = options;

  const slug = slugify(spec.name);

  const productInput: ProductCreateInput = {
    name: spec.name,
    slug,
    productType: productTypeId,
    category: categoryId,
    // Saleor expects JSONString (raw JSON) for description, no auto-wrapping.
    // Use a minimal Editor.js-style rich text document.
    description: JSON.stringify({
      time: Date.now(),
      blocks: [
        {
          type: 'paragraph',
          data: {
            text: spec.description,
          },
        },
      ],
      version: '2.30.7',
    }),
    // NOTE: product-level attributes are intentionally skipped here because
    // in this environment the product type is not yet configured with
    // the attribute IDs coming from the export (Saleor returns NOT_FOUND for them).
    // The goal of this script is to quickly populate the catalogue with
    // navigable products; you can add attributes later as you refine your
    // product type schema.
  };

  const { data: productData, hasError: productHasError } = await executeMutation<ProductCreateResult>(
    () =>
      apollo.mutate({
        mutation: PRODUCT_CREATE,
        variables: { input: productInput },
        errorPolicy: 'all',
      }),
    'Product',
    spec.name,
  );

  if (productHasError) return;

  const productResult = productData?.productCreate;
  const productErrors = productResult?.errors ?? [];
  if (productErrors.length > 0 || !productResult?.product) {
    if (productErrors.length > 0) {
      logError('Product', spec.name, productErrors);
    } else {
      console.error(
        `  ✖ Producto: "${spec.name}" ha fallado — la API no ha devuelto ningún producto`,
      );
    }
    return;
  }

  const productId = productResult.product.id;

  // Attach media from local file (multipart upload)
  try {
    await uploadProductImageFromFile({
      productId,
      alt: spec.name,
      fileIndex: spec.imageFileIndex,
    });
  } catch (err) {
    console.error(`  ⚠ ProductMedia: "${spec.name}" ha fallado al subir la imagen desde archivo:`, err);
  }

  const channelInput: ProductChannelListingUpdateInput = {
    updateChannels: [
      {
        channelId,
        isPublished: true,
        visibleInListings: true,
        isAvailableForPurchase: true,
      },
    ],
  };

  const { hasError: listingHasError } =
    await executeMutation<ProductChannelListingUpdateResult>(
      () =>
        apollo.mutate({
          mutation: PRODUCT_CHANNEL_LISTING_UPDATE,
          variables: { id: productId, input: channelInput },
          errorPolicy: 'all',
        }),
      'ProductChannelListing',
      spec.name,
    );

  if (listingHasError) return;

  const variantInput: ProductVariantCreateInput = {
    product: productId,
    name: `${spec.name} Variante 1`,
    sku: `${slug}-v1`,
    // Skip variant attributes — current product type in this instance
    // does not allow the attribute IDs from the export as variant attrs.
    attributes: [],
    stocks: [
      {
        warehouse: warehouseId,
        quantity: spec.stockQuantity,
      },
    ],
  };

  const { data: variantData, hasError: variantHasError } =
    await executeMutation<ProductVariantCreateResult>(
      () =>
        apollo.mutate({
          mutation: PRODUCT_VARIANT_CREATE,
          variables: { input: variantInput },
          errorPolicy: 'all',
        }),
      'ProductVariant',
      spec.name,
    );

  if (variantHasError) return;

  const variantResult = variantData?.productVariantCreate;
  const variantErrors = variantResult?.errors ?? [];
  if (variantErrors.length > 0 || !variantResult?.productVariant) {
    if (variantErrors.length > 0) {
      logError('ProductVariant', spec.name, variantErrors);
    } else {
      console.error(
        `  ✖ Variante de producto: "${spec.name}" ha fallado — la API no ha devuelto ninguna variante`,
      );
    }
    return;
  }

  const variantId = variantResult.productVariant.id;

  // Set variant price in channel
  const priceInput: ProductVariantChannelListingAddInput = {
    channelId,
    price: spec.basePrice.toFixed(2),
  };

  const { data: listingData } =
    await executeMutation<ProductVariantChannelListingUpdateResult>(
      () =>
        apollo.mutate({
          mutation: PRODUCT_VARIANT_CHANNEL_LISTING_UPDATE,
          variables: { id: variantId, input: [priceInput] },
          errorPolicy: 'all',
        }),
      'ProductVariantChannelListing',
      spec.name,
    );

  const listingErrors = listingData?.productVariantChannelListingUpdate?.errors ?? [];
  if (listingErrors.length > 0) {
    logError('ProductVariantChannelListing', spec.name, listingErrors);
  }

  console.log(
    `  ✔ Producto "${spec.name}" (${productId}) creado con la variante "${variantResult.productVariant.name}"`,
  );
}

function parseCountFromArgs(): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--count='));
  if (!arg) return 2;
  const value = Number(arg.substring('--count='.length));
  if (Number.isNaN(value) || value <= 0) return 2;
  return value;
}

async function main(): Promise<void> {
  if (!process.env.SALEOR_API_URL) {
    console.error(
      'Error: SALEOR_API_URL no está definida en el entorno (.env).',
    );
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║   Seed de productos de ejemplo       ║');
  console.log('╚══════════════════════════════════════╝');

  const count = parseCountFromArgs();
  console.log(`Creando ${count} producto(s) de ejemplo...`);

  console.log('\n[Autenticación]');
  await initAuth();

  console.log('\n[Datos de referencia]');
  let channelIds: Record<string, string> = {};
  let warehouseIds: Record<string, string> = {};
  let categoryIds: Record<string, string> = {};
  let productTypeIds: Record<string, string> = {};
  let attributeIds: Record<string, string> = {};

  try {
    console.log('  - Cargando canales...');
    channelIds = await fetchChannelIdsBySlug();
    console.log(`    Canales cargados: ${Object.keys(channelIds).length}`);

    console.log('  - Cargando almacenes...');
    warehouseIds = await fetchWarehouseIdsBySlug();
    console.log(`    Almacenes cargados: ${Object.keys(warehouseIds).length}`);

    console.log('  - Cargando categorías...');
    categoryIds = await fetchCategoryIdsBySlug();
    console.log(`    Categorías cargadas: ${Object.keys(categoryIds).length}`);

    console.log('  - Cargando tipos de producto...');
    productTypeIds = await fetchProductTypeIdsBySlug();
    console.log(
      `    Tipos de producto cargados: ${Object.keys(productTypeIds).length}`,
    );

    console.log('  - Cargando atributos...');
    attributeIds = await fetchAttributeIdsBySlug();
    console.log(`    Atributos cargados: ${Object.keys(attributeIds).length}`);
  } catch (err) {
    console.error('Error al cargar los datos de referencia:');
    console.error(err);
    throw err;
  }

  const channelId = channelIds['canal-test'];
  if (!channelId) {
    throw new Error('El canal "canal-test" no existe en la API.');
  }

  const warehouseId =
    warehouseIds['default-warehouse'] ??
    warehouseIds['default'] ??
    Object.values(warehouseIds)[0];
  if (!warehouseId) {
    throw new Error('No se han encontrado almacenes en la API.');
  }

  const productTypesExport = await loadJson<ProductTypesExport>(
    'src/scripts/grupo-bet/productTypes-export.json',
  );
  const productTypeNodes = productTypesExport.data.productTypes.edges.map((e) => e.node);
  const defaultTypeNode = pickDefaultProductType(productTypeNodes);

  const categoriesExport = await loadJson<CategoriesExport>(
    'src/scripts/grupo-bet/categories-subcategories-export.json',
  );
  const rootCategories = categoriesExport.data.categories.edges.map((e) => e.node);
  const leafCategories = collectLeafCategories(rootCategories).filter(
    (c) => !!categoryIds[c.slug],
  );

  if (leafCategories.length === 0) {
    throw new Error(
      'No se han encontrado categorías hoja con slugs que coincidan.',
    );
  }

  const perCategory = 5;
  const minimumTotal = 50;

  const totalLeafCount = leafCategories.length;
  const targetTotal =
    count > 2
      ? Math.max(count, minimumTotal)
      : 2;

  const basePerCategory =
    totalLeafCount > 0 ? Math.max(1, Math.floor(targetTotal / totalLeafCount)) : 1;

  const selectedCategories =
    targetTotal === 2
      ? leafCategories.slice(0, Math.min(2, leafCategories.length))
      : leafCategories;

  const specs: SampleProductSpec[] = [];

  if (targetTotal === 2) {
    selectedCategories.forEach((cat, index) => {
      specs.push({
        name: `Producto demo ${cat.name}`,
        description: `Producto de ejemplo para la categoría ${cat.name}. Pensado para pruebas de catálogo y checkout en entorno de desarrollo.`,
        categorySlug: cat.slug,
        productTypeSlug: defaultTypeNode.slug,
        basePrice: 10.99 + index * 5,
        stockQuantity: 50 + index * 10,
        imageFileIndex: index + 1,
      });
    });
  } else {
    let globalIndex = 0;
    for (const cat of selectedCategories) {
      const itemsForCategory = Math.max(perCategory, basePerCategory);
      for (let i = 0; i < itemsForCategory; i += 1) {
        specs.push({
          name: `Producto demo ${cat.name} ${i + 1}`,
          description: `Producto de ejemplo para la categoría ${cat.name}. Variante ${i + 1}, pensada para poblar el catálogo de pruebas.`,
          categorySlug: cat.slug,
          productTypeSlug: defaultTypeNode.slug,
          basePrice: 10.99 + (globalIndex % 10) * 5,
          stockQuantity: 40 + (globalIndex % 5) * 10,
          imageFileIndex: globalIndex + 1,
        });
        globalIndex += 1;
      }
    }

    if (specs.length < targetTotal) {
      let i = 0;
      while (specs.length < targetTotal && specs.length < selectedCategories.length * perCategory) {
        const cat = selectedCategories[i % selectedCategories.length];
        const index = specs.length;
        specs.push({
          name: `Producto demo extra ${cat.name} ${index + 1}`,
          description: `Producto adicional de ejemplo en la categoría ${cat.name}.`,
          categorySlug: cat.slug,
          productTypeSlug: defaultTypeNode.slug,
          basePrice: 10.99 + (index % 10) * 5,
          stockQuantity: 40 + (index % 5) * 10,
          imageFileIndex: index + 1,
        });
        i += 1;
      }
    }
  }

  const productAttributes = buildProductAttributesForType(defaultTypeNode, attributeIds);
  const variantAttributes = buildVariantAttributesForType(defaultTypeNode, attributeIds);

  console.log('\n[Creación de productos]');
  for (const spec of specs) {
    await createProductWithVariant({
      spec,
      productTypeId: productTypeIds[spec.productTypeSlug] ?? defaultTypeNode.id,
      categoryId: categoryIds[spec.categorySlug],
      channelId,
      warehouseId,
      productAttributes,
    });
  }

  console.log('\n✔ Seed de productos de ejemplo completado.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});

