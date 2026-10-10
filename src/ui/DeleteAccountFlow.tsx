// Shared delete-account flow (REL-06/08/09): summary with per-vehicle handoff
// choices → Google re-sign-in → typed DELETE → engine run → completion text.
// The same component backs the Android Account → Delete account screen and the
// web /delete-account route (VD-09). Anonymous users get the "Delete all my
// data" variant with the stated warning and no Google re-auth (VD-08).

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { AuthError } from '../data/adapter';
import { isDriveGranted } from '../features/driveAccess';
import {
  buildMyDeletionPlan, DeletionPlan, loadDeletionRecord, reauthenticateForDeletion, runDeletion,
} from '../features/accountDeletion';
import { useAppStore } from '../features/appStore';
import { adapter } from '../features/runtime';
import { t } from '../i18n';
import { Button, Card, Field, Label, T } from './kit';
import { Picker } from './Picker';
import { useTheme } from './theme';

const DELETE_PICK = '__delete__';

type Stage = 'loading' | 'summary' | 'confirm' | 'running' | 'done' | 'error';

function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function DeleteAccountFlow() {
  const th = useTheme();
  const user = useAppStore((s) => s.user);
  const userDoc = useAppStore((s) => s.userDoc);
  const online = useAppStore((s) => s.online);
  const step = useAppStore((s) => s.deletionStep);
  const anonymous = user?.isAnonymous ?? true;

  const [stage, setStage] = useState<Stage>('loading');
  const [plan, setPlan] = useState<DeletionPlan | null>(null);
  // Shared owned vehicle → chosen new owner uid; absent = delete the vehicle.
  const [handoffs, setHandoffs] = useState<Record<string, string>>({});
  const [confirmText, setConfirmText] = useState('');
  const [reauthed, setReauthed] = useState(false);
  const [error, setError] = useState<'generic' | 'wrong-account' | null>(null);
  const [driveGranted, setDriveGranted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const p = await buildMyDeletionPlan();
        if (!alive) return;
        setPlan(p);
        // Defaults: every shared vehicle hands off to its longest-standing
        // member (VD-05); the user can switch to another member or delete.
        const defaults: Record<string, string> = {};
        for (const h of p.handoffs) defaults[h.vehicle.id] = h.candidates[0]!.uid;
        setHandoffs(defaults);
        setStage('summary');
      } catch {
        if (alive) { setError('generic'); setStage('error'); }
      }
      if (user) setDriveGranted(await isDriveGranted(user.uid));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    if (!plan) return null;
    const deletes = [...plan.deletes.map((v) => v.name)];
    const hand = plan.handoffs.filter((h) => handoffs[h.vehicle.id]);
    const handDeletes = plan.handoffs.filter((h) => !handoffs[h.vehicle.id]).map((h) => h.vehicle.name);
    return {
      deleteNames: [...deletes, ...handDeletes],
      handCount: hand.length,
      leaveNames: plan.leaves.map((v) => v.name),
      empty: deletes.length + handDeletes.length + hand.length + plan.leaves.length === 0,
    };
  }, [plan, handoffs]);

  const doReauth = async () => {
    setError(null);
    setBusy(true);
    try {
      await reauthenticateForDeletion();
      setReauthed(true);
    } catch (e) {
      setError(e instanceof AuthError && e.code === 'user-mismatch' ? 'wrong-account' : 'generic');
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setError(null);
    setStage('running');
    try {
      // A stored record resumes whatever is left (REL-07); only a truly fresh
      // run writes the confirmed choices into the record first.
      const existing = user ? await loadDeletionRecord(user.uid) : null;
      await runDeletion(existing
        ? undefined
        : {
            handoffs,
            deletes: plan?.handoffs.filter((h) => !handoffs[h.vehicle.id]).map((h) => h.vehicle.id),
          });
      setStage('done');
    } catch {
      setError('generic');
      setStage('error');
    }
  };

  if (stage === 'loading') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
        <ActivityIndicator color={th.primary} size="large" />
        <T size={13} color={th.muted}>{t('deletion.loading')}</T>
      </View>
    );
  }

  if (stage === 'running') {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 12 }}>
        <ActivityIndicator color={th.primary} size="large" />
        <T weight="semi">{t('deletion.running')}</T>
        {step ? <T size={13} color={th.muted}>{t(`deletion.step.${step}`)}</T> : null}
      </Card>
    );
  }

  if (stage === 'done') {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 12 }}>
        <T size={17} weight="semi" style={{ textAlign: 'center' }}>{t('deletion.done')}</T>
      </Card>
    );
  }

  if (stage === 'error') {
    return (
      <Card style={{ gap: 12 }}>
        <T weight="semi" color={th.danger}>{t('deletion.failed')}</T>
        <Button title={t('common.retry')} onPress={() => void start()} />
        {!online ? <T size={13} color={th.muted}>{t('deletion.offline')}</T> : null}
      </Card>
    );
  }

  // Anonymous variant (VD-08): warning + confirm; no Google re-auth, no typed
  // DELETE — there is no Google account to verify against. On the web route
  // anonymous users get no deletion at all — only the instruction to delete
  // from the app (SC-REL08-03).
  if (anonymous) {
    const empty = summary?.empty ?? false;
    return (
      <Card style={{ gap: 12 }}>
        {adapter().platform === 'web' ? (
          <T size={14} color={th.muted} style={{ lineHeight: 21 }}>{t('deletion.webAnon')}</T>
        ) : empty ? (
          <T size={14} color={th.muted}>{t('deletion.empty')}</T>
        ) : (
          <>
            <T size={14} color={th.muted} style={{ lineHeight: 21 }}>{t('deletion.anonWarning')}</T>
            <Button
              title={t('deletion.anonAction')}
              kind="danger"
              disabled={!online}
              onPress={() => void start()}
            />
            {!online ? <T size={13} color={th.muted}>{t('deletion.offline')}</T> : null}
          </>
        )}
      </Card>
    );
  }

  if (stage === 'summary') {
    if (summary?.empty) {
      return (
        <Card style={{ gap: 10 }}>
          <T size={14} color={th.muted} style={{ lineHeight: 21 }}>{t('deletion.empty')}</T>
        </Card>
      );
    }
    const rootFolderId = userDoc?.drive?.rootFolderId;
    return (
      <View style={{ gap: 16 }}>
        <Card style={{ gap: 14 }}>
          <Label>{t('deletion.summaryTitle').toUpperCase()}</Label>
          {summary && summary.deleteNames.length > 0 && (
            <View style={{ gap: 4 }}>
              <Label>{t('deletion.deleteSection')}</Label>
              <T size={13} color={th.muted}>{t('deletion.deleteSectionHint', { count: summary.deleteNames.length })}</T>
              {summary.deleteNames.map((n) => <T key={n} size={14}>· {n}</T>)}
            </View>
          )}
          {plan!.handoffs.length > 0 && (
            <View style={{ gap: 8 }}>
              <Label>{t('deletion.handoffSection')}</Label>
              {plan!.handoffs.map((h) => (
                <Picker
                  key={h.vehicle.id}
                  label={h.vehicle.name.toUpperCase()}
                  valueLabel={
                    handoffs[h.vehicle.id]
                      ? t('deletion.handoffTo', { name: h.candidates.find((c) => c.uid === handoffs[h.vehicle.id])?.name ?? '' })
                      : t('deletion.deleteInstead')
                  }
                  options={[
                    ...h.candidates.map((c) => ({ value: c.uid, label: t('deletion.handoffTo', { name: c.name || c.uid }) })),
                    { value: DELETE_PICK, label: t('deletion.deleteInstead') },
                  ]}
                  onPick={(v) => setHandoffs((cur) => {
                    const next = { ...cur };
                    if (v === DELETE_PICK) delete next[h.vehicle.id];
                    else next[h.vehicle.id] = v;
                    return next;
                  })}
                />
              ))}
            </View>
          )}
          {summary && summary.leaveNames.length > 0 && (
            <View style={{ gap: 4 }}>
              <Label>{t('deletion.leaveSection')}</Label>
              {summary.leaveNames.map((n) => <T key={n} size={14}>· {n}</T>)}
              <T size={12} color={th.muted}>{t('deletion.leaveHint')}</T>
            </View>
          )}
          <View style={{ gap: 4 }}>
            <Label>{t('deletion.keptSection')}</Label>
            <T size={12} color={th.muted} style={{ lineHeight: 18 }}>{t('deletion.keptBody')}</T>
            {rootFolderId && driveGranted ? (
              <T
                size={13}
                weight="semi"
                color={th.primary}
                onPress={() => void Linking.openURL(driveFolderUrl(rootFolderId))}
              >
                {t('deletion.driveFolder')}
              </T>
            ) : null}
          </View>
        </Card>
        <Button title={t('deletion.backupFirst')} kind="secondary" onPress={() => router.push('/backup-export')} />
        <Button title={t('deletion.continue')} disabled={!online} onPress={() => setStage('confirm')} />
        {!online ? <T size={13} color={th.muted} style={{ textAlign: 'center' }}>{t('deletion.offline')}</T> : null}
      </View>
    );
  }

  // confirm
  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 12 }}>
        <T weight="semi" size={17}>{t('deletion.confirmTitle')}</T>
        <T size={14} color={th.muted} style={{ lineHeight: 21 }}>{t('deletion.confirmBody')}</T>
        {!reauthed ? (
          <Button
            title={t('deletion.reauth')}
            icon="google"
            disabled={busy || !online}
            onPress={() => void doReauth()}
          />
        ) : (
          <>
            <Field
              label={t('deletion.typeDelete')}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Button
              title={t('deletion.confirmAction')}
              kind="danger"
              disabled={confirmText !== 'DELETE' || !online}
              onPress={() => void start()}
            />
          </>
        )}
        {error === 'wrong-account' ? (
          <T size={13} color={th.danger}>{t('deletion.wrongAccount', { email: user?.email ?? '' })}</T>
        ) : error ? (
          <T size={13} color={th.danger}>{t('deletion.failed')}</T>
        ) : null}
        {!online ? <T size={13} color={th.muted}>{t('deletion.offline')}</T> : null}
      </Card>
    </View>
  );
}
