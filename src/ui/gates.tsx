// Full-screen gates rendered INSTEAD of the router stack (FND-AUTH-01/02/07):
// Connect (offline first launch or bootstrap failure), web Sign-in, and the
// "Finish moving your data" merge-resume screen. Design: Connect / Link
// conflict frames in docs/design/Milevana-App-v2.dc.html.

import { ActivityIndicator, Linking, View } from 'react-native';
import { AuthError, RepoError } from '../data/adapter';
import { FIREBASE_ENV_VARS } from '../data/firebaseConfig';
import { Button, Card, Icon, T } from './kit';
import { useTheme } from './theme';
import { useAppStore } from '../features/appStore';
import { retryBootstrap } from '../features/session';
import { askDiscardMerge, cancelDiscardMerge, confirmDiscardMerge, resumeMerge, signInWeb } from '../features/auth';
import { reauthenticateForDeletion, runDeletion } from '../features/accountDeletion';
import { PRIVACY_URL, TERMS_URL } from '../domain/urls';
import { t } from '../i18n';
import { useState } from 'react';

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

const LANDING_FEATURES = [
  'fuel', 'expenses', 'trips', 'reminders', 'reports',
  'checklists', 'receipts', 'sharing', 'backup', 'offline',
] as const;

/**
 * Web signed-out visitor (FR-WEB-01) — doubles as the landing page (REL-12,
 * VD-11 provisional content): hero + tagline, the v1 feature list, the
 * sign-in button, privacy/terms links and a Play badge + screenshot
 * placeholders until owner-supplied assets land.
 */
export function SignInGate() {
  const th = useTheme();
  const error = useAppStore((s) => s.signinError);
  const redirecting = useAppStore((s) => s.redirecting);
  return (
    <Center>
      <View style={{ gap: 16, maxHeight: '100%' }}>
        <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
          <T size={26} weight="bold">{t('signin.title')}</T>
          <T size={16} weight="semi" color={th.primary} style={{ textAlign: 'center' }}>
            {t('landing.tagline')}
          </T>
          <T size={14} color={th.muted} style={{ textAlign: 'center' }}>{t('landing.heroBody')}</T>
          {error ? <T size={13} color={th.danger} style={{ textAlign: 'center' }}>{t('signin.error')}</T> : null}
          {redirecting ? <T size={13} color={th.muted}>{t('signin.redirecting')}</T> : null}
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Button
              title={error ? t('common.retry') : t('landing.signin')}
              icon="google"
              onPress={() => void signInWeb()}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <T
              size={13}
              weight="semi"
              color={th.primary}
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            >
              {t('landing.privacy')}
            </T>
            <T
              size={13}
              weight="semi"
              color={th.primary}
              onPress={() => void Linking.openURL(TERMS_URL)}
            >
              {t('landing.terms')}
            </T>
          </View>
        </Card>
        <Card style={{ gap: 10, paddingVertical: 20 }}>
          <T size={13} weight="semi" color={th.muted} style={{ letterSpacing: 1.1 }}>
            {t('landing.featuresTitle').toUpperCase()}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LANDING_FEATURES.map((k) => (
              <View
                key={k}
                style={{ backgroundColor: th.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <T size={12} weight="semi" color={th.primary}>{t(`landing.features.${k}`)}</T>
              </View>
            ))}
          </View>
        </Card>
        <Card style={{ alignItems: 'center', paddingVertical: 18, gap: 8 }}>
          <View style={{ borderWidth: 1, borderColor: th.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' }}>
            <T size={13} weight="bold">{t('landing.playBadge')}</T>
            <T size={11} color={th.muted}>{t('landing.playBadgeSub')}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{ width: 64, height: 128, borderRadius: 10, backgroundColor: th.tile, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <T size={10} color={th.muted} style={{ textAlign: 'center' }}>{t('landing.screenshots')}</T>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Center>
  );
}

/**
 * Unfinished account deletion found at launch (REL-07, VD-07): "Finish
 * deleting your account" — Continue re-signs in with Google and resumes at
 * the next uncompleted step. No cancel once confirmed; offline shows a
 * waiting state and a failure offers Retry (re-running Continue).
 */
export function DeletionResumeGate() {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const step = useAppStore((s) => s.deletionStep);
  const user = useAppStore((s) => s.user);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<'generic' | 'wrong-account' | null>(null);

  const resume = async () => {
    setFailed(null);
    setRunning(true);
    try {
      // Linked accounts need a fresh Google login before the account step;
      // anonymous sessions just continue.
      if (user && !user.isAnonymous) await reauthenticateForDeletion();
      await runDeletion();
    } catch (e) {
      setFailed(
        e instanceof AuthError && e.code === 'user-mismatch'
          ? 'wrong-account'
          : e instanceof RepoError && (e.code === 'unavailable' || e.code === 'offline')
            ? null
            : 'generic',
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <Center>
      <Card style={{ paddingVertical: 28, gap: 14 }}>
        <T size={18} weight="semi">{t('deletion.resumeTitle')}</T>
        <T size={14} color={th.muted}>{t('deletion.resumeBody')}</T>
        {running || step ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={th.primary} />
            <T size={13} color={th.muted}>
              {step ? t(`deletion.step.${step}`) : t('deletion.running')}
            </T>
          </View>
        ) : null}
        {!online ? <T size={13} color={th.muted}>{t('deletion.waiting')}</T> : null}
        {failed === 'wrong-account' ? (
          <T size={13} color={th.danger}>{t('deletion.wrongAccount', { email: user?.email ?? '' })}</T>
        ) : failed === 'generic' ? (
          <T size={13} color={th.danger}>{t('deletion.resumeFailed')}</T>
        ) : null}
        <Button
          title={failed === 'generic' ? t('common.retry') : t('deletion.resumeAction')}
          disabled={running || !online}
          onPress={() => void resume()}
        />
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
