import type { TaxClassCreateInput } from '../mutations/taxClass.js';
import type { WarehouseCreateInput } from '../mutations/warehouse.js';
import type { ChannelCreateInput } from '../mutations/channel.js';
import type { AttributeCreateInput } from '../mutations/attribute.js';
import type { PageTypeCreateInput } from '../mutations/pageType.js';
import type { PageCreateInput } from '../mutations/page.js';
import type { CategoryInput } from '../mutations/category.js';
import type { CollectionCreateInput } from '../mutations/collection.js';
import type { ProductTypeInput, ProductAttributeAssignInput } from '../mutations/productType.js';
import type { ShippingZoneCreateInput } from '../mutations/shipping.js';
import type { MenuCreateInput } from '../mutations/menu.js';

// ---------------------------------------------------------------------------
// Shipping method config (attached to a shipping zone)
// ---------------------------------------------------------------------------
export interface ShippingMethodConfig {
  name: string;
  type: 'PRICE' | 'WEIGHT';
  /** Per-channel pricing: channelSlug → price amount */
  channelPrices?: Record<string, number>;
}

export interface ShippingZoneConfig extends ShippingZoneCreateInput {
  methods?: ShippingMethodConfig[];
}

// ---------------------------------------------------------------------------
// Product type config (wraps input + attribute assignment)
// ---------------------------------------------------------------------------
export interface ProductTypeConfig extends ProductTypeInput {
  /** Slugs of attributes (from defaultAttributes) to assign as PRODUCT attributes */
  productAttributeSlugs?: string[];
  /** Slugs of attributes to assign as VARIANT attributes */
  variantAttributeSlugs?: string[];
}

// ---------------------------------------------------------------------------
// Category tree node
// ---------------------------------------------------------------------------
export interface CategoryConfig extends CategoryInput {
  children?: CategoryConfig[];
}

// ---------------------------------------------------------------------------
// Collection config (includes per-channel listing)
// ---------------------------------------------------------------------------
export interface CollectionConfig extends CollectionCreateInput {
  /** Channel slugs that this collection should be listed on */
  channelSlugs?: string[];
}

// ---------------------------------------------------------------------------
// Page config — references pageType by slug
// ---------------------------------------------------------------------------
export interface PageConfig extends Omit<PageCreateInput, 'pageType'> {
  /** Slug of the page type to use */
  pageTypeSlug: string;
}

// ---------------------------------------------------------------------------
// Page type config — can reference attribute slugs
// ---------------------------------------------------------------------------
export interface PageTypeConfig extends PageTypeCreateInput {
  /** Slugs of attributes (from defaultAttributes) to assign */
  attributeSlugs?: string[];
}

// ---------------------------------------------------------------------------
// Menu item tree node
// Links are resolved at runtime from SeedContext using slug references.
// ---------------------------------------------------------------------------
export interface MenuItemConfig {
  name: string;
  /** External or arbitrary URL */
  url?: string;
  /** Slug of a category (from seeded categories) */
  categorySlug?: string;
  /** Slug of a collection (from seeded collections) */
  collectionSlug?: string;
  /** Slug of a page (from seeded pages) */
  pageSlug?: string;
  /** Nested children */
  children?: MenuItemConfig[];
}

export interface MenuConfig extends MenuCreateInput {
  items?: MenuItemConfig[];
}

// ---------------------------------------------------------------------------
// Seeder section wrapper
// ---------------------------------------------------------------------------
export interface SeederSection<T> {
  enabled: boolean;
  data: T[];
}

// ---------------------------------------------------------------------------
// Root config shape
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Default configuration
// Edit this object to customise what gets seeded.
// Set enabled: false to skip a section without deleting its data.
// ---------------------------------------------------------------------------
export const config: SeedConfig = {
  // -------------------------------------------------------------------------
  taxClasses: {
    enabled: true,
    data: [
      { name: 'Standard Rate' },
      { name: 'Reduced Rate' },
      { name: 'Zero Rate' },
    ],
  },

  // -------------------------------------------------------------------------
  warehouses: {
    enabled: true,
    data: [
      {
        name: 'Main Warehouse',
        slug: 'main-warehouse',
        address: {
          streetAddress1: '125 Main Street',
          city: 'New York',
          country: 'US',
          countryArea: 'NY',
          postalCode: '10001',
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  channels: {
    enabled: true,
    data: [
      {
        name: 'Web Store',
        slug: 'web-store',
        currencyCode: 'USD',
        defaultCountry: 'US',
        isActive: true,
        // warehouse IDs will be injected by the channels seeder at runtime
      },
    ],
  },

  // -------------------------------------------------------------------------
  shipping: {
    enabled: true,
    data: [
      {
        name: 'Domestic',
        countries: ['US'],
        default: false,
        methods: [
          {
            name: 'Standard Shipping',
            type: 'PRICE',
            channelPrices: { 'web-store': 5 },
          },
          {
            name: 'Express Shipping',
            type: 'PRICE',
            channelPrices: { 'web-store': 15 },
          },
        ],
      },
      {
        name: 'International',
        default: true,
        methods: [
          {
            name: 'International Standard',
            type: 'PRICE',
            channelPrices: { 'web-store': 20 },
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  attributes: {
    enabled: true,
    data: [
      {
        name: 'Color',
        slug: 'color',
        type: 'PRODUCT_TYPE',
        inputType: 'SWATCH',
        valueRequired: true,
        visibleInStorefront: true,
        filterableInStorefront: true,
        filterableInDashboard: true,
        values: [
          { name: 'Black', value: '#000000' },
          { name: 'White', value: '#FFFFFF' },
          { name: 'Red', value: '#FF0000' },
          { name: 'Blue', value: '#0000FF' },
          { name: 'Green', value: '#008000' },
        ],
      },
      {
        name: 'Size',
        slug: 'size',
        type: 'PRODUCT_TYPE',
        inputType: 'DROPDOWN',
        valueRequired: true,
        visibleInStorefront: true,
        filterableInStorefront: true,
        filterableInDashboard: true,
        values: [
          { name: 'XS' },
          { name: 'S' },
          { name: 'M' },
          { name: 'L' },
          { name: 'XL' },
          { name: 'XXL' },
        ],
      },
      {
        name: 'Material',
        slug: 'material',
        type: 'PRODUCT_TYPE',
        inputType: 'DROPDOWN',
        valueRequired: false,
        visibleInStorefront: true,
        filterableInStorefront: true,
        filterableInDashboard: true,
        values: [
          { name: 'Cotton' },
          { name: 'Polyester' },
          { name: 'Wool' },
          { name: 'Silk' },
          { name: 'Linen' },
        ],
      },
      {
        name: 'Brand',
        slug: 'brand',
        type: 'PRODUCT_TYPE',
        inputType: 'DROPDOWN',
        valueRequired: false,
        visibleInStorefront: true,
        filterableInStorefront: true,
        filterableInDashboard: true,
        values: [],
      },
      {
        name: 'Author',
        slug: 'author',
        type: 'PAGE_TYPE',
        inputType: 'PLAIN_TEXT',
        valueRequired: false,
        visibleInStorefront: true,
      },
      {
        name: 'Page Subtitle',
        slug: 'page-subtitle',
        type: 'PAGE_TYPE',
        inputType: 'PLAIN_TEXT',
        valueRequired: false,
        visibleInStorefront: true,
      },
    ],
  },

  // -------------------------------------------------------------------------
  productTypes: {
    enabled: true,
    data: [
      {
        name: 'Apparel',
        slug: 'apparel',
        hasVariants: true,
        isShippingRequired: true,
        isDigital: false,
        // attributes to assign (slugs from defaultAttributes)
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
  },

  // -------------------------------------------------------------------------
  categories: {
    enabled: true,
    data: [
      {
        name: 'Clothing',
        slug: 'clothing',
        children: [
          { name: 'Men', slug: 'men' },
          { name: 'Women', slug: 'women' },
          { name: 'Kids', slug: 'kids' },
        ],
      },
      {
        name: 'Accessories',
        slug: 'accessories',
        children: [
          { name: 'Bags', slug: 'bags' },
          { name: 'Jewelry', slug: 'jewelry' },
        ],
      },
      {
        name: 'Digital',
        slug: 'digital',
      },
    ],
  },

  // -------------------------------------------------------------------------
  collections: {
    enabled: true,
    data: [
      {
        name: 'New Arrivals',
        slug: 'new-arrivals',
        isPublished: true,
        channelSlugs: ['web-store'],
      },
      {
        name: 'Sale',
        slug: 'sale',
        isPublished: true,
        channelSlugs: ['web-store'],
      },
      {
        name: 'Featured',
        slug: 'featured',
        isPublished: true,
        channelSlugs: ['web-store'],
      },
    ],
  },

  // -------------------------------------------------------------------------
  pageTypes: {
    enabled: true,
    data: [
      {
        name: 'Standard Page',
        slug: 'standard-page',
        attributeSlugs: ['page-subtitle'],
      },
      {
        name: 'Blog Post',
        slug: 'blog-post',
        attributeSlugs: ['author', 'page-subtitle'],
      },
    ],
  },

  // -------------------------------------------------------------------------
  pages: {
    enabled: true,
    data: [
      {
        title: 'About Us',
        slug: 'about-us',
        pageTypeSlug: 'standard-page',
        isPublished: true,
      },
      {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        pageTypeSlug: 'standard-page',
        isPublished: true,
      },
      {
        title: 'Terms & Conditions',
        slug: 'terms-and-conditions',
        pageTypeSlug: 'standard-page',
        isPublished: true,
      },
    ],
  },

  // -------------------------------------------------------------------------
  menus: {
    enabled: true,
    data: [
      {
        name: 'Main Menu',
        slug: 'navbar',
        items: [
          {
            name: 'Home',
            url: '/',
          },
          {
            name: 'Clothing',
            categorySlug: 'clothing',
            children: [
              { name: 'Men',   categorySlug: 'men' },
              { name: 'Women', categorySlug: 'women' },
              { name: 'Kids',  categorySlug: 'kids' },
            ],
          },
          {
            name: 'Accessories',
            categorySlug: 'accessories',
            children: [
              { name: 'Bags',    categorySlug: 'bags' },
              { name: 'Jewelry', categorySlug: 'jewelry' },
            ],
          },
          {
            name: 'Sale',
            collectionSlug: 'sale',
          },
        ],
      },
      {
        name: 'Footer',
        slug: 'footer',
        items: [
          {
            name: 'Company',
            children: [
              { name: 'About Us', pageSlug: 'about-us' },
            ],
          },
          {
            name: 'Legal',
            children: [
              { name: 'Privacy Policy',     pageSlug: 'privacy-policy' },
              { name: 'Terms & Conditions', pageSlug: 'terms-and-conditions' },
            ],
          },
        ],
      },
    ],
  },
};

// Re-export attribute assign type so seeders can import it from here
export type { ProductAttributeAssignInput };
