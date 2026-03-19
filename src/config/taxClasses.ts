import type { TaxClassCreateInput } from '../mutations/taxClass.js';
import type { SeederSection } from './types.js';

export const taxClasses: SeederSection<TaxClassCreateInput> = {
  enabled: true,
  data: [{ name: 'Standard Rate' }],
};
