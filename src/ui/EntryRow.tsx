import type { Entry } from '../domain/types';
import { describe, ENTRY_ICON } from '../features/entryView';
import { Icon, Row, T } from './kit';
import { useTheme } from './theme';

export function EntryRow({ entry, unit }: { entry: Entry; unit: string }) {
  const t = useTheme();
  const d = describe(entry, unit);
  const income = entry.type === 'income';
  return (
    <Row
      icon={entry.pending ? 'cloud-upload-outline' : ENTRY_ICON[entry.type]}
      title={d.title}
      sub={d.sub}
      tint={income ? t.income : entry.type === 'fuel' ? t.primary : t.text}
      soft={income ? t.incomeSoft : entry.type === 'fuel' ? t.primarySoft : t.tile}
      right={<T weight="semi" color={income ? t.income : t.text}>{d.amount}</T>}
    />
  );
}
