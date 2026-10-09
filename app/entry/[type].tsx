// Entry placeholder (FND-SHL-02, AC-D15): the Add sheet routes here; the real
// forms arrive with the logging tab.

import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ENTRY_TYPES } from '../../src/data/schema/common';
import { t } from '../../src/i18n';
import { Card, Header, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

export default function EntryPlaceholder() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const th = useTheme();
  const kind = (ENTRY_TYPES as readonly string[]).includes(type ?? '') ? type! : 'expense';
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t(`entryTypes.${kind}`)} />
      <View style={{ padding: 20 }}>
        <Card>
          <T weight="semi" size={17}>{t('common.comingSoon')}</T>
          <T color={th.muted} style={{ marginTop: 6, lineHeight: 21 }}>{t('entryPlaceholder.body')}</T>
        </Card>
      </View>
    </View>
  );
}
