import type { TaxClassCreateInput } from '../mutations/taxClass.js';
import type { WarehouseCreateInput } from '../mutations/warehouse.js';
import type { ChannelCreateInput } from '../mutations/channel.js';
import type { AttributeCreateInput } from '../mutations/attribute.js';
import type { ProductAttributeAssignInput } from '../mutations/productType.js';
import type { ShippingZoneConfig } from './shipping.js';
import type { ProductTypeConfig } from './productTypes.js';
import type { CategoryConfig } from './categories.js';
import type { CollectionConfig } from './collections.js';
import type { PageTypeConfig } from './pageTypes.js';
import type { PageConfig } from './pages.js';
import type { MenuConfig } from './menus.js';

export interface SeederSection<T> {
  enabled: boolean;
  data: T[];
}

export interface SeedConfig {
  taxClasses: SeederSection<TaxClassCreateInput>;
  warehouses: SeederSection<WarehouseCreateInput>;
  channels: SeederSection<ChannelCreateInput>;
  shipping: SeederSection<ShippingZoneConfig>;
  attributes: SeederSection<AttributeCreateInput>;
  productTypes: SeederSection<ProductTypeConfig>;
  categories: SeederSection<CategoryConfig>;
  collections: SeederSection<CollectionConfig>;
  pageTypes: SeederSection<PageTypeConfig>;
  pages: SeederSection<PageConfig>;
  menus: SeederSection<MenuConfig>;
}

export type { ProductAttributeAssignInput };
