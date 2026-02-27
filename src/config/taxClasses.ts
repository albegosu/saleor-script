import type { TaxClassCreateInput } from '../mutations/taxClass.js';
import type { SeederSection } from './types.js';

export const taxClasses: SeederSection<TaxClassCreateInput> = {
  enabled: false,
  data: [
    { name: 'Standard Rate' },
  ],
};
