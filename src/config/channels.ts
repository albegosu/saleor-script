import type { ChannelCreateInput } from '../mutations/channel.js';
import type { SeederSection } from './types.js';

export const channels: SeederSection<ChannelCreateInput> = {
  enabled: true,
  data: [
    {
      name: 'Canal Test',
      slug: 'canal-test',
      currencyCode: 'EUR',
      defaultCountry: 'ES',
      isActive: true,
      // warehouse IDs will be injected by the channels seeder at runtime
    },
  ],
};
