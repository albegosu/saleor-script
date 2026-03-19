import type { ChannelCreateInput } from '../mutations/channel.js';
import type { SeederSection } from './types.js';

/** Channel slug used for the test channel; default warehouse is ensured on this channel after seed. */
export const CHANNEL_SLUG_TEST = 'canal-test';

export const channels: SeederSection<ChannelCreateInput> = {
  enabled: true,
  data: [
    {
      name: 'Canal Test',
      slug: CHANNEL_SLUG_TEST,
      currencyCode: 'EUR',
      defaultCountry: 'ES',
      isActive: true,
      // warehouse IDs will be injected by the channels seeder at runtime
    },
  ],
};
