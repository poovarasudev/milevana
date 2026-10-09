// In-screen notice banners (FND-OBS-02/03): web offline, quota pause, access
// lost, owner-side watch failure and skipped malformed documents. Sensitive
// fields never appear — notices carry counts and doc kinds only (DR-16).

import { View } from 'react-native';
import { Banner } from './kit';
import { useAppStore } from '../features/appStore';
import { adapter } from '../features/runtime';
import { refreshSession } from '../features/session';
import { t } from '../i18n';

function isWeb(): boolean {
  try {
    return adapter().platform === 'web';
  } catch {
    return false;
  }
}

export function Notices() {
  const online = useAppStore((s) => s.online);
  const quotaPaused = useAppStore((s) => s.quotaPaused);
  const accessLost = useAppStore((s) => s.accessLost);
  const ownerError = useAppStore((s) => s.ownerError);
  const skipped = useAppStore((s) => s.skippedDocs);
  const web = isWeb();

  // group skipped docs by kind for "2 entries couldn't be shown"
  const byKind = new Map<string, number>();
  for (const d of skipped) byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);

  return (
    <View>
      {web && !online ? <Banner icon="wifi-off" text={t('notices.offline')} /> : null}
      {quotaPaused ? (
        <Banner
          icon="sync-off"
          text={web ? t('notices.serviceBusy') : t('notices.quotaPaused')}
          tone="warn"
        />
      ) : null}
      {accessLost ? (
        <Banner
          icon="account-off"
          text={t('notices.accessLost')}
          action={t('common.done')}
          onAction={() => useAppStore.setState({ accessLost: false })}
        />
      ) : null}
      {ownerError ? (
        <Banner
          icon="alert-circle"
          text={t('notices.ownerError')}
          action={t('common.retry')}
          onAction={() => {
            useAppStore.setState({ ownerError: false });
            refreshSession();
          }}
        />
      ) : null}
      {[...byKind.entries()].map(([kind, count]) => (
        <Banner
          key={kind}
          icon="file-remove"
          tone="info"
          text={t('notices.skipped', { count, kind: t(`notices.kindName.${kind}`) })}
        />
      ))}
    </View>
  );
}
