import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import FormData from 'form-data';
import fetch from 'cross-fetch';

import { slugify, executeMutation, logError, logSuccess } from '../../seeders/utils.js';
import { initAuth, initStaffAuth, getAuthHeaders } from '../../apollo/apollo-client.js';
import { fetchAttributeIdsBySlug } from '../../queries/attributes.js';
import { fetchPagesBySlug } from '../../queries/pages.js';
import { fetchPageTypeIdsBySlug } from '../../queries/pageTypes.js';
import {
  PAGE_CREATE,
  PAGE_UPDATE,
  type PageCreateResult,
  type PageUpdateResult,
} from '../../mutations/page.js';
import { apollo } from '../../apollo/apollo-client.js';
import { gql } from '@apollo/client/core';

function toTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const withoutLogo = base.endsWith('-logo') ? base.slice(0, -'-logo'.length) : base;
  const parts = withoutLogo.split(/[-_]+/g).filter((p) => p.length > 0);

  if (parts.length === 0) {
    return withoutLogo || base;
  }

  return parts
    .map((part) => {
      if (part.length === 1) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(' ');
}

async function loadManufacturerFiles(): Promise<string[]> {
  const dir = path.resolve(process.cwd(), 'public', 'manufacturers');
  const entries = await fs.readdir(dir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|jpg|jpeg|webp|gif)$/i.test(name));
}

interface ManufacturerSeedItem {
  title: string;
  slug: string;
  logoFileName: string;
}

function getImageContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

async function uploadImageToSaleor(absoluteFilePath: string): Promise<string> {
  const apiUrl = process.env.SALEOR_API_URL;
  if (!apiUrl) {
    throw new Error('SALEOR_API_URL no está definido en el entorno.');
  }

  const fileName = path.basename(absoluteFilePath);
  const fileBuffer = await fs.readFile(absoluteFilePath);

  const form = new FormData();
  const query = `
    mutation FileUpload($file: Upload!) {
      fileUpload(file: $file) {
        uploadedFile {
          url
          contentType
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
      file: null,
    },
  });

  const map = JSON.stringify({
    '0': ['variables.file'],
  });

  form.append('operations', operations);
  form.append('map', map);
  form.append('0', fileBuffer, {
    filename: fileName,
    contentType: getImageContentType(fileName),
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
    throw new Error(`HTTP ${response.status} al subir logo: ${text}`);
  }

  const result = (await response.json()) as {
    data?: {
      fileUpload?: {
        uploadedFile: { url: string } | null;
        errors: { field: string | null; message: string; code: string }[];
      };
    };
    errors?: { message: string }[];
  };

  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Errores GraphQL al subir logo: ${result.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const uploadResult = result.data?.fileUpload;
  if (!uploadResult) {
    throw new Error('fileUpload no devolvió datos.');
  }

  if (uploadResult.errors.length > 0) {
    throw new Error(
      `fileUpload devolvió errores: ${uploadResult.errors.map((e) => e.message).join(', ')}`,
    );
  }

  if (!uploadResult.uploadedFile?.url) {
    throw new Error('fileUpload no devolvió URL para el logo.');
  }

  return uploadResult.uploadedFile.url;
}

function toDefaultStoragePath(fileUrlOrPath: string): string {
  if (!fileUrlOrPath) return fileUrlOrPath;

  if (!/^https?:\/\//i.test(fileUrlOrPath)) {
    return fileUrlOrPath.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(fileUrlOrPath);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return fileUrlOrPath.replace(/^\/+/, '');
  }
}

function isFilePathStorageError(errors: { message: string }[]): boolean {
  return errors.some((error) => error.message.includes('file_url must be the path to the default storage'));
}

function withMediaPrefixForFileAttributes(
  attributes: {
    id: string;
    values?: string[];
    richText?: string;
    plainText?: string;
    boolean?: boolean;
    file?: string;
    contentType?: string;
  }[],
): {
  id: string;
  values?: string[];
  richText?: string;
  plainText?: string;
  boolean?: boolean;
  file?: string;
  contentType?: string;
}[] {
  return attributes.map((attribute) => {
    if (!attribute.file) return attribute;
    const filePath = attribute.file.replace(/^\/+/, '');
    if (filePath.startsWith('media/')) return attribute;
    return {
      ...attribute,
      file: `media/${filePath}`,
    };
  });
}

function getFilePathCandidates(filePath: string): string[] {
  const candidates: string[] = [];

  if (/^https?:\/\//i.test(filePath)) {
    try {
      const parsed = new URL(filePath);
      parsed.search = '';
      parsed.hash = '';
      const fullUrl = parsed.toString();
      const pathOnly = parsed.pathname.replace(/^\/+/, '');
      const pathWithSlash = `/${pathOnly}`;
      candidates.push(
        fullUrl,
        pathOnly,
        pathWithSlash,
        `media/${pathOnly}`,
        `/media/${pathOnly}`,
      );
    } catch {
      candidates.push(filePath);
    }
  } else {
    const normalized = filePath.replace(/^\/+/, '');
    const withoutMedia = normalized.startsWith('media/')
      ? normalized.slice('media/'.length)
      : normalized;
    candidates.push(
      withoutMedia,
      `/${withoutMedia}`,
      `media/${withoutMedia}`,
      `/media/${withoutMedia}`,
    );
  }

  return [...new Set(candidates)];
}

function replaceFilePathsInAttributes(
  attributes: {
    id: string;
    values?: string[];
    richText?: string;
    plainText?: string;
    boolean?: boolean;
    file?: string;
    contentType?: string;
  }[],
  nextFilePath: string,
): {
  id: string;
  values?: string[];
  richText?: string;
  plainText?: string;
  boolean?: boolean;
  file?: string;
  contentType?: string;
}[] {
  return attributes.map((attribute) => {
    if (!attribute.file) return attribute;
    return {
      ...attribute,
      file: nextFilePath,
    };
  });
}

async function buildManufacturerSeedItems(): Promise<ManufacturerSeedItem[]> {
  const files = await loadManufacturerFiles();

  if (files.length === 0) {
    console.log('  ⚠ No se encontraron ficheros en public/manufacturers.');
  }

  return files.map((file) => {
    const title = toTitleFromFilename(file);
    const slug = slugify(title);
    return {
      title,
      slug,
      logoFileName: file,
    };
  });
}

function buildManufacturerPagesSource(items: ManufacturerSeedItem[]): string {

  const itemsSource = items
    .map(
      (item) =>
        `  {\n` +
        `    title: '${item.title}',\n` +
        `    slug: '${item.slug}',\n` +
        `    pageTypeSlug: 'fabricantes',\n` +
        `    isPublished: true,\n` +
        `  },`,
    )
    .join('\n');

  return `import type { PageConfig } from './pages.js';

/**
 * Manufacturer pages to seed.
 * Auto-generated from files in public/manufacturers by
 * src/scripts/seeds/seed-manufacturers.ts
 */
export const manufacturerPages: PageConfig[] = [
${itemsSource}
];
`;
}

async function main(): Promise<void> {
  if (!process.env.SALEOR_API_URL) {
    console.error(
      'Error: SALEOR_API_URL no está definida. Copia .env.example a .env y rellena los valores.',
    );
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Seed de páginas y atributos de fabricantes       ║');
  console.log('╚════════════════════════════════════════════════════╝');

  console.log('\n[Construir manufacturerPages a partir de imágenes]');
  const manufacturerSeedItems = await buildManufacturerSeedItems();
  const source = buildManufacturerPagesSource(manufacturerSeedItems);

  const targetPath = path.resolve(
    process.cwd(),
    'src',
    'config',
    'manufacturers.ts',
  );

  await fs.writeFile(targetPath, source, 'utf8');

  console.log(`  ✔ Archivo src/config/manufacturers.ts actualizado.`);

  console.log('\n[Autenticación]');
  // Prefer staff JWT when credentials exist: SALEOR_APP_TOKEN often lacks page/pageType
  // query scope and causes HTTP 4xx after a main seed that used tokenCreate.
  if (process.env.SALEOR_EMAIL && process.env.SALEOR_PASSWORD) {
    await initStaffAuth();
  } else {
    await initAuth();
  }

  console.log('\n[Cargar atributos existentes]');
  const attributeIds = await fetchAttributeIdsBySlug();

  const marcaId = attributeIds['marca'];
  const activoId = attributeIds['activo'];
  const mostrarId = attributeIds['mostrar-en-la-home-y-pagina-de-fabricantes'];
  const logoId = attributeIds['logo'];

  if (!marcaId || !activoId || !mostrarId) {
    console.error(
      'Error: faltan atributos requeridos (marca, activo, mostrar-en-la-home-y-pagina-de-fabricantes) en la API.',
    );
    process.exit(1);
  }

  console.log('\n[Cargar páginas existentes]');
  const pagesBySlug = await fetchPagesBySlug({ minimal: true });

  console.log('\n[Cargar tipos de página existentes]');
  const pageTypeIds = await fetchPageTypeIdsBySlug();
  const fabricantesPageTypeId = pageTypeIds['fabricantes'];

  if (!fabricantesPageTypeId) {
    console.error(
      'Error: no se encontró el tipo de página con slug "fabricantes" en la API.',
    );
    process.exit(1);
  }

  /** Prefer `node`; some tokens/proxies return HTTP 400 for `pageType { attributes }`. */
  const PAGE_TYPE_ATTRIBUTES_VIA_NODE = gql`
    query FabricantesPageTypeAttributesViaNode($id: ID!) {
      node(id: $id) {
        __typename
        ... on PageType {
          attributes {
            attribute {
              slug
              inputType
              valueRequired
            }
          }
        }
      }
    }
  `;

  const PAGE_TYPE_ATTRIBUTES = gql`
    query FabricantesPageTypeAttributes($id: ID!) {
      pageType(id: $id) {
        attributes {
          attribute {
            slug
            inputType
            valueRequired
          }
        }
      }
    }
  `;

  type PageTypeAttributeInputType =
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

  interface FabricantesPageTypeAttributesPayload {
    pageType: {
      attributes: {
        attribute: {
          slug: string;
          inputType: PageTypeAttributeInputType;
          valueRequired: boolean;
        };
      }[];
    } | null;
  }

  interface FabricantesNodePayload {
    node: {
      __typename: string;
      attributes?: {
        attribute: {
          slug: string;
          inputType: PageTypeAttributeInputType;
          valueRequired: boolean;
        };
      }[];
    } | null;
  }

  const requiredPageAttributesBySlug = new Map<
    string,
    { slug: string; inputType: PageTypeAttributeInputType }
  >();

  try {
    const viaNode = await apollo.query<FabricantesNodePayload>({
      query: PAGE_TYPE_ATTRIBUTES_VIA_NODE,
      variables: { id: fabricantesPageTypeId },
      errorPolicy: 'all',
    });

    const nodeAttrs =
      !viaNode.errors?.length &&
      viaNode.data?.node?.__typename === 'PageType' &&
      viaNode.data.node.attributes
        ? viaNode.data.node.attributes
        : null;

    if (nodeAttrs) {
      nodeAttrs.forEach(({ attribute }) => {
        if (attribute.valueRequired) {
          requiredPageAttributesBySlug.set(attribute.slug, {
            slug: attribute.slug,
            inputType: attribute.inputType,
          });
        }
      });
    } else {
      const fabricantesPageTypeResult = await apollo.query<FabricantesPageTypeAttributesPayload>({
        query: PAGE_TYPE_ATTRIBUTES,
        variables: { id: fabricantesPageTypeId },
        errorPolicy: 'all',
      });

      fabricantesPageTypeResult.data?.pageType?.attributes?.forEach(({ attribute }) => {
        if (attribute.valueRequired) {
          requiredPageAttributesBySlug.set(attribute.slug, {
            slug: attribute.slug,
            inputType: attribute.inputType,
          });
        }
      });
    }
  } catch {
    // Required-attribute map stays empty; script still sends configured attributes.
  }

  console.log('\n[Crear/actualizar páginas de fabricantes]');
  const logoBySlug = new Map<string, string>();
  for (const item of manufacturerSeedItems) {
    logoBySlug.set(item.slug, item.logoFileName);
  }
  const uploadedLogoUrlBySlug = new Map<string, string>();
  let skipLogoUploads = false;

  for (const pageConfig of manufacturerSeedItems) {
    const slug = pageConfig.slug;
    const existingPage = pagesBySlug[slug];

    const attributes: {
      id: string;
      values?: string[];
      richText?: string;
      plainText?: string;
      boolean?: boolean;
      file?: string;
      contentType?: string;
    }[] = [];

    attributes.push({
      id: marcaId,
      plainText: pageConfig.title,
    });

    attributes.push({
      id: activoId,
      boolean: true,
    });

    attributes.push({
      id: mostrarId,
      boolean: true,
    });

    if (logoId) {
      const detectedLogoFileName = logoBySlug.get(slug);
      const logoRelative = detectedLogoFileName
        ? `manufacturers/${detectedLogoFileName}`
        : `manufacturers/${slug}-logo.png`;
      const absLogo = path.resolve(process.cwd(), 'public', logoRelative);
      try {
        await fs.access(absLogo);
        let logoStoragePath: string | null = uploadedLogoUrlBySlug.get(slug) ?? null;
        if (!logoStoragePath && !skipLogoUploads) {
          try {
            const uploadedLogoUrl = await uploadImageToSaleor(absLogo);
            logoStoragePath = toDefaultStoragePath(uploadedLogoUrl);
            uploadedLogoUrlBySlug.set(slug, logoStoragePath);
          } catch {
            skipLogoUploads = true;
          }
        }
        if (logoStoragePath) {
          attributes.push({
            id: logoId,
            file: logoStoragePath,
            contentType: detectedLogoFileName
              ? getImageContentType(detectedLogoFileName)
              : getImageContentType(`${slug}-logo.png`),
          });
        }
      } catch {
        // Missing logo file under public/; page still seeds without FILE attribute.
      }
    }

    // Asegurar que todos los atributos REQUIRED del page type "fabricantes" tienen algún valor.
    for (const [requiredAttrSlug, meta] of requiredPageAttributesBySlug.entries()) {
      const attributeId = attributeIds[requiredAttrSlug];
      if (!attributeId) continue;
      const alreadyProvided = attributes.some((attr) => attr.id === attributeId);
      if (alreadyProvided) continue;

      if (meta.inputType === 'BOOLEAN') {
        attributes.push({
          id: attributeId,
          boolean: true,
        });
      } else if (meta.inputType === 'RICH_TEXT') {
        attributes.push({
          id: attributeId,
          richText: JSON.stringify({
            time: Date.now(),
            blocks: [
              {
                type: 'paragraph',
                data: {
                  text: pageConfig.title,
                },
              },
            ],
            version: '2.30.7',
          }),
        });
      } else if (meta.inputType === 'PLAIN_TEXT' || meta.inputType === 'NUMERIC') {
        attributes.push({
          id: attributeId,
          values: [pageConfig.title],
        });
      } else if (meta.inputType === 'FILE') {
        const detectedLogoFileName = logoBySlug.get(pageConfig.slug);
        const uploadedLogoUrl = uploadedLogoUrlBySlug.get(pageConfig.slug);
        if (uploadedLogoUrl) {
          attributes.push({
            id: attributeId,
            file: uploadedLogoUrl,
            contentType: detectedLogoFileName
              ? getImageContentType(detectedLogoFileName)
              : getImageContentType(`${pageConfig.slug}-logo.png`),
          });
        }
      }
    }

    if (existingPage) {
      const { data, hasError } = await executeMutation<PageUpdateResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_UPDATE,
            variables: {
              id: existingPage.id,
              input: {
                attributes,
              },
            },
            errorPolicy: 'all',
          }),
        'PageUpdate',
        pageConfig.title,
      );

      if (hasError) continue;

      const result = data?.pageUpdate;
      const errors = result?.errors ?? [];

      if (errors.length > 0) {
        if (isFilePathStorageError(errors)) {
          const firstFileAttribute = attributes.find((attribute) => attribute.file)?.file;
          if (firstFileAttribute) {
            const retryCandidates = getFilePathCandidates(firstFileAttribute).filter(
              (candidate) => candidate !== firstFileAttribute,
            );

            let recovered = false;
            for (const candidate of retryCandidates) {
              const fallbackAttributes = replaceFilePathsInAttributes(attributes, candidate);
              const retry = await executeMutation<PageUpdateResult>(
                () =>
                  apollo.mutate({
                    mutation: PAGE_UPDATE,
                    variables: {
                      id: existingPage.id,
                      input: {
                        attributes: fallbackAttributes,
                      },
                    },
                    errorPolicy: 'all',
                  }),
                'PageUpdate',
                `${pageConfig.title} (retry file path: ${candidate})`,
              );
              if (retry.hasError) continue;
              const retryResult = retry.data?.pageUpdate;
              const retryErrors = retryResult?.errors ?? [];
              if (retryErrors.length > 0) continue;
              if (retryResult?.page) {
                logSuccess('PageUpdate', retryResult.page.title, retryResult.page.id);
                recovered = true;
                break;
              }
            }

            if (recovered) {
              continue;
            }
          }
          logError('PageUpdate', pageConfig.title, errors);
          continue;
        }
        logError('PageUpdate', pageConfig.title, errors);
        continue;
      }

      if (result?.page) {
        logSuccess('PageUpdate', result.page.title, result.page.id);
      }
    } else {
      const createResult = await executeMutation<PageCreateResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_CREATE,
            variables: {
              input: {
                title: pageConfig.title,
                slug,
                pageType: fabricantesPageTypeId,
                isPublished: true,
              },
            },
            errorPolicy: 'all',
          }),
        'PageCreate',
        pageConfig.title,
      );

      if (createResult.hasError) continue;

      const created = createResult.data?.pageCreate;
      const createErrors = created?.errors ?? [];

      if (createErrors.length > 0 || !created?.page) {
        logError('PageCreate', pageConfig.title, createErrors);
        continue;
      }

      const createdPage = created!.page;
      logSuccess('PageCreate', createdPage.title, createdPage.id);

      const { data, hasError } = await executeMutation<PageUpdateResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_UPDATE,
            variables: {
              id: createdPage.id,
              input: {
                attributes,
              },
            },
            errorPolicy: 'all',
          }),
        'PageUpdate',
        pageConfig.title,
      );

      if (hasError) continue;

      const result = data?.pageUpdate;
      const errors = result?.errors ?? [];

      if (errors.length > 0) {
        if (isFilePathStorageError(errors)) {
          const firstFileAttribute = attributes.find((attribute) => attribute.file)?.file;
          if (firstFileAttribute) {
            const retryCandidates = getFilePathCandidates(firstFileAttribute).filter(
              (candidate) => candidate !== firstFileAttribute,
            );

            let recovered = false;
            for (const candidate of retryCandidates) {
              const fallbackAttributes = replaceFilePathsInAttributes(attributes, candidate);
              const retry = await executeMutation<PageUpdateResult>(
                () =>
                  apollo.mutate({
                    mutation: PAGE_UPDATE,
                    variables: {
                      id: createdPage.id,
                      input: {
                        attributes: fallbackAttributes,
                      },
                    },
                    errorPolicy: 'all',
                  }),
                'PageUpdate',
                `${pageConfig.title} (retry file path: ${candidate})`,
              );
              if (retry.hasError) continue;
              const retryResult = retry.data?.pageUpdate;
              const retryErrors = retryResult?.errors ?? [];
              if (retryErrors.length > 0) continue;
              if (retryResult?.page) {
                logSuccess('PageUpdate', retryResult.page.title, retryResult.page.id);
                recovered = true;
                break;
              }
            }

            if (recovered) {
              continue;
            }
          }
          logError('PageUpdate', pageConfig.title, errors);
          continue;
        }
        logError('PageUpdate', pageConfig.title, errors);
        continue;
      }

      if (result?.page) {
        logSuccess('PageUpdate', result.page.title, result.page.id);
      }
    }
  }

  console.log('\n✔ Seed de fabricantes completado.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});

