import { apollo } from '../apollo/apollo-client.js';
import { MENU_CREATE, MENU_ITEM_CREATE } from '../mutations/menu.js';
import type { MenuCreateResult, MenuItemCreateResult } from '../mutations/menu.js';
import type { SeederSection, MenuConfig, MenuItemConfig } from '../config/index.js';
import { logSuccess, logError, logSkip, executeMutation, type SeedContext } from './utils.js';
import { fetchPagesBySlug } from '../queries/pages.js';

/**
 * Resolves a menu item's link IDs from SeedContext using slug references.
 * Returns the resolved fields (category, collection, page, url) ready to pass
 * to the MenuItemCreateInput.
 */
function resolveItemLinks(
  item: MenuItemConfig,
  ctx: SeedContext,
  itemLabel: string,
  pagesBySlug: Record<string, { id: string; title: string; pageTypeSlug: string | null }>,
): { category?: string; collection?: string; page?: string; url?: string } {
  const links: { category?: string; collection?: string; page?: string; url?: string } = {};

  if (item.categorySlug) {
    const id = ctx.categoryIds[item.categorySlug];
    if (!id) {
      logSkip(
        'MenuItem',
        itemLabel,
        `el slug de categoría "${item.categorySlug}" no existe en el contexto`,
      );
    } else {
      links.category = id;
    }
  }

  if (item.collectionSlug) {
    const id = ctx.collectionIds[item.collectionSlug];
    if (!id) {
      logSkip(
        'MenuItem',
        itemLabel,
        `el slug de colección "${item.collectionSlug}" no existe en el contexto`,
      );
    } else {
      links.collection = id;
    }
  }

  if (item.pageSlug) {
    const ctxId = ctx.pageIds[item.pageSlug];
    const pageRecord = pagesBySlug[item.pageSlug];
    const id = ctxId ?? pageRecord?.id;

    if (!id) {
      logSkip(
        'MenuItem',
        itemLabel,
        `el slug de página "${item.pageSlug}" no existe ni en el contexto ni en Saleor`,
      );
    } else {
      links.page = id;
    }
  }

  if (item.url) {
    links.url = item.url;
  }

  return links;
}

async function createMenuItems(
  items: MenuItemConfig[],
  menuId: string,
  ctx: SeedContext,
  pagesBySlug: Record<string, { id: string; title: string; pageTypeSlug: string | null }>,
  parentId?: string,
  depth = 0,
): Promise<void> {
  const indent = '    ' + '  '.repeat(depth);

  for (const item of items) {
    const links = resolveItemLinks(item, ctx, item.name, pagesBySlug);

    const { data, hasError } = await executeMutation<MenuItemCreateResult>(
      () =>
        apollo.mutate({
          mutation: MENU_ITEM_CREATE,
          variables: {
            input: {
              menu: menuId,
              name: item.name,
              parent: parentId,
              ...links,
            },
          },
          errorPolicy: 'all',
        }),
      'MenuItem',
      item.name,
    );

    if (hasError) continue;

    const result = data?.menuItemCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('MenuItem', item.name, errors);
      continue;
    }

    const menuItem = result?.menuItem;
    if (!menuItem) continue;

    const linkSuffix = links.category
      ? ' → categoría'
      : links.collection
        ? ' → colección'
        : links.page
          ? ' → página'
          : links.url
            ? ` → ${links.url}`
            : '';

    console.log(`${indent}↳ MenuItem: "${menuItem.name}"${linkSuffix} (${menuItem.id})`);

    if (item.children && item.children.length > 0) {
      await createMenuItems(item.children, menuId, ctx, pagesBySlug, menuItem.id, depth + 1);
    }
  }
}

export async function seedMenus(
  section: SeederSection<MenuConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Menús]');

  // Fetch all pages once so that menu items can link to pages created
  // either by the generic pages seeder or by ad-hoc scripts (e.g. blog posts).
  const pagesBySlug = await fetchPagesBySlug();

  for (const menuConfig of section.data) {
    const { items, ...input } = menuConfig;

    const { data, hasError } = await executeMutation<MenuCreateResult>(
      () =>
        apollo.mutate({
          mutation: MENU_CREATE,
          variables: { input },
          errorPolicy: 'all',
        }),
      'Menu',
      input.name,
    );

    if (hasError) continue;

    const result = data?.menuCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Menu', input.name, errors);
      continue;
    }

    const menu = result?.menu;
    if (!menu) continue;

    logSuccess('Menu', menu.name, menu.id);

    if (items && items.length > 0) {
      await createMenuItems(items, menu.id, ctx, pagesBySlug);
    }
  }
}
