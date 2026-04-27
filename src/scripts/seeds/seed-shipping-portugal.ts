import 'dotenv/config';
import { initAuth } from '../../apollo/apollo-client.js';
import { apollo } from '../../apollo/apollo-client.js';
import { fetchChannelIdsBySlug } from '../../queries/channels.js';
import { fetchWarehouseIdsBySlug } from '../../queries/warehouses.js';
import {
  SHIPPING_ZONE_CREATE,
  SHIPPING_PRICE_CREATE,
  SHIPPING_METHOD_CHANNEL_LISTING_UPDATE,
  type ShippingZoneCreateResult,
  type ShippingPriceCreateResult,
  type ShippingMethodChannelListingUpdateResult,
} from '../../mutations/shipping.js';
import { executeMutation, logSuccess, logError } from '../../seeders/utils.js';
import {
  portugueseShippingZones,
  type PortugalShippingZone,
} from '../../config/shipping-portugal.js';

const CHANNEL_SLUG = process.env.SHIPPING_CHANNEL_SLUG;
const WAREHOUSE_SLUG = process.env.SHIPPING_WAREHOUSE_SLUG;

function validateEnv(): void {
  if (!CHANNEL_SLUG) {
    throw new Error('Missing required env var SHIPPING_CHANNEL_SLUG');
  }
  if (!WAREHOUSE_SLUG) {
    throw new Error('Missing required env var SHIPPING_WAREHOUSE_SLUG');
  }
}

interface SeedSummary {
  zonesCreated: number;
  methodsCreated: number;
  listingsUpdated: number;
  errors: number;
}

async function seedZone(
  zone: PortugalShippingZone,
  channelId: string,
  warehouseId: string,
  summary: SeedSummary,
): Promise<void> {
  console.log(`\n── Zona: ${zone.name} (${zone.methods.length} tarifas) ──`);

  const { data: zoneData, hasError: zoneHasError } =
    await executeMutation<ShippingZoneCreateResult>(
      () =>
        apollo.mutate({
          mutation: SHIPPING_ZONE_CREATE,
          variables: {
            input: {
              name: zone.name,
              countries: ['PT'],
              default: false,
              addChannels: [channelId],
              addWarehouses: [warehouseId],
            },
          },
          errorPolicy: 'all',
        }),
      'ShippingZone',
      zone.name,
    );

  if (zoneHasError) {
    summary.errors++;
    return;
  }

  const zoneResult = zoneData?.shippingZoneCreate;
  const zoneErrors = zoneResult?.errors ?? [];

  if (zoneErrors.length > 0) {
    logError('ShippingZone', zone.name, zoneErrors);
    summary.errors++;
    return;
  }

  const createdZone = zoneResult?.shippingZone;
  if (!createdZone) return;

  logSuccess('ShippingZone', createdZone.name, createdZone.id);
  summary.zonesCreated++;

  for (const method of zone.methods) {
    const { data: methodData, hasError: methodHasError } =
      await executeMutation<ShippingPriceCreateResult>(
        () =>
          apollo.mutate({
            mutation: SHIPPING_PRICE_CREATE,
            variables: {
              input: {
                name: method.name,
                shippingZone: createdZone.id,
                type: 'WEIGHT',
                minimumOrderWeight: method.minimumOrderWeight,
                maximumOrderWeight: method.maximumOrderWeight,
                addPostalCodeRules: zone.postalCodeRanges,
                inclusionType: 'INCLUDE',
              },
            },
            errorPolicy: 'all',
          }),
        'ShippingMethod',
        method.name,
      );

    if (methodHasError) {
      summary.errors++;
      continue;
    }

    const methodResult = methodData?.shippingPriceCreate;
    const methodErrors = methodResult?.errors ?? [];

    if (methodErrors.length > 0) {
      logError('ShippingMethod', method.name, methodErrors);
      summary.errors++;
      continue;
    }

    const createdMethod = methodResult?.shippingMethod;
    if (!createdMethod) continue;

    logSuccess('ShippingMethod', createdMethod.name, createdMethod.id);
    summary.methodsCreated++;

    const { data: listingData, hasError: listingHasError } =
      await executeMutation<ShippingMethodChannelListingUpdateResult>(
        () =>
          apollo.mutate({
            mutation: SHIPPING_METHOD_CHANNEL_LISTING_UPDATE,
            variables: {
              id: createdMethod.id,
              input: {
                addChannels: [
                  {
                    channelId,
                    price: method.price,
                  },
                ],
              },
            },
            errorPolicy: 'all',
          }),
        'ShippingMethodListing',
        method.name,
      );

    if (listingHasError) {
      summary.errors++;
      continue;
    }

    const listingErrors =
      listingData?.shippingMethodChannelListingUpdate?.errors ?? [];
    if (listingErrors.length > 0) {
      logError('ShippingMethodListing', method.name, listingErrors);
      summary.errors++;
    } else {
      summary.listingsUpdated++;
    }
  }
}

async function main(): Promise<void> {
  validateEnv();
  await initAuth();

  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Seed: Tarifas de envío Portugal (TXT_VLC) ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`  Canal: ${CHANNEL_SLUG}`);
  console.log(`  Almacén: ${WAREHOUSE_SLUG}`);

  const channelIds = await fetchChannelIdsBySlug();
  const channelId = channelIds[CHANNEL_SLUG!];
  if (!channelId) {
    throw new Error(
      `Channel "${CHANNEL_SLUG}" not found. Available: ${Object.keys(channelIds).join(', ')}`,
    );
  }

  const warehouseIds = await fetchWarehouseIdsBySlug();
  const warehouseId = warehouseIds[WAREHOUSE_SLUG!];
  if (!warehouseId) {
    throw new Error(
      `Warehouse "${WAREHOUSE_SLUG}" not found. Available: ${Object.keys(warehouseIds).join(', ')}`,
    );
  }

  const totalMethods = portugueseShippingZones.reduce(
    (acc, z) => acc + z.methods.length,
    0,
  );
  console.log(
    `\n  Zonas: ${portugueseShippingZones.length} | Tarifas totales: ${totalMethods}`,
  );

  const summary: SeedSummary = {
    zonesCreated: 0,
    methodsCreated: 0,
    listingsUpdated: 0,
    errors: 0,
  };

  for (const zone of portugueseShippingZones) {
    await seedZone(zone, channelId, warehouseId, summary);
  }

  console.log('\n════════════════════════════════════════════');
  console.log('  Resumen:');
  console.log(`    Zonas creadas:      ${summary.zonesCreated}`);
  console.log(`    Tarifas creadas:    ${summary.methodsCreated}`);
  console.log(`    Listings asignados: ${summary.listingsUpdated}`);
  console.log(`    Errores:            ${summary.errors}`);
  console.log('════════════════════════════════════════════\n');

  if (summary.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
