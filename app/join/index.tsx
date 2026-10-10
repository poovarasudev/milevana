// Join by typed code (SHR-08): the entry point from More → Join a vehicle.
// The code normalizes case/hyphens/spaces (SD-02) and hands off to the join
// screen at /join/<code> — the same route an invite link opens.

import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { looksLikeCode, normalizeCode } from '../../src/domain/invites';
import { t } from '../../src/i18n';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Button, Field, Header } from '../../src/ui/kit';
import { KEYBOARD_BEHAVIOR } from '../../src/ui/platform';
import { useTheme } from '../../src/ui/theme';

function JoinEntryScreen() {
  const th = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const c = normalizeCode(code);
    if (!looksLikeCode(c)) {
      setError(t('join.needCode'));
      return;
    }
    router.push({ pathname: '/join/[code]', params: { code: c } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: th.bg }} behavior={KEYBOARD_BEHAVIOR}>
      <Header title={t('join.title')} />
      <View style={{ padding: 20, gap: 16 }}>
        <Field
          label={t('join.codeLabel')}
          value={code}
          onChangeText={(v) => { setCode(v); setError(null); }}
          placeholder={t('join.codePlaceholder')}
          autoCapitalize="characters"
          autoCorrect={false}
          error={error ?? undefined}
        />
        <Button title={t('join.continue')} onPress={submit} disabled={!code.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

export default function JoinEntry() {
  return (
    <ErrorBoundary screen="join">
      <JoinEntryScreen />
    </ErrorBoundary>
  );
}
