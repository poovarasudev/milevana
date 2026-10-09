// Full-screen gates rendered INSTEAD of the router stack (FND-AUTH-01/02/07):
// Connect (offline first launch or bootstrap failure), web Sign-in, and the
// "Finish moving your data" merge-resume screen. Design: Connect / Link
// conflict frames in docs/design/Milevana-App-v2.dc.html.

import { ActivityIndicator, View } from 'react-native';
import { FIREBASE_ENV_VARS } from '../data/firebaseConfig';
import { Button, Card, Icon, T } from './kit';
import { useTheme } from './theme';
import { useAppStore } from '../features/appStore';
import { retryBootstrap } from '../features/session';
import { askDiscardMerge, cancelDiscardMerge, confirmDiscardMerge, resumeMerge, signInWeb } from '../features/auth';
import { t } from '../i18n';

function Center({ children }: { children: React.ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 420 }}>{children}</View>
    </View>
  );
}

/** Offline first launch / bootstrap failure (auto-retries in the background). */
export function ConnectGate() {
  const th = useTheme();
  const failed = useAppStore((s) => s.phase === 'error');
  return (
    <Center>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 12, width: '100%' }}>
          <T size={20} weight="semi" style={{ textAlign: 'center' }}>
            {failed ? t('connect.errorTitle') : t('connect.title')}
          </T>
          <T size={14} color={th.muted} style={{ textAlign: 'center' }}>
            {failed ? t('connect.errorBody') : t('connect.body')}
          </T>
          {!failed && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={th.primary} />
              <T size={13} color={th.muted}>{t('connect.retrying')}</T>
            </View>
          )}
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Button
              title={failed ? t('common.retry') : t('connect.tryNow')}
              onPress={() => retryBootstrap()}
            />
          </View>
        </Card>
      </View>
    </Center>
  );
}

/**
 * Firebase env config missing or invalid (EXPO_PUBLIC_FIREBASE_*). Named
 * variables plus the runbook pointer — replaces the old blank white page.
 */
export function ConfigGate() {
  const th = useTheme();
  const missing = useAppStore((s) => s.configMissingVars);
  const vars = missing.length > 0 ? missing : FIREBASE_ENV_VARS;
  return (
    <Center>
      <Card style={{ paddingVertical: 28, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="wrench-outline" color={th.danger} />
          <T size={20} weight="semi">{t('config.title')}</T>
        </View>
        <T size={14} color={th.muted}>
          {missing.length > 0 ? t('config.missing') : t('config.invalid')}
        </T>
        <View style={{ gap: 4 }}>
          {vars.map((v) => (
            <T key={v} size={13} weight="semi" color={th.danger} style={{ fontFamily: undefined, fontVariant: ['tabular-nums'] }}>
              {v}
            </T>
          ))}
        </View>
        <T size={13} color={th.muted}>{t('config.docs')}</T>
      </Card>
    </Center>
  );
}

/** Web signed-out visitor (FR-WEB-01). */
export function SignInGate() {
  const th = useTheme();
  const error = useAppStore((s) => s.signinError);
  const redirecting = useAppStore((s) => s.redirecting);
  return (
    <Center>
      <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
        <T size={26} weight="bold">{t('signin.title')}</T>
        <T size={14} color={th.muted} style={{ textAlign: 'center' }}>{t('signin.body')}</T>
        {error ? <T size={13} color={th.danger} style={{ textAlign: 'center' }}>{t('signin.error')}</T> : null}
        {redirecting ? <T size={13} color={th.muted}>{t('signin.redirecting')}</T> : null}
        <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <Button
            title={error ? t('common.retry') : t('signin.button')}
            icon="google"
            onPress={() => void signInWeb()}
          />
        </View>
      </Card>
    </Center>
  );
}

/** Stored merge data found at launch — before normal navigation (AUTH-07). */
export function MergeResumeGate() {
  const th = useTheme();
  const merge = useAppStore((s) => s.merge);
  return (
    <Center>
      <Card style={{ paddingVertical: 28, gap: 14 }}>
        {merge.confirmDiscard ? (
          <>
            <T size={18} weight="semi">{t('merge.discardTitle')}</T>
            <T size={14} color={th.muted}>{t('merge.discardBody')}</T>
            <Button title={t('common.discard')} kind="danger" onPress={() => void confirmDiscardMerge()} />
            <Button title={t('common.keep')} kind="secondary" onPress={cancelDiscardMerge} />
          </>
        ) : (
          <>
            <T size={18} weight="semi">
              {merge.status === 'failed' ? t('merge.failed') : t('merge.resumeTitle')}
            </T>
            <T size={14} color={th.muted}>{t('merge.resumeBody')}</T>
            {merge.status === 'moving' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={th.primary} />
                <T size={13} color={th.muted}>{t('merge.moving')}</T>
              </View>
            ) : (
              <>
                <Button title={t('common.retry')} onPress={() => void resumeMerge()} />
                <Button title={t('common.discard')} kind="text" onPress={askDiscardMerge} />
              </>
            )}
          </>
        )}
      </Card>
    </Center>
  );
}
