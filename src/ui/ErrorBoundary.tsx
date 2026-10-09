// Per-screen error boundary (FND-OBS-01, FR-ERR-02): a render failure shows
// "Something went wrong" + Retry inside that screen only — other tabs keep
// working. Native reports a privacy-safe non-fatal; web does nothing (OQ-10).

import { Component, Fragment, ReactNode } from 'react';
import { View } from 'react-native';
import { reportNonFatal } from '../features/reporting';
import { Button, T } from './kit';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
  /** Identifies the screen in the report (safe value). */
  screen?: string;
}

interface State {
  failed: boolean;
  attempt: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    reportNonFatal(error, { stage: 'render', screen: this.props.screen });
  }

  render(): ReactNode {
    // `key` forces a clean re-mount of the subtree after Retry (SC-OBS01-02).
    if (!this.state.failed) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <T size={17} weight="semi">{t('boundary.title')}</T>
        <T size={13} style={{ textAlign: 'center' }}>{t('boundary.body')}</T>
        <View style={{ minWidth: 140 }}>
          <Button
            title={t('boundary.retry')}
            onPress={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
          />
        </View>
      </View>
    );
  }
}

/** Wrap a screen so its render errors are contained (and Retry re-mounts). */
export function withBoundary(node: ReactNode, screen: string): ReactNode {
  return <ErrorBoundary screen={screen}>{node}</ErrorBoundary>;
}
