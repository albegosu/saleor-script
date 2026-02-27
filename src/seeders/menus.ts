import { apollo } from '../apollo/apollo-client.js';
import { MENU_CREATE, MENU_ITEM_CREATE } from '../mutations/menu.js';
import type { MenuCreateResult, MenuItemCreateResult } from '../mutations/menu.js';
import type { SeederSection, MenuConfig, MenuItemConfig } from '../config/defaults.js';
import { logSuccess, logError, logSkip, executeMutation, type SeedContext } from './utils.js';

/**
 * Resolves a menu item's link IDs from SeedContext using slug references.
 * Returns the resolved fields (category, collection, page, url) ready to pass
 * to the MenuItemCreateInput.
 */
function resolveItemLinks(
  item: MenuItemConfig,
  ctx: SeedContext,
  itemLabel: string,
): { category?: string; collection?: string; page?: string; url?: string } {
  const links: { category?: string; collection?: string; page?: string; url?: string } = {};

  if (item.categorySlug) {
    const id = ctx.categoryIds[item.categorySlug];
    if (!id) {
      logSkip('MenuItem', itemLabel, `category slug "${item.categorySlug}" not in context`);
    } else {
      links.category = id;
    }
  }

  if (item.collectionSlug) {
    const id = ctx.collectionIds[item.collectionSlug];
    if (!id) {
      logSkip('MenuItem', itemLabel, `collection slug "${item.collectionSlug}" not in context`);
    } else {
      links.collection = id;
    }
  }

  if (item.pageSlug) {
    const id = ctx.pageIds[item.pageSlug];
    if (!id) {
      logSkip('MenuItem', itemLabel, `page slug "${item.pageSlug}" not in context`);
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
  parentId?: string,
  depth = 0,
): Promise<void> {
  const indent = '    ' + '  '.repeat(depth);

  for (const item of items) {
    const links = resolveItemLinks(item, ctx, item.name);

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
      ? ' → category'
      : links.collection
        ? ' → collection'
        : links.page
          ? ' → page'
          : links.url
            ? ` → ${links.url}`
            : '';

    console.log(`${indent}↳ MenuItem: "${menuItem.name}"${linkSuffix} (${menuItem.id})`);

    if (item.children && item.children.length > 0) {
      await createMenuItems(item.children, menuId, ctx, menuItem.id, depth + 1);
    }
  }
}

export async function seedMenus(
  section: SeederSection<MenuConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Menus]');

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
      await createMenuItems(items, menu.id, ctx);
    }
  }
}
