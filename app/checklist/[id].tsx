// Template editor route (CHK-04): `/checklist/new` creates; `/checklist/<id>`
// edits. The 20-per-vehicle cap and the name rules are enforced by the
// feature layer; delete is creator-or-owner and confirms first.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { RepoError } from '../../src/data/adapter';
import { useAppStore } from '../../src/features/appStore';
import { createTemplate, deleteTemplate, updateTemplate } from '../../src/features/checklists';
import { reportNonFatal } from '../../src/features/reporting';
import { t } from '../../src/i18n';
import { ConfirmSheet } from '../../src/ui/ConfirmSheet';
import { DialogFrame } from '../../src/ui/DialogFrame';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Header, T } from '../../src/ui/kit';
import { TemplateForm } from '../../src/ui/TemplateForm';
import { useTheme } from '../../src/ui/theme';

function TemplateScreen() {
  const th = useTheme();
  const params = useLocalSearchParams<{ id: string; vehicle?: string }>();
  const isNew = params.id === 'new';
  const vehicle = useAppStore((s) =>
    s.vehicles.find((v) => v.id === (params.vehicle ?? s.selectedVehicleId)));
  const templates = useAppStore((s) => (s.templatesVehicleId === vehicle?.id ? s.templates : []));
  const arrived = useAppStore((s) => s.templatesVehicleId === vehicle?.id && s.templatesArrived);
  const template = !isNew ? templates.find((tp) => tp.id === params.id) : undefined;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (input: { name: string; items: { id: string; label: string; group?: string }[] }) => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      if (template) {
        await updateTemplate(vehicle.id, template.id, input);
      } else {
        await createTemplate(vehicle.id, input);
      }
      router.back();
    } catch (e) {
      if (e instanceof RepoError && e.message === 'template-limit') {
        setError(t('checklists.limitReached'));
      } else if (e instanceof RepoError && e.message === 'name-taken') {
        setError(t('checklists.nameTaken'));
      } else {
        reportNonFatal(e, { stage: 'template-save' });
        setError(t('vehicleForm.saveFailed'));
      }
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!vehicle || !template) return;
    setConfirmDelete(false);
    setSaving(true);
    try {
      await deleteTemplate(vehicle.id, template.id);
      router.back();
    } catch (e) {
      reportNonFatal(e, { stage: 'template-delete', id: template.id });
      setError(t('vehicleForm.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <DialogFrame>
        <Header
          title={isNew ? t('checklists.newTemplate') : t('checklists.editTemplate')}
          subtitle={vehicle?.name}
        />
        {!vehicle ? (
          <T color={th.muted} style={{ padding: 20 }}>{t('addSheet.chooseVehicle')}</T>
        ) : !isNew && !template ? (
          arrived ? (
            <T color={th.muted} style={{ padding: 20 }}>{t('entryForm.notFound')}</T>
          ) : (
            <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />
          )
        ) : (
          <TemplateForm
            key={template?.id ?? 'new'}
            vehicle={vehicle}
            template={template}
            saving={saving}
            saveError={error}
            onSubmit={(v) => void submit(v)}
            onDelete={template ? () => setConfirmDelete(true) : undefined}
          />
        )}
      </DialogFrame>
      {confirmDelete && template ? (
        <ConfirmSheet
          title={t('checklists.deleteTemplate')}
          body={t('checklists.deleteTemplateBody', { name: template.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </View>
  );
}

export default function TemplateRoute() {
  return (
    <ErrorBoundary screen="template-form">
      <TemplateScreen />
    </ErrorBoundary>
  );
}
