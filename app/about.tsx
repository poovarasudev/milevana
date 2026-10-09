import { View } from 'react-native';
import { Card, Header, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

export default function About() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="About & privacy" />
      <View style={{ padding: 20 }}>
        <Card>
          <T weight="semi">Milevana v1</T>
          <T color={t.muted} style={{ marginTop: 6, lineHeight: 21 }}>No ads, no analytics, no location. Your data stays on your device until you choose to link Google.</T>
        </Card>
      </View>
    </View>
  );
}
