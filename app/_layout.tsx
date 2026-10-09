import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, useFonts } from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from '../src/data/store';
import { useTheme } from '../src/ui/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  const hydrated = useStore((s) => s.hydrated);
  const t = useTheme();
  const mode = useStore((s) => s.settings.theme);
  if (!loaded || !hydrated) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style={t.bg === '#0F141B' ? 'light' : mode === 'light' ? 'dark' : 'auto'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="switcher" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="add" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
