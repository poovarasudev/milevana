// About & privacy (FND-SHL-02, FND-OBS-05): privacy summary; dev builds get a
// diagnostics row for the Crashlytics smoke checks (AC-F7).

import { View } from 'react-native';
import Constants from 'expo-constants';
import { adapter } from '../src/features/runtime';
import { reportNonFatal } from '../src/features/reporting';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Button, Card, Header, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

function AboutScreen() {
  const th = useTheme();
  const version = Constants.expoConfig?.version ?? '1';
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('about.title')} />
      <View style={{ padding: 20, gap: 16 }}>
        <Card>
          <T weight="semi">{t('about.version', { version })}</T>
          <T color={th.muted} style={{ marginTop: 6, lineHeight: 21 }}>{t('about.body')}</T>
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
