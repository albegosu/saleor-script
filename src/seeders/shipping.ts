import { apollo } from '../apollo/apollo-client.js';
import {
  SHIPPING_ZONE_CREATE,
  SHIPPING_PRICE_CREATE,
  SHIPPING_METHOD_CHANNEL_LISTING_UPDATE,
} from '../mutations/shipping.js';
import { fetchChannelIdsBySlug } from '../queries/channels.js';
import { fetchWarehouseIdsBySlug } from '../queries/warehouses.js';
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
  console.log('\n[Zonas de envío]');

  // Ensure context has channel and warehouse IDs even when this seeder
  // is run in aislamiento con "--only=shipping"
  if (Object.keys(ctx.channelIds).length === 0) {
    ctx.channelIds = await fetchChannelIdsBySlug();
  }
  if (Object.keys(ctx.warehouseIds).length === 0) {
    ctx.warehouseIds = await fetchWarehouseIdsBySlug();
  }

  for (const zoneConfig of section.data) {
    const { methods, channelSlugs, warehouseSlugs, ...zoneInput } = zoneConfig;

    const channelIds =
      channelSlugs && channelSlugs.length > 0
        ? channelSlugs
            .map((slug) => {
              const id = ctx.channelIds[slug];
              if (!id) {
                console.warn(
                  `  ⚠ Zona de envío "${zoneConfig.name}": el canal con slug "${slug}" no existe, se omite`,
                );
                return null;
              }
              return id;
            })
            .filter((id): id is string => id !== null)
        : Object.values(ctx.channelIds);

    const warehouseIds =
      warehouseSlugs && warehouseSlugs.length > 0
        ? warehouseSlugs
            .map((slug) => {
              const id = ctx.warehouseIds[slug];
              if (!id) {
                console.warn(
                  `  ⚠ Zona de envío "${zoneConfig.name}": el almacén con slug "${slug}" no existe, se omite`,
                );
                return null;
              }
              return id;
            })
            .filter((id): id is string => id !== null)
        : Object.values(ctx.warehouseIds);

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
            const { minimumOrderPrice, maximumOrderPrice } = method;
            const channelId = ctx.channelIds[slug];
            if (!channelId) {
              console.warn(
                `    ⚠ Método de envío "${method.name}": el slug de canal "${slug}" no existe en el contexto, se omite el precio`,
              );
              return null;
            }
            return {
              channelId,
              price: amount,
              ...(typeof minimumOrderPrice === 'number'
                ? { minimumOrderPrice }
                : {}),
              ...(typeof maximumOrderPrice === 'number'
                ? { maximumOrderPrice }
                : {}),
            };
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
