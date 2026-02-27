import { taxClasses } from './taxClasses.js';
import { warehouses } from './warehouses.js';
import { channels } from './channels.js';
import { shipping } from './shipping.js';
import { attributes } from './attributes.js';
import { productTypes } from './productTypes.js';
import { categories } from './categories.js';
import { collections } from './collections.js';
import { pageTypes } from './pageTypes.js';
import { pages } from './pages.js';
import { menus } from './menus.js';
import type { SeedConfig } from './types.js';

export const config: SeedConfig = {
  taxClasses,
  warehouses,
  channels,
  shipping,
  attributes,
  productTypes,
  categories,
  collections,
  pageTypes,
  pages,
  menus,
};

// Re-export all types so seeders can import from a single path
export type { SeedConfig, SeederSection } from './types.js';
export type { ShippingZoneConfig, ShippingMethodConfig } from './shipping.js';
export type { ProductTypeConfig } from './productTypes.js';
export type { CategoryConfig } from './categories.js';
export type { CollectionConfig } from './collections.js';
export type { PageTypeConfig } from './pageTypes.js';
export type { PageConfig } from './pages.js';
export type { MenuConfig, MenuItemConfig } from './menus.js';
export type { ProductAttributeAssignInput } from './types.js';
