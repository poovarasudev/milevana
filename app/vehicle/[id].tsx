// Edit / manage a vehicle (FND-VEH-02..04): all fields editable while no
// entries exist; unit/currency/start odometer lock afterwards (DR-01);
// archived vehicles are read-only until unarchived (DR-13). Delete requires
// the typed name (DR-14) and warns with the member count when shared.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { RepoError } from '../../src/data/adapter';
import { useAppStore } from '../../src/features/appStore';
import { displayOdometer, useSettings } from '../../src/features/format';
import { setVehicleMuted } from '../../src/features/reminders';
import { adapter, getRepos } from '../../src/features/runtime';
import { reportNonFatal } from '../../src/features/reporting';
import {
  archiveVehicle, changeVehicleUnits, deleteVehicle, unarchiveVehicle, updateVehicle,
} from '../../src/features/vehicleActions';
import { t } from '../../src/i18n';
import { DialogFrame } from '../../src/ui/DialogFrame';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Button, Card, Header, Icon, T } from '../../src/ui/kit';
import { ToggleRow } from '../../src/ui/entry/fields';
import { KEYBOARD_BEHAVIOR } from '../../src/ui/platform';
import { useTheme, font } from '../../src/ui/theme';
import {
  toVehicleInput, valuesFromVehicle, VehicleForm, VehicleFormValues,
} from '../../src/ui/VehicleForm';

function DeleteDialog({ vehicleName, members, onClose, onConfirm, deleting, error, offlineBlocked }: {
  vehicleName: string; members: number; onClose: () => void;
  onConfirm: () => void; deleting: boolean; error: boolean; offlineBlocked: boolean;
}) {
  const th = useTheme();
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === vehicleName.trim().toLowerCase();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 420, gap: 14 }}>
          <T size={18} weight="semi">{t('deleteVehicle.title', { name: vehicleName })}</T>
          <T size={14} color={th.muted}>{t('deleteVehicle.body')}</T>
          {members > 1 ? <T size={14} color={th.danger}>{t('deleteVehicle.shared', { count: members - 1 })}</T> : null}
          <TextInput
            accessibilityLabel={t('deleteVehicle.typeName', { name: vehicleName })}
            placeholder={t('deleteVehicle.typeName', { name: vehicleName })}
            placeholderTextColor={th.muted}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            style={{
              borderWidth: 1, borderColor: matches ? th.primary : th.border, borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 12, fontFamily: font.semi, fontSize: 15, color: th.text,
            }}
          />
          {error ? <T size={13} color={th.danger}>{t('deleteVehicle.failed', { name: vehicleName })}</T> : null}
          {offlineBlocked ? <T size={13} color={th.muted}>{t('deleteVehicle.offlineBlocked')}</T> : null}
          <Button
            title={t('deleteVehicle.confirm')}
            kind="danger"
            disabled={!matches || deleting || offlineBlocked}
            onPress={onConfirm}
          />
          <Button title={t('common.cancel')} kind="text" onPress={onClose} />
        </Card>
      </View>
    </Modal>
  );
}

function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const th = useTheme();
  const settings = useSettings();
  const vehicle = useAppStore((s) => s.vehicles.find((v) => v.id === id));
  const online = useAppStore((s) => s.online);
  const uid = useAppStore((s) => s.user?.uid);
  const deleteFailed = useAppStore((s) => s.deleteFailedIds.includes(id ?? ''));
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const isOwner = !!vehicle && vehicle.ownerId === uid;
  const web = adapter().platform === 'web';
  const muted = useAppStore((s) =>
    !!s.userDoc?.settings.mutedReminderVehicleIds?.includes(id ?? ''));

  useEffect(() => {
    let live = true;
    if (id) {
      getRepos().entries.hasEntries(id).then((n) => {
        if (live) setHasEntries(n);
      }).catch(() => { if (live) setHasEntries(false); });
    }
    return () => { live = false; };
  }, [id]);

  if (!vehicle) {
    return (
      <View style={{ flex: 1, backgroundColor: th.bg }}>
        <Header title={t('vehicles.title')} />
      </View>
    );
  }

  const locked = hasEntries !== false; // until the check lands, treat as locked
  const archived = vehicle.archived;

  const onSubmit = async (v: VehicleFormValues) => {
    setSaving(true);
    setError(null);
    try {
      const input = toVehicleInput(v);
      await updateVehicle(vehicle.id, {
        name: input.name, color: input.color, fuelTypes: input.fuelTypes,
        make: input.make, model: input.model, year: input.year, plate: input.plate,
      });
      if (!hasEntries) {
        await changeVehicleUnits(vehicle.id, {
          odometerUnit: input.odometerUnit,
          currency: input.currency,
          startOdometer: input.startOdometer,
        });
      }
      router.back();
    } catch (e) {
      if (e instanceof RepoError && e.message === 'name-taken') setError(t('vehicleForm.nameTaken'));
      else {
        reportNonFatal(e, { stage: 'vehicle-update', id: vehicle.id });
        setError(t('vehicleForm.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteVehicle(vehicle.id);
      setConfirmDelete(false);
      router.back();
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: th.bg }} behavior={KEYBOARD_BEHAVIOR}>
      <DialogFrame>
        <Header title={archived ? t('vehicleDetail.status') : t('vehicleForm.editTitle')} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {archived ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 10 }}>
              <Card>
                <T size={13} color={th.muted}>{t('vehicleForm.archivedReadonly')}</T>
              </Card>
              {/* PD-08: an archived vehicle keeps its single-vehicle report */}
              <Button
                title={t('reports.viewReports')}
                kind="secondary"
                icon="chart-box-outline"
                onPress={() => router.push({ pathname: '/(tabs)/reports', params: { vehicle: vehicle.id } })}
              />
            </View>
          ) : null}
          {deleteFailed ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Card style={{ borderColor: th.danger, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="alert-circle" color={th.danger} size={20} />
                <T size={13} weight="semi" color={th.danger} style={{ flex: 1 }}>{t('vehicles.deleteBadge')}</T>
                <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
                  <T size={13} weight="bold" color={th.primary}>{t('common.retry')}</T>
                </Pressable>
              </Card>
            </View>
          ) : null}
          <VehicleForm
            key={vehicle.id}
            initial={valuesFromVehicle(vehicle)}
            locked={locked || archived}
            saving={saving}
            error={error}
            onSubmit={(v) => void onSubmit(v)}
            submitLabel={t('vehicleForm.saveEdits')}
          />
          {/* REM-09: mute is per user, on the vehicle's settings (RD-07) —
              every member sees it, not just the owner. */}
          {!archived ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <Card>
                <ToggleRow
                  label={t('reminders.mute')}
                  value={muted}
                  onValueChange={(v) => void setVehicleMuted(vehicle.id, v)}
                />
                <T size={12} color={th.muted} style={{ marginTop: -12 }}>{t('reminders.muteSub')}</T>
              </Card>
            </View>
          ) : null}
          {isOwner ? (
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {archived ? (
                <Button
                  title={t('common.unarchive')}
                  kind="secondary"
                  onPress={() => void unarchiveVehicle(vehicle.id)}
                />
              ) : (
                <Button
                  title={t('common.archive')}
                  kind="secondary"
                  onPress={() => { void archiveVehicle(vehicle.id); }}
                />
              )}
              <Button
                title={t('common.delete')}
                kind="danger"
                disabled={web && !online}
                onPress={() => setConfirmDelete(true)}
              />
              {web && !online ? <T size={12} color={th.muted}>{t('deleteVehicle.offlineBlocked')}</T> : null}
              <T size={12} color={th.muted} style={{ marginTop: 4 }}>
                {t('vehicleDetail.startOdometer')}: {displayOdometer(vehicle, settings)}
              </T>
            </View>
          ) : null}
        </ScrollView>
      </DialogFrame>
      {confirmDelete && (
        <DeleteDialog
          vehicleName={vehicle.name}
          members={vehicle.memberIds.length}
          onClose={() => { setConfirmDelete(false); setDeleteError(false); }}
          onConfirm={() => void onDelete()}
          deleting={deleting}
          error={deleteError}
          offlineBlocked={web && !online}
        />
      )}
    </KeyboardAvoidingView>
  );
}

export default function VehicleDetail() {
  return (
    <ErrorBoundary screen="vehicle-detail">
      <VehicleDetailScreen />
    </ErrorBoundary>
  );
}
