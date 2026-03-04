import type { PageConfig } from './pages.js';

/**
 * Company pages to seed.
 * Each item becomes a Saleor page of type "Empresa".
 *
 * You can freely add/remove items from this array.
 */
export const companyPages: PageConfig[] = [
  {
    title: 'Empresa Demo 1',
    slug: 'empresa-demo-1',
    pageTypeSlug: 'empresa',
    isPublished: true,
  },
  {
    title: 'Empresa Demo 2',
    slug: 'empresa-demo-2',
    pageTypeSlug: 'empresa',
    isPublished: true,
  },
];

