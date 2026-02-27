import { apollo } from '../apollo/apollo-client.js';
import {
  SHIPPING_ZONE_CREATE,
  SHIPPING_PRICE_CREATE,
  SHIPPING_METHOD_CHANNEL_LISTING_UPDATE,
} from '../mutations/shipping.js';
import type {
  ShippingZoneCreateResult,
  ShippingPriceCreateResult,
  ShippingMethodChannelListingUpdateResult,
} from '../mutations/shipping.js';
import type { SeederSection, ShippingZoneConfig } from '../config/index.js';
import { logSuccess, logError, executeMutation, type SeedContext } from './utils.js';

export async function seedShipping(
  section: SeederSection<ShippingZoneConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Shipping Zones]');

  for (const zoneConfig of section.data) {
    const { methods, ...zoneInput } = zoneConfig;

    const channelIds = Object.values(ctx.channelIds);
    const warehouseIds = Object.values(ctx.warehouseIds);

    const { data: zoneData, hasError: zoneHasError } =
      await executeMutation<ShippingZoneCreateResult>(
        () =>
          apollo.mutate({
            mutation: SHIPPING_ZONE_CREATE,
            variables: {
              input: {
                ...zoneInput,
                addChannels: channelIds.length > 0 ? channelIds : zoneInput.addChannels,
                addWarehouses: warehouseIds.length > 0 ? warehouseIds : zoneInput.addWarehouses,
              },
            },
            errorPolicy: 'all',
          }),
        'ShippingZone',
        zoneConfig.name,
      );

    if (zoneHasError) continue;

    const zoneResult = zoneData?.shippingZoneCreate;
    const zoneErrors = zoneResult?.errors ?? [];

    if (zoneErrors.length > 0) {
      logError('ShippingZone', zoneConfig.name, zoneErrors);
      continue;
    }

    const zone = zoneResult?.shippingZone;
    if (!zone) continue;

    ctx.shippingZoneIds[zone.name] = zone.id;
    logSuccess('ShippingZone', zone.name, zone.id);

    for (const method of methods ?? []) {
      const { data: methodData, hasError: methodHasError } =
        await executeMutation<ShippingPriceCreateResult>(
          () =>
            apollo.mutate({
              mutation: SHIPPING_PRICE_CREATE,
              variables: {
                input: { name: method.name, shippingZone: zone.id, type: method.type },
              },
              errorPolicy: 'all',
            }),
          'ShippingMethod',
          method.name,
        );

      if (methodHasError) continue;

      const methodResult = methodData?.shippingPriceCreate;
      const methodErrors = methodResult?.errors ?? [];

      if (methodErrors.length > 0) {
        logError('ShippingMethod', method.name, methodErrors);
        continue;
      }

      const createdMethod = methodResult?.shippingMethod;
      if (!createdMethod) continue;

      logSuccess('ShippingMethod', createdMethod.name, createdMethod.id);

      if (method.channelPrices && Object.keys(method.channelPrices).length > 0) {
        const addChannels = Object.entries(method.channelPrices)
          .map(([slug, amount]) => {
            const channelId = ctx.channelIds[slug];
            if (!channelId) {
              console.warn(
                `    ⚠ ShippingMethod "${method.name}": channel slug "${slug}" not found in context, skipping price`,
              );
              return null;
            }
            return { channelId, price: { amount, currency: '' } };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (addChannels.length > 0) {
          const { data: listingData, hasError: listingHasError } =
            await executeMutation<ShippingMethodChannelListingUpdateResult>(
              () =>
                apollo.mutate({
                  mutation: SHIPPING_METHOD_CHANNEL_LISTING_UPDATE,
                  variables: { id: createdMethod.id, input: { addChannels } },
                  errorPolicy: 'all',
                }),
              'ShippingMethodListing',
              method.name,
            );

          if (!listingHasError) {
            const listingErrors = listingData?.shippingMethodChannelListingUpdate?.errors ?? [];
            if (listingErrors.length > 0) {
              logError('ShippingMethodListing', method.name, listingErrors);
            }
          }
        }
      }
    }
  }
}
