// Inspection picker (CHK-06): Add → Inspection lists the selected vehicle's
// checklists; picking one opens the run (/entry/inspection?template=<id>).
// With no checklists the user is pointed at Checklists to create or start
// from a starter; archived vehicles cannot run (DR-13).

import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useAppStore } from '../../src/features/appStore';
import { canMutateTemplates } from '../../src/features/checklists';
import { t } from '../../src/i18n';
import { NoVehicle } from '../../src/ui/Empty';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Banner, Button, Card, Header, Row, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

function InspectionPickScreen() {
  const th = useTheme();
  const vehicle = useAppStore((s) =>
    s.vehicles.find((v) => v.id === s.selectedVehicleId));
  const templates = useAppStore((s) =>
    (vehicle && s.templatesVehicleId === vehicle.id ? s.templates : []));
  const arrived = useAppStore((s) =>
    !!vehicle && s.templatesVehicleId === vehicle.id && s.templatesArrived);
  const mutable = canMutateTemplates(vehicle);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('checklists.pickTitle')} subtitle={vehicle?.name} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16 }}>
        {vehicle && !mutable ? (
          <Banner icon="archive-outline" text={t('checklists.archivedRun')} tone="info" />
        ) : null}
        {!vehicle ? (
          <NoVehicle />
        ) : !arrived ? (
          <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />
        ) : templates.length === 0 ? (
          <View style={{ gap: 16 }}>
            <Card>
              <T weight="semi" size={16}>{t('checklists.noChecklistsYet')}</T>
            </Card>
            <Button
              title={t('checklists.title')}
              kind="secondary"
              onPress={() => router.replace('/checklists')}
            />
          </View>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {templates.map((tp) => (
              <Row
                key={tp.id}
                icon="clipboard-check-outline"
                title={tp.name}
                sub={t('checklists.itemCount', { count: tp.items.length })}
                onPress={mutable ? () =>
                  router.push({ pathname: '/entry/[type]', params: { type: 'inspection', template: tp.id } })
                  : undefined}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default function InspectionPick() {
  return (
    <ErrorBoundary screen="inspection-pick">
      <InspectionPickScreen />
    </ErrorBoundary>
  );
}
