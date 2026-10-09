// Entry form dispatcher (LOG-04): picks the per-type form and applies the
// shared read-only rules — archived vehicles (DR-13) and other members'
// entries (LD-13) render read-only. Inspection stays a placeholder until its
// own sub-project.

import { useMemo } from 'react';
import { View } from 'react-native';
import { canEditEntry, canDeleteEntry } from '../../features/entries';
import { useAppStore } from '../../features/appStore';
import { t } from '../../i18n';
import { Card, T } from '../kit';
import { useTheme } from '../theme';
import { FuelForm } from './FuelForm';
import { MoneyForm } from './MoneyForm';
import { ServiceForm } from './ServiceForm';
import { TripForm } from './TripForm';
import type { EntryFormProps } from './types';

export function EntryForm(props: Omit<EntryFormProps, 'readOnly'> & { type: string }) {
  const th = useTheme();
  const { vehicle, type, entry } = props;
  const uid = useAppStore((s) => s.user?.uid);

  const readOnly = useMemo(() => {
    if (vehicle.archived) return true;
    if (entry) return !canEditEntry(entry, vehicle, uid);
    return false;
  }, [vehicle, entry, uid]);

  const deletable =
    !!entry && canDeleteEntry(entry, vehicle, uid);

  const formProps: EntryFormProps = { ...props, readOnly, onDelete: deletable ? props.onDelete : undefined };

  switch (type) {
    case 'fuel':
      return <FuelForm {...formProps} />;
    case 'expense':
      return <MoneyForm kind="expense" {...formProps} />;
    case 'income':
      return <MoneyForm kind="income" {...formProps} />;
    case 'service':
      return <ServiceForm {...formProps} />;
    case 'trip':
      return <TripForm {...formProps} />;
    default:
      // inspection — still a placeholder (out of scope for Logging)
      return (
        <View style={{ padding: 20 }}>
          <Card>
            <T weight="semi" size={17}>{t('common.comingSoon')}</T>
            <T color={th.muted} style={{ marginTop: 6, lineHeight: 21 }}>{t('entryPlaceholder.body')}</T>
          </Card>
        </View>
      );
  }
}
