import { View } from 'react-native';
import { Card, Header, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

export default function Account() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Account" />
      <View style={{ padding: 20 }}>
        <Card>
          <T weight="semi" size={17}>Guest</T>
          <T color={t.muted} style={{ marginTop: 6, lineHeight: 21 }}>
            Your data is stored on this phone only. Linking a Google account, backup and the account-conflict flow arrive with the Firebase auth work (FND-AUTH-03 to 07).
          </T>
        </Card>
      </View>
    </View>
  );
}
