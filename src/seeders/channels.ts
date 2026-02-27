import { apollo } from '../apollo/apollo-client.js';
import { CHANNEL_CREATE } from '../mutations/channel.js';
import type { ChannelCreateInput, ChannelCreateResult } from '../mutations/channel.js';
import type { SeederSection } from '../config/defaults.js';
import { logSuccess, logError, executeMutation, type SeedContext } from './utils.js';

export async function seedChannels(
  section: SeederSection<ChannelCreateInput>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Channels]');

  for (const input of section.data) {
    const warehouseIds = Object.values(ctx.warehouseIds);
    const enrichedInput: ChannelCreateInput = {
      ...input,
      addWarehouses: warehouseIds.length > 0 ? warehouseIds : input.addWarehouses,
    };

    const { data, hasError } = await executeMutation<ChannelCreateResult>(
      () =>
        apollo.mutate({
          mutation: CHANNEL_CREATE,
          variables: { input: enrichedInput },
          errorPolicy: 'all',
        }),
      'Channel',
      input.name,
    );

    if (hasError) continue;

    const result = data?.channelCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Channel', input.name, errors);
      continue;
    }

    if (result?.channel) {
      ctx.channelIds[result.channel.slug] = result.channel.id;
      logSuccess('Channel', result.channel.name, result.channel.id);
    }
  }
}
