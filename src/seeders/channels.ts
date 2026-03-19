import { apollo } from '../apollo/apollo-client.js';
import { CHANNEL_CREATE, CHANNEL_UPDATE } from '../mutations/channel.js';
import type {
  ChannelCreateInput,
  ChannelCreateResult,
  ChannelUpdateResult,
} from '../mutations/channel.js';
import { CHANNEL_SLUG_TEST } from '../config/channels.js';
import type { SeederSection } from '../config/index.js';
import { fetchChannelIdsBySlug } from '../queries/channels.js';
import { resolveDefaultWarehouseId } from '../queries/warehouses.js';
import { logSuccess, logError, executeMutation, type SeedContext } from './utils.js';

/**
 * Ensures the test channel has the default warehouse linked (create skips or Saleor stock warehouse).
 *
 * @param ctx - Seed context with warehouse and channel IDs when available
 */
async function ensureDefaultWarehouseOnTestChannel(ctx: SeedContext): Promise<void> {
  const warehouseId = await resolveDefaultWarehouseId(ctx.warehouseIds);
  if (!warehouseId) {
    console.warn(
      '  ⚠ Canal test: no se encontró almacén por defecto (slug default-warehouse/default o nombre "Default Warehouse").',
    );
    return;
  }

  let channelId = ctx.channelIds[CHANNEL_SLUG_TEST];
  if (!channelId) {
    const bySlug = await fetchChannelIdsBySlug();
    channelId = bySlug[CHANNEL_SLUG_TEST];
  }
  if (!channelId) {
    console.warn(
      `  ⚠ Canal test: el canal con slug "${CHANNEL_SLUG_TEST}" no existe; no se asigna almacén.`,
    );
    return;
  }

  const { data, hasError } = await executeMutation<ChannelUpdateResult>(
    () =>
      apollo.mutate({
        mutation: CHANNEL_UPDATE,
        variables: { id: channelId, input: { addWarehouses: [warehouseId] } },
        errorPolicy: 'all',
      }),
    'ChannelUpdate',
    CHANNEL_SLUG_TEST,
  );

  if (hasError) return;

  const result = data?.channelUpdate;
  const errors = result?.errors ?? [];

  if (errors.length > 0) {
    logError('ChannelUpdate', CHANNEL_SLUG_TEST, errors);
    return;
  }

  if (result?.channel) {
    console.log(
      `  ✔ Canal "${result.channel.name}" (${result.channel.slug}): almacén por defecto vinculado`,
    );
  }
}

export async function seedChannels(
  section: SeederSection<ChannelCreateInput>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Canales]');

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

  await ensureDefaultWarehouseOnTestChannel(ctx);
}
