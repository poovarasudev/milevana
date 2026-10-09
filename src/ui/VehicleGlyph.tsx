// Vehicle glyph: type icon on the palette colour's soft wash (DR-04) plus the
// pending-sync icon when the document has unconfirmed writes (FR-OFF-03).

import { View } from 'react-native';
import { Icon } from './kit';
import { usePaletteColor } from './palette';
import { useTheme } from './theme';
import { VEHICLE_ICON } from '../features/icons';
import { t } from '../i18n';
import type { VehicleRecord } from '../data/repos/vehicleRepo';

export function VehicleGlyph({ vehicle, size = 44 }: { vehicle: VehicleRecord; size?: number }) {
  const th = useTheme();
  const p = usePaletteColor(vehicle.color);
  return (
    <View>
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={VEHICLE_ICON[vehicle.type]} color={p.color} size={size * 0.55} />
      </View>
      {vehicle.pending ? (
        <View
          accessibilityLabel={t('common.syncPending')}
          style={{
            position: 'absolute', right: -4, top: -4, width: 18, height: 18,
            borderRadius: 9, backgroundColor: th.card, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: th.border,
          }}
        >
          <Icon name="sync" size={12} color={th.muted} />
        </View>
      ) : null}
    </View>
  );
}
