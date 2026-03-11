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
      items: [
        { name: 'Post de blog 1', pageSlug: 'post-blog-1' },
        { name: 'Post de blog 2', pageSlug: 'post-blog-2' },
        { name: 'Post de blog 3', pageSlug: 'post-blog-3' },
        { name: 'Post de blog 4', pageSlug: 'post-blog-4' },
        { name: 'Post de blog 5', pageSlug: 'post-blog-5' },
        { name: 'Post de blog 6', pageSlug: 'post-blog-6' },
        { name: 'Post de blog 7', pageSlug: 'post-blog-7' },
        { name: 'Post de blog 8', pageSlug: 'post-blog-8' },
        { name: 'Post de blog 9', pageSlug: 'post-blog-9' },
        { name: 'Post de blog 10', pageSlug: 'post-blog-10' },
      ],
    },
  ],
};
