// Settings (FND-SET-02): every display setting persists to
// users/{uid}.settings through the repository and repaints immediately.
// backupFrequency and mutedReminderVehicleIds are stored keys but not shown in
// Foundation (SET-02 scope note).

import { ScrollView, View } from 'react-native';
import { SELECTABLE_CURRENCIES } from '../src/domain/money';
import type { SettingsDoc } from '../src/data/schema/user';
import { useAppStore } from '../src/features/appStore';
import { settingsPreview, useSettings } from '../src/features/format';
import { reportNonFatal } from '../src/features/reporting';
import { getRepos } from '../src/features/runtime';
import { guardedWrite } from '../src/features/vehicleActions';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Card, Header, T } from '../src/ui/kit';
import { Notices } from '../src/ui/Notices';
import { Picker } from '../src/ui/Picker';
import { useTheme } from '../src/ui/theme';

type SettingKey = keyof Pick<
  SettingsDoc,
  'currency' | 'distanceUnit' | 'volumeUnit' | 'efficiencyFormat' | 'dateFormat' | 'theme'
>;

function SettingPicker<K extends SettingKey>({ labelKey, setting, options }: {
  labelKey: string;
  setting: K;
  options: { value: SettingsDoc[K]; label: string; sub?: string }[];
}) {
  const s = useSettings();
  const uid = useAppStore((x) => x.user?.uid);
  const current = options.find((o) => o.value === s[setting]);
  const pick = async (value: string) => {
    if (!uid || value === s[setting]) return;
    try {
      await guardedWrite(getRepos().users.updateSettings(uid, { [setting]: value }));
    } catch (e) {
      reportNonFatal(e, { stage: 'settings-write' });
    }
  };
  return (
    <Picker
      label={t(labelKey)}
      valueLabel={current?.label ?? String(s[setting])}
      options={options.map((o) => ({ value: String(o.value), label: o.label, sub: o.sub }))}
      onPick={(v) => void pick(v)}
    />
  );
}

function SettingsScreen() {
  const th = useTheme();
  const s = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('settings.title')} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Notices />
        <SettingPicker
          labelKey="settings.currency"
          setting="currency"
          options={SELECTABLE_CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <SettingPicker
          labelKey="settings.distance"
          setting="distanceUnit"
          options={[
            { value: 'km', label: t('settings.options.distance.km') },
            { value: 'mi', label: t('settings.options.distance.mi') },
          ]}
        />
        <SettingPicker
          labelKey="settings.volume"
          setting="volumeUnit"
          options={[
            { value: 'litres', label: t('settings.options.volume.litres') },
            { value: 'gal_us', label: t('settings.options.volume.gal_us') },
            { value: 'gal_uk', label: t('settings.options.volume.gal_uk') },
          ]}
        />
        <SettingPicker
          labelKey="settings.efficiency"
          setting="efficiencyFormat"
          options={[
            { value: 'km_per_l', label: t('settings.options.efficiency.km_per_l') },
            { value: 'l_per_100km', label: t('settings.options.efficiency.l_per_100km') },
            { value: 'mpg', label: t('settings.options.efficiency.mpg') },
          ]}
        />
        <SettingPicker
          labelKey="settings.date"
          setting="dateFormat"
          options={[
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, // i18n-allow — format tokens are the label
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, // i18n-allow
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }, // i18n-allow
          ]}
        />
        <SettingPicker
          labelKey="settings.theme"
          setting="theme"
          options={[
            { value: 'system', label: t('settings.options.theme.system') },
            { value: 'light', label: t('settings.options.theme.light') },
            { value: 'dark', label: t('settings.options.theme.dark') },
          ]}
        />
        <Picker
          label={t('settings.language')}
          valueLabel={t('settings.options.language.en')}
          options={[{ value: 'en', label: t('settings.options.language.en') }]}
          onPick={() => undefined}
        />
        <Card>
          <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2 }}>
            {t('settings.preview').toUpperCase()}
          </T>
          <T size={15} weight="semi" style={{ marginTop: 6 }}>{settingsPreview(s)}</T>
        </Card>
      </ScrollView>
    </View>
  );
}

export default function Settings() {
  return (
    <ErrorBoundary screen="settings">
      <SettingsScreen />
    </ErrorBoundary>
  );
}
