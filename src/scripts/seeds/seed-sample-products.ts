import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initAuth, getAuthHeaders } from '../../apollo/apollo-client.js';
import { slugify, executeMutation, logError } from '../../seeders/utils.js';
import { fetchAttributeIdsBySlug } from '../../queries/attributes.js';
import { fetchAttributeChoiceIdsBySlug } from '../../queries/attributeChoices.js';
import { fetchChannelIdsBySlug } from '../../queries/channels.js';
import { fetchWarehouseIdsBySlug } from '../../queries/warehouses.js';
import { fetchCategoryIdsBySlug } from '../../queries/categories.js';
import { fetchProductTypeIdsBySlug } from '../../queries/productTypes.js';
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
} from '../../mutations/product.js';
import { apollo } from '../../apollo/apollo-client.js';
import fetch from 'cross-fetch';
import FormData from 'form-data';

interface CategoryExportNode {
  id: string;
  name: string;
  slug: string;
  parent?: { id: string } | null;
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

type AttributeChoiceIdsBySlug = Record<string, string[]>;

interface SampleProductSpec {
  name: string;
  description: string;
  categorySlug: string;
  productTypeSlug: string;
  basePrice: number;
  stockQuantity: number;
  imageFileIndex: number;
}

function generateBetSku(): string {
  const randomNumber = Math.floor(Math.random() * 100000);
  const padded = randomNumber.toString().padStart(5, '0');
  return `BET${padded}`;
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

function buildCategoryIndex(roots: CategoryExportNode[]): Record<string, CategoryExportNode> {
  const index: Record<string, CategoryExportNode> = {};

  const visit = (node: CategoryExportNode): void => {
    index[node.id] = node;
    const children = node.children?.edges?.map((e) => e.node) ?? [];
    for (const child of children) visit(child);
  };

  for (const root of roots) visit(root);
  return index;
}

function resolveRootSlugForCategory(
  node: CategoryExportNode,
  index: Record<string, CategoryExportNode>,
): string {
  let current: CategoryExportNode = node;
  while (current.parent?.id) {
    const parent = index[current.parent.id];
    if (!parent) break;
    current = parent;
  }
  return current.slug;
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
  choiceIdsBySlug: AttributeChoiceIdsBySlug,
): AttributeValueInput[] {
  const attrs: AttributeValueInput[] = [];

  for (const ref of typeNode.variantAttributes) {
    const id = attributeIdsBySlug[ref.slug];
    if (!id) continue;

    const choiceIds = choiceIdsBySlug[ref.slug] ?? [];

    if (choiceIds.length > 0) {
      // For DROPDOWN attributes, pick the first available choice deterministically.
      attrs.push({
        id,
        dropdown: {
          id: choiceIds[0],
        },
      });
    } else {
      // Fallback for non-select attributes: use a demo plain text value.
      let value = 'Demo';
      if (ref.slug === 'garantia') value = '5';
      else if (ref.slug === 'color') value = 'negro';

      attrs.push({
        id,
        plainText: value,
      });
    }
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
  variantAttributes: AttributeValueInput[];
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
    attributes: options.productAttributes,
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
    sku: generateBetSku(),
    attributes: options.variantAttributes,
    stocks: [
      {
        warehouse: warehouseId,
        quantity: spec.stockQuantity,
      },
    ],
  };

  const createVariant = async (
    input: ProductVariantCreateInput,
  ): Promise<{
    result: ProductVariantCreateResult | null | undefined;
    hasError: boolean;
  }> => {
    const { data, hasError } = await executeMutation<ProductVariantCreateResult>(
      () =>
        apollo.mutate({
          mutation: PRODUCT_VARIANT_CREATE,
          variables: { input },
          errorPolicy: 'all',
        }),
      'ProductVariant',
      spec.name,
    );
    return { result: data ?? null, hasError };
  };

  let { result: variantData, hasError: variantHasError } = await createVariant(variantInput);
  if (variantHasError) return;

  let variantResult = variantData?.productVariantCreate;
  let variantErrors = variantResult?.errors ?? [];

  const hasAttributesNotFoundError = variantErrors.some(
    (e) => e.field === 'attributes' && e.code === 'NOT_FOUND',
  );

  if ((variantErrors.length > 0 || !variantResult?.productVariant) && hasAttributesNotFoundError) {
    console.error(
      `  ⚠ Variante de producto: "${spec.name}" tiene atributos de variante incompatibles — reintentando sin atributos de variante`,
    );
    const retryInput: ProductVariantCreateInput = {
      ...variantInput,
      attributes: [],
    };
    ({ result: variantData, hasError: variantHasError } = await createVariant(retryInput));
    if (variantHasError) return;
    variantResult = variantData?.productVariantCreate;
    variantErrors = variantResult?.errors ?? [];
  }

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
  let attributeChoiceIdsBySlug: AttributeChoiceIdsBySlug = {};

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
  const categoryIndex = buildCategoryIndex(rootCategories);
  const leafCategories = collectLeafCategories(rootCategories).filter(
    (c) => !!categoryIds[c.slug],
  );

  if (leafCategories.length === 0) {
    throw new Error(
      'No se han encontrado categorías hoja con slugs que coincidan.',
    );
  }

  const specs: SampleProductSpec[] = [];

  // Generar exactamente "count" productos usando categorías hoja aleatorias.
  // Si count no se pasa, parseCountFromArgs devuelve 2.
  for (let i = 0; i < count; i += 1) {
    const cat = leafCategories[Math.floor(Math.random() * leafCategories.length)];
    const rootSlug = resolveRootSlugForCategory(cat, categoryIndex);
    const typeForCategory =
      productTypeNodes.find((t) => t.slug === rootSlug) ?? defaultTypeNode;

    const basePrice = 10.99 + (i % 10) * 5;
    const stockQuantity = 40 + (i % 5) * 10;
    const imageFileIndex = (i % 50) + 1; // asumiendo hasta 50 imágenes en public/products

    specs.push({
      name: `Producto demo ${cat.name} ${i + 1}`,
      description: `Producto de ejemplo para la categoría ${cat.name}. Variante ${i + 1}, pensada para poblar el catálogo de pruebas.`,
      categorySlug: cat.slug,
      productTypeSlug: typeForCategory.slug,
      basePrice,
      stockQuantity,
      imageFileIndex,
    });
  }

  // Cargar valores (choices) actuales de atributos desde la API para atributos de variante.
  const variantAttributeSlugs = Array.from(
    new Set(
      productTypeNodes
        .flatMap((t) => t.variantAttributes)
        .map((ref) => ref.slug),
    ),
  );
  attributeChoiceIdsBySlug = await fetchAttributeChoiceIdsBySlug(variantAttributeSlugs);

  const productAttributesByTypeSlug: Record<string, AttributeValueInput[]> = {};
  const variantAttributesByTypeSlug: Record<string, AttributeValueInput[]> = {};

  for (const typeNode of productTypeNodes) {
    productAttributesByTypeSlug[typeNode.slug] = buildProductAttributesForType(
      typeNode,
      attributeIds,
    );
    variantAttributesByTypeSlug[typeNode.slug] = buildVariantAttributesForType(
      typeNode,
      attributeIds,
      attributeChoiceIdsBySlug,
    );
  }

  console.log('\n[Creación de productos]');
  for (const spec of specs) {
    const productAttributes = productAttributesByTypeSlug[spec.productTypeSlug] ?? [];
    const variantAttributes = variantAttributesByTypeSlug[spec.productTypeSlug] ?? [];
    await createProductWithVariant({
      spec,
      productTypeId: productTypeIds[spec.productTypeSlug] ?? defaultTypeNode.id,
      categoryId: categoryIds[spec.categorySlug],
      channelId,
      warehouseId,
      productAttributes,
      variantAttributes,
    });
  }

  console.log('\n✔ Seed de productos de ejemplo completado.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});

