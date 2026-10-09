// One-time welcome (FND-SHL-01): shown once per uid — the flag is set on
// display so a relaunch before adding a vehicle goes straight to the
// "Add your first vehicle" empty state (DR-09 D1). No sign-in appears at any
// point on Android (AC-D22).

import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localFlags } from '../src/data/localFlags';
import { useAppStore } from '../src/features/appStore';
import { t } from '../src/i18n';
import { Button, Card, Icon, IconName, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

const PRINCIPLES: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'cancel', titleKey: 'welcome.principles.noAds.title', bodyKey: 'welcome.principles.noAds.body' },
  { icon: 'cloud-off-outline', titleKey: 'welcome.principles.offline.title', bodyKey: 'welcome.principles.offline.body' },
  { icon: 'lock-open-outline', titleKey: 'welcome.principles.free.title', bodyKey: 'welcome.principles.free.body' },
];

export default function Welcome() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const uid = useAppStore((s) => s.user?.uid);

  useEffect(() => {
    if (uid) void localFlags.setWelcomeSeen(uid);
    useAppStore.setState({ welcomeSeen: true });
  }, [uid]);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
      <T size={12} weight="semi" color={th.primary} style={{ letterSpacing: 1.4 }}>{t('welcome.eyebrow')}</T>
      <T size={34} weight="semi" style={{ letterSpacing: -1, marginTop: 8, lineHeight: 38 }}>{t('welcome.title')}</T>
      <T size={15} weight="semi" color={th.text} style={{ marginTop: 10 }}>{t('welcome.tagline')}</T>
      <T size={15} color={th.muted} style={{ marginTop: 8, lineHeight: 22 }}>{t('welcome.body')}</T>
      <View style={{ gap: 12, marginTop: 32, flex: 1 }}>
        {PRINCIPLES.map((p) => (
          <Card key={p.titleKey} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: th.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={p.icon} color={th.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="semi">{t(p.titleKey)}</T>
              <T size={13} color={th.muted}>{t(p.bodyKey)}</T>
            </View>
          </Card>
        ))}
      </View>
      <Button title={t('welcome.getStarted')} onPress={() => router.replace('/vehicle/new')} />
    </View>
  );
}
