// Delete account (REL-06/08/09): More → Account → Delete account on Android;
// the /delete-account web route serves the same flow (VD-09). Anonymous users
// get the "Delete all my data" variant (VD-08).

import { ScrollView, View } from 'react-native';
import { useAppStore } from '../src/features/appStore';
import { t } from '../src/i18n';
import { DeleteAccountFlow } from '../src/ui/DeleteAccountFlow';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Header } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

function DeleteAccountScreen() {
  const th = useTheme();
  const anonymous = useAppStore((s) => s.user?.isAnonymous ?? true);
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={anonymous ? t('deletion.anonTitle') : t('deletion.title')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <DeleteAccountFlow />
      </ScrollView>
    </View>
  );
}

export default function DeleteAccount() {
  return (
    <ErrorBoundary screen="delete-account">
      <DeleteAccountScreen />
    </ErrorBoundary>
  );
}
