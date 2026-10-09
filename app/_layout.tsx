// Root layout (FND-AUTH-01/02, FND-SHL-02): starts the session lifecycle once,
// shows the phase gates instead of the router until the app is ready, and
// mounts the modal overlays (link prompt, conflict, merge, sign-out, sync
// issues) over the stack.

import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, useFonts } from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '../src/features/appStore';
import { startSession } from '../src/features/session';
import { initI18n } from '../src/i18n';
import { ConnectGate, MergeResumeGate, SignInGate } from '../src/ui/gates';
import {
  ConflictOverlay, LinkPromptOverlay, MergeOverlay, SignOutOverlay, SyncIssuesOverlay,
} from '../src/ui/overlays';
import { Shell } from '../src/ui/Shell';
import { usePaperTheme, useTheme } from '../src/ui/theme';

initI18n();

export default function RootLayout() {
  const [loaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  const t = useTheme();
  const paper = usePaperTheme();
  const phase = useAppStore((s) => s.phase);
  const mode = useAppStore((s) => s.userDoc?.settings.theme);

  useEffect(() => startSession(), []);

  const gate =
    !loaded || phase === 'booting' ? 'booting'
    : phase === 'connect' || phase === 'error' ? 'connect'
    : phase === 'signin' ? 'signin'
    : phase === 'merge-resume' ? 'merge'
    : 'ready';

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paper}>
        <StatusBar style={t.bg === '#0F141B' ? 'light' : mode === 'light' ? 'dark' : 'auto'} />
        <Shell>
          {gate === 'booting' && <View style={{ flex: 1, backgroundColor: t.bg }} />}
          {gate === 'connect' && <ConnectGate />}
          {gate === 'signin' && <SignInGate />}
          {gate === 'merge' && <MergeResumeGate />}
          {gate === 'ready' && (
            <View style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
                <Stack.Screen name="switcher" options={{ presentation: 'transparentModal', animation: 'fade' }} />
                <Stack.Screen name="add" options={{ presentation: 'transparentModal', animation: 'fade' }} />
              </Stack>
              <LinkPromptOverlay />
              <ConflictOverlay />
              <MergeOverlay />
              <SignOutOverlay />
              <SyncIssuesOverlay />
            </View>
          )}
        </Shell>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
