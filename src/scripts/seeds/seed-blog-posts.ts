import 'dotenv/config';
import { gql } from '@apollo/client/core';
import { initAuth, apollo } from '../../apollo/apollo-client.js';
import { executeMutation, logError, logSuccess } from '../../seeders/utils.js';
import {
  PAGE_CREATE,
  type PageCreateInput,
  type PageCreateResult,
} from '../../mutations/page.js';
import {
  ATTRIBUTE_UPDATE,
  type AttributeUpdateResult,
} from '../../mutations/attribute.js';
import { fetchAttributeIdsBySlug } from '../../queries/attributes.js';

const PAGE_TYPES_QUERY = gql`
  query PageTypesForBlogSeed($first: Int!) {
    pageTypes(first: $first) {
      edges {
        node {
          id
          name
          slug
        }
      }
    }
  }
`;

interface PageTypeNode {
  id: string;
  name: string;
  slug: string;
}

interface PageTypesQueryResult {
  pageTypes: {
    edges: { node: PageTypeNode }[];
  };
}

const ATTRIBUTE_BY_SLUG_QUERY = gql`
  query AttributeBySlug($slug: String!) {
    attributes(filter: { search: $slug }, first: 10) {
      edges {
        node {
          id
          name
          slug
          inputType
          valueRequired
          entityType
          type
        }
      }
    }
  }
`;

interface AttributeBySlugPayload {
  attributes: {
    edges: {
      node: {
        id: string;
        name: string;
        slug: string;
        inputType: string;
        valueRequired: boolean;
        entityType: string | null;
        type: string;
      };
    }[];
  };
}

async function fetchPageTypeIdBySlug(slug: string): Promise<string> {
  const { data } = await apollo.query<PageTypesQueryResult>({
    query: PAGE_TYPES_QUERY,
    variables: { first: 100 },
    fetchPolicy: 'network-only',
  });

  const nodes = data.pageTypes.edges.map(({ node }) => node);
  const match = nodes.find((node) => node.slug === slug);

  if (!match) {
    throw new Error(`No se ha encontrado ningún PageType con el slug "${slug}".`);
  }

  return match.id;
}

interface PageAttributeValueInput {
  id: string;
  plainText?: string;
  richText?: string;
  boolean?: boolean;
}

const blogImageFiles = [
  'blog-1.jpg',
  'blog-2.jpg',
  'blog-3.jpg',
  'blog-4.jpg',
  'blog-5.jpg',
  'blog-6.jpg',
  'blog-7.jpg',
  'blog-8.jpg',
  'blog-9.jpg',
  'blog-10.jpg',
];

const baseContents = [
  'Exploramos las últimas tendencias en energía solar y cómo pueden ayudarte a reducir tu factura eléctrica.',
  'Guía rápida para entender qué componentes necesita una instalación fotovoltaica residencial moderna.',
  'Consejos prácticos para mantener tus paneles solares en perfecto estado durante todo el año.',
  'Analizamos las diferencias entre distintas tecnologías de paneles y cuándo elegir cada una.',
  'Todo lo que debes saber antes de solicitar un estudio de autoconsumo para tu vivienda o empresa.',
  'Respondemos a las dudas más habituales sobre subvenciones y ayudas públicas para instalaciones solares.',
  'Descubre cómo combinar almacenamiento en baterías con tu sistema fotovoltaico para maximizar el ahorro.',
  'Claves para dimensionar correctamente una instalación según tus hábitos de consumo y objetivos.',
  'Errores frecuentes al diseñar un sistema solar y cómo evitarlos desde el inicio del proyecto.',
  'Miramos al futuro del sector fotovoltaico y las tendencias que marcarán los próximos años.',
];

const blogPostConfigs = blogImageFiles.map((fileName, index) => {
  const imageSlugPart = fileName.replace('.jpg', '');
  const title = `Post de blog ${index + 1}`;
  const slug = `post-blog-${index + 1}`;
  const content =
    baseContents[index] ??
    'Contenido de ejemplo para este post de blog sobre energía solar y autoconsumo.';

  return {
    imageFile: fileName,
    title,
    slug,
    isPublished: true,
    content: `${content} Imagen principal: /blog/${fileName}.`,
    seo: {
      title,
      description: `Artículo de blog ${index + 1} sobre energía solar, asociado a la imagen ${imageSlugPart}.`,
    },
  };
});

async function relaxBlogImageAttributeIfNeeded(): Promise<void> {
  console.log('\n[Relajar atributo opcional de imagen del blog]');

  const { data } = await apollo.query<AttributeBySlugPayload>({
    query: ATTRIBUTE_BY_SLUG_QUERY,
    variables: { slug: 'imagen-post' },
    fetchPolicy: 'network-only',
  });

  const nodes = data.attributes.edges.map(({ node }) => node);
  const match = nodes.find((node) => node.slug === 'imagen-post');

  if (!match) {
    console.log('  ⚠ No se ha encontrado ningún atributo con slug "imagen-post". Se continúa sin cambios.');
    return;
  }

  console.log(
    `  Atributo encontrado: "${match.name}" (${match.id}) — valueRequired=${match.valueRequired}`,
  );

  if (!match.valueRequired) {
    console.log('  Atributo ya no es requerido. No se realizan cambios.');
    return;
  }

  console.log('  Actualizando atributo: valueRequired → false');
  const result = await apollo.mutate<AttributeUpdateResult>({
    mutation: ATTRIBUTE_UPDATE,
    variables: {
      id: match.id,
      input: {
        valueRequired: false,
      },
    },
    errorPolicy: 'all',
  });

  const update = result.data?.attributeUpdate;
  const errors = update?.errors ?? [];

  if (errors.length > 0) {
    console.error(
      '  Errores al actualizar el atributo:',
      errors.map((e) => `${e.field ?? ''}: ${e.message} (${e.code})`).join(', '),
    );
    return;
  }

  if (!update?.attribute) {
    console.error('  La API no devolvió el atributo actualizado.');
    return;
  }

  console.log(
    `  ✔ Atributo "${update.attribute.name}" actualizado: valueRequired=${update.attribute.valueRequired}`,
  );
}

async function seedBlogPosts(): Promise<void> {
  console.log('╔══════════════════════════════════════╗');
  console.log('║        Seed de posts del blog        ║');
  console.log('╚══════════════════════════════════════╝');

  if (!process.env.SALEOR_API_URL) {
    console.error(
      'Error: SALEOR_API_URL no está definida en el entorno (.env).',
    );
    process.exit(1);
  }

  console.log('\n[Autenticación]');
  await initAuth();

  await relaxBlogImageAttributeIfNeeded();

  console.log('\n[Resolviendo PageType "post"]');
  const pageTypeId = await fetchPageTypeIdBySlug('post');
  console.log(`  PageType "post" → ${pageTypeId}`);

  console.log('\n[Resolviendo atributos del blog por slug]');
  const attributeIdsBySlug = await fetchAttributeIdsBySlug();
  const titleAttrId = attributeIdsBySlug['title-post'];
  const contentAttrId = attributeIdsBySlug['content-post'];

  console.log('\n[Creación de páginas del blog]');

  for (const config of blogPostConfigs) {
    const attributes: PageAttributeValueInput[] = [];

    if (titleAttrId) {
      attributes.push({
        id: titleAttrId,
        plainText: config.title,
      });
    }

    if (contentAttrId) {
      attributes.push({
        id: contentAttrId,
        plainText: config.content,
      });
    }

    const input: PageCreateInput = {
      title: config.title,
      slug: config.slug,
      pageType: pageTypeId,
      isPublished: config.isPublished,
      seo: config.seo,
      attributes: attributes as unknown as PageCreateInput['attributes'],
    };

    const { data, hasError } = await executeMutation<PageCreateResult>(
      () =>
        apollo.mutate({
          mutation: PAGE_CREATE,
          variables: { input },
          errorPolicy: 'all',
        }),
      'Page',
      config.title,
    );

    if (hasError) continue;

    const result = data?.pageCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Page', config.title, errors);
      continue;
    }

    if (result?.page) {
      logSuccess('Page', result.page.title, result.page.id);
    }
  }

  console.log('\n✔ Seed de posts del blog completado.\n');
}

seedBlogPosts().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});

