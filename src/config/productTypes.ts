import type { ProductTypeInput } from '../mutations/productType.js';
import type { SeederSection } from './types.js';

export interface ProductTypeConfig extends ProductTypeInput {
  /** Slugs of attributes (from seeded attributes) to assign as PRODUCT attributes */
  productAttributeSlugs?: string[];
  /** Slugs of attributes to assign as VARIANT attributes */
  variantAttributeSlugs?: string[];
}

export const productTypes: SeederSection<ProductTypeConfig> = {
  enabled: false,
  data: [
    {
      name: 'Apparel',
      slug: 'apparel',
      hasVariants: true,
      isShippingRequired: true,
      isDigital: false,
      productAttributeSlugs: ['color', 'brand', 'material'],
      variantAttributeSlugs: ['size'],
    },
    {
      name: 'Accessory',
      slug: 'accessory',
      hasVariants: true,
      isShippingRequired: true,
      isDigital: false,
      productAttributeSlugs: ['color', 'brand'],
      variantAttributeSlugs: [],
    },
    {
      name: 'Digital Product',
      slug: 'digital-product',
      hasVariants: false,
      isShippingRequired: false,
      isDigital: true,
      productAttributeSlugs: ['brand'],
      variantAttributeSlugs: [],
    },
  ],
};
