import type { MenuCreateInput } from '../mutations/menu.js';
import type { SeederSection } from './types.js';

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

export const menus: SeederSection<MenuConfig> = {
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
    {
      name: 'Blog',
      slug: 'blog',
      items: [],
    },
  ],
};
