// More tab (FND-SHL-02): eight entries; unbuilt features show "Coming soon";
// the anonymous data-loss warning banner appears here and on Account (DR-16).

import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '../../src/features/appStore';
import { t } from '../../src/i18n';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Card, Header, Icon, IconName, Row, T } from '../../src/ui/kit';
import { Notices } from '../../src/ui/Notices';
import { useTheme } from '../../src/ui/theme';

const ITEMS: { labelKey: string; icon: IconName; href?: string; soon?: boolean }[] = [
  { labelKey: 'more.items.vehicles', icon: 'car', href: '/vehicles' },
  { labelKey: 'more.items.reminders', icon: 'bell-outline', href: '/reminders' },
  { labelKey: 'more.items.checklists', icon: 'clipboard-check-outline', soon: true },
  { labelKey: 'more.items.backup', icon: 'upload-outline', href: '/backup-export' },
  { labelKey: 'more.items.join', icon: 'account-plus-outline', soon: true },
  { labelKey: 'more.items.settings', icon: 'cog-outline', href: '/settings' },
  { labelKey: 'more.items.account', icon: 'account-circle-outline', href: '/account' },
  { labelKey: 'more.items.about', icon: 'shield-check-outline', href: '/about' },
];

function MoreScreen() {
  const th = useTheme();
  const count = useAppStore((s) => s.vehicles.filter((v) => !v.archived).length);
  const anonymous = useAppStore((s) => !!s.user?.isAnonymous);
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('tabs.more')} back={false} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16 }}>
        <Notices />
        {anonymous && (
          <Card style={{ backgroundColor: th.primarySoft, borderColor: th.primarySoft }}>
            <T weight="semi">{t('account.anonTitle')}</T>
            <T size={13} color={th.muted} style={{ marginTop: 4, lineHeight: 19 }}>
              {t('account.anonBody')}
            </T>
          </Card>
        )}
        <Card style={{ paddingVertical: 4 }}>
          {ITEMS.map((i) => (
            <Row
              key={i.labelKey}
              icon={i.icon}
              title={t(i.labelKey)}
              onPress={i.href ? () => router.push(i.href as never) : undefined}
              right={
                i.soon ? (
                  <T size={12} weight="semi" color={th.muted}>{t('common.comingSoon')}</T>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {i.labelKey === 'more.items.vehicles' ? <T color={th.muted}>{count}</T> : null}
                    {i.labelKey === 'more.items.account' && anonymous ? <T color={th.muted}>{t('more.guest')}</T> : null}
                    <Icon name="chevron-right" color={th.muted} />
                  </View>
                )
              }
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

export default function More() {
  return (
    <ErrorBoundary screen="more">
      <MoreScreen />
    </ErrorBoundary>
  );
}
