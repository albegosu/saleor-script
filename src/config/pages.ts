import type { PageCreateInput } from '../mutations/page.js';
import type { SeederSection } from './types.js';

export interface PageConfig extends Omit<PageCreateInput, 'pageType'> {
  /** Slug of the page type to use */
  pageTypeSlug: string;
}

export const pages: SeederSection<PageConfig> = {
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
};
