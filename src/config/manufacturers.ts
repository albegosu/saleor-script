import type { PageConfig } from './pages.js';

/**
 * Manufacturer pages to seed.
 * Each item becomes a Saleor page of type "Fabricantes".
 *
 * You can freely add/remove items from this array.
 */
export const manufacturerPages: PageConfig[] = [
  {
    title: 'Fabricante Demo 1',
    slug: 'fabricante-demo-1',
    pageTypeSlug: 'fabricantes',
    isPublished: true,
  },
  {
    title: 'Fabricante Demo 2',
    slug: 'fabricante-demo-2',
    pageTypeSlug: 'fabricantes',
    isPublished: true,
  },
];

