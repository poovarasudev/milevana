// Account (FND-AUTH-03/08, DR-17 D1): anonymous users see the data-loss
// warning and Link Google; linked users see name, email and Sign out. Both
// get the deletion entry point — "Delete account" when linked, "Delete all
// my data" when anonymous (VD-06/08, REL-06/08).

import { router } from 'expo-router';
import { View } from 'react-native';
import { useAppStore } from '../src/features/appStore';
import { linkGoogle, requestSignOut } from '../src/features/auth';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Button, Card, Header, Row, T } from '../src/ui/kit';
import { Notices } from '../src/ui/Notices';
import { useTheme } from '../src/ui/theme';

function AccountScreen() {
  const th = useTheme();
  const user = useAppStore((s) => s.user);
  const linking = useAppStore((s) => s.linking);
  const linkError = useAppStore((s) => s.linkError);
  const signingOut = useAppStore((s) => s.signingOut);
  const anonymous = !user || user.isAnonymous;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('account.title')} />
      <View style={{ padding: 20, gap: 16 }}>
        <Notices />
        {anonymous ? (
          <Card style={{ gap: 12 }}>
            <T weight="semi" size={17}>{t('account.anonTitle')}</T>
            <T color={th.muted} style={{ lineHeight: 21 }}>{t('account.anonBody')}</T>
            {linkError ? <T size={13} color={th.danger}>{t('account.linkFailed')}</T> : null}
            <Button
              title={linking ? t('account.linking') : t('account.linkGoogle')}
              icon="google"
              disabled={linking}
              onPress={() => void linkGoogle()}
            />
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <T size={12} weight="semi" color={th.muted} style={{ letterSpacing: 1.1 }}>
              {t('account.signedInAs').toUpperCase()}
            </T>
            <View>
              <T weight="semi" size={17}>{user?.displayName ?? user?.email ?? ''}</T>
              {user?.displayName && user?.email ? <T size={13} color={th.muted}>{user.email}</T> : null}
            </View>
            <Button
              title={t('account.signOut')}
              kind="secondary"
              disabled={signingOut}
              onPress={requestSignOut}
            />
          </Card>
        )}
        <Card style={{ paddingVertical: 4 }}>
          <Row
            icon="trash-can-outline"
            title={anonymous ? t('account.deleteAllData') : t('account.deleteAccount')}
            sub={anonymous ? t('account.deleteAllDataSub') : t('account.deleteAccountSub')}
            onPress={() => router.push('/delete-account')}
          />
        </Card>
      </View>
    </View>
  );
}

export default function Account() {
  return (
    <ErrorBoundary screen="account">
      <AccountScreen />
    </ErrorBoundary>
  );
}
