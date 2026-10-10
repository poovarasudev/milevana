// About & privacy (FND-SHL-02, FND-OBS-05, REL-11): version, privacy summary
// and links to the public /privacy and /terms pages on the Hosting domain.
// Links open in the browser; offline shows a clear message instead (VD-06).
// Dev builds get a diagnostics row for the Crashlytics smoke checks (AC-F7).

import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { DELETE_ACCOUNT_URL, PRIVACY_URL, TERMS_URL } from '../src/domain/urls';
import { useAppStore } from '../src/features/appStore';
import { adapter } from '../src/features/runtime';
import { reportNonFatal } from '../src/features/reporting';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Button, Card, Header, Row, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

function AboutScreen() {
  const th = useTheme();
  const version = Constants.expoConfig?.version ?? '1';
  const online = useAppStore((s) => s.online);
  const [offlineNotice, setOfflineNotice] = useState(false);

  const openLink = (url: string) => {
    if (!online) {
      setOfflineNotice(true);
      return;
    }
    void Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('about.title')} />
      <View style={{ padding: 20, gap: 16 }}>
        <Card>
          <T weight="semi">{t('about.version', { version })}</T>
          <T color={th.muted} style={{ marginTop: 6, lineHeight: 21 }}>{t('about.body')}</T>
        </Card>
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="shield-check-outline" title={t('about.privacyPolicy')} onPress={() => openLink(PRIVACY_URL)} />
          <Row icon="file-document-outline" title={t('about.terms')} onPress={() => openLink(TERMS_URL)} />
          <Row icon="trash-can-outline" title={t('about.deleteAccount')} onPress={() => openLink(DELETE_ACCOUNT_URL)} />
          {offlineNotice ? (
            <T size={13} color={th.muted} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {t('about.linksOffline')}
            </T>
          ) : null}
        </Card>
        {__DEV__ && adapter().platform === 'native' ? (
          <Card style={{ gap: 10 }}>
            <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2 }}>
              {t('about.devSection').toUpperCase()}
            </T>
            <Button title={t('about.testCrash')} kind="secondary" onPress={() => adapter().testCrash()} />
            <Button
              title={t('about.testNonFatal')}
              kind="secondary"
              onPress={() => reportNonFatal(new Error('test-nonfatal'), { stage: 'manual' })}
            />
          </Card>
        ) : null}
      </View>
    </View>
  );
}

export default function About() {
  return (
    <ErrorBoundary screen="about">
      <AboutScreen />
    </ErrorBoundary>
  );
}
