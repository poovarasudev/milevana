// Add sheet (FND-SHL-02, AC-D15): the six entry types; each opens a
// placeholder screen in Foundation (entry forms arrive in the logging tab).

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAppStore } from '../src/features/appStore';
import { displayOdometer, useSettings } from '../src/features/format';
import { ENTRY_ICON, ENTRY_TYPES } from '../src/features/icons';
import { t } from '../src/i18n';
import { Icon, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

export default function AddSheet() {
  const th = useTheme();
  const settings = useSettings();
  const v = useAppStore((s) => s.vehicles.find((x) => x.id === s.selectedVehicleId));
  if (!v) {
    return (
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel={t('common.close')} />
        <View style={{ backgroundColor: th.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 }}>
          <T size={17} weight="semi">{t('addSheet.chooseVehicle')}</T>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel={t('common.close')} />
      <View style={{ backgroundColor: th.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 }}>
        <T size={20} weight="semi">{t('addSheet.title', { name: v.name })}</T>
        <T size={13} color={th.muted} style={{ marginBottom: 16 }}>
          {t('addSheet.lastOdometer', { value: displayOdometer(v, settings) })}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {ENTRY_TYPES.map((x) => (
            <Pressable
              key={x}
              accessibilityRole="button"
              onPress={() => {
                router.back();
                // CHK-06: Inspection opens the template picker, not a form.
                if (x === 'inspection') {
                  router.push('/inspection/pick');
                } else {
                  router.push({ pathname: '/entry/[type]', params: { type: x } });
                }
              }}
              style={{ flexGrow: 1, flexBasis: '30%', alignItems: 'center', gap: 8, paddingVertical: 16, minHeight: 48, borderRadius: 18, backgroundColor: th.card, borderWidth: 1, borderColor: th.divider }}
            >
              <Icon name={ENTRY_ICON[x]} color={th.primary} />
              <T size={13} weight="semi">{t(`entryTypes.${x}`)}</T>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
