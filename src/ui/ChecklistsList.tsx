// CHK-02/03/05 — More → Checklists for the selected vehicle: the templates
// with item counts and run/edit/copy actions, the starter offer when the
// vehicle has none (any starter may be picked — offered ones list first),
// the 20-per-vehicle message, and the copy-to-vehicle sheet. Archived
// vehicles are read-only (DR-13); pending templates show the sync icon.

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { RepoError } from '../data/adapter';
import type { TemplateRecord } from '../data/repos/templateRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import {
  canAddTemplate, STARTER_IDS, startersFor, type StarterId,
} from '../domain/checklists';
import { useAppStore } from '../features/appStore';
import {
  canMutateTemplates, copyDestinations, copyTemplateToVehicle, createStarter,
} from '../features/checklists';
import { adapter } from '../features/runtime';
import { t } from '../i18n';
import { Banner, Button, Card, Icon, IconButton, Row, T } from './kit';
import { useTheme } from './theme';

function isWeb(): boolean {
  try {
    return adapter().platform === 'web';
  } catch {
    return false;
  }
}

// --- starter offer (CHK-03) ---------------------------------------------------

export function StarterPicker({ vehicle, onError }: {
  vehicle: VehicleRecord;
  onError?: (message: string) => void;
}) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const web = isWeb();
  const [picked, setPicked] = useState<Set<StarterId>>(new Set());
  const [creating, setCreating] = useState(false);
  const offered = startersFor(vehicle.type);
  const ordered = [...offered, ...STARTER_IDS.filter((s) => !offered.includes(s))];
  const disabled = creating || (web && !online);

  const toggle = (id: StarterId) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };

  const create = async () => {
    setCreating(true);
    try {
      // Several starters may be picked at once (CD-02); each is an ordinary
      // editable template with the creator as createdBy.
      for (const id of picked) {
        await createStarter(vehicle.id, id);
      }
      setPicked(new Set());
    } catch (e) {
      onError?.(
        e instanceof RepoError && e.message === 'template-limit'
          ? t('checklists.limitReached')
          : t('vehicleForm.saveFailed'),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <T weight="semi" size={16}>{t('checklists.empty')}</T>
      <T size={13} color={th.muted} style={{ marginTop: 4, marginBottom: 12 }}>
        {t('checklists.pickStarters')}
      </T>
      {ordered.map((id) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityState={{ selected: picked.has(id) }}
          disabled={disabled}
          onPress={() => toggle(id)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, opacity: disabled ? 0.5 : 1 }}
        >
          <Icon
            name={picked.has(id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
            color={picked.has(id) ? th.primary : th.muted}
          />
          <T weight="semi" style={{ flex: 1 }}>{t(`checklists.starters.${id}`)}</T>
        </Pressable>
      ))}
      <View style={{ marginTop: 8 }}>
        <Button
          title={t('checklists.createStarters', { count: picked.size })}
          disabled={picked.size === 0 || disabled}
          onPress={() => void create()}
        />
      </View>
    </Card>
  );
}

// --- copy sheet (CHK-05) --------------------------------------------------------

function CopySheet({ template, source, onClose }: {
  template: TemplateRecord;
  source: VehicleRecord;
  onClose: () => void;
}) {
  const th = useTheme();
  const vehicles = useAppStore((s) => s.vehicles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTo, setCopiedTo] = useState<string | null>(null);
  const dests = copyDestinations(vehicles);

  const pick = async (dest: VehicleRecord) => {
    setBusy(true);
    setError(null);
    try {
      await copyTemplateToVehicle(template, dest.id);
      setCopiedTo(dest.name);
    } catch (e) {
      setError(
        e instanceof RepoError && e.message === 'template-limit'
          ? t('checklists.copyFull')
          : t('vehicleForm.saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={{ backgroundColor: th.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '70%' }}>
          <T size={18} weight="semi">{t('checklists.copyTo')}</T>
          <T size={13} color={th.muted} style={{ marginBottom: 8 }}>{source.name}</T>
          {copiedTo ? (
            <View style={{ gap: 12, paddingVertical: 8 }}>
              <T weight="semi" color={th.primary}>{t('checklists.copiedTo', { name: copiedTo })}</T>
              <Button title={t('checklists.done')} onPress={onClose} />
            </View>
          ) : (
            <ScrollView>
              {dests.map((v) => (
                <Row
                  key={v.id}
                  icon="car"
                  title={v.name}
                  onPress={busy ? undefined : () => void pick(v)}
                />
              ))}
              {error ? <T size={13} color={th.danger} style={{ marginVertical: 8 }}>{error}</T> : null}
              <View style={{ marginTop: 8 }}>
                <Button title={t('common.cancel')} kind="text" onPress={onClose} />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// --- the list -----------------------------------------------------------------

export function ChecklistsList({ vehicle }: { vehicle: VehicleRecord }) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const web = isWeb();
  const templates = useAppStore((s) => (s.templatesVehicleId === vehicle.id ? s.templates : []));
  const arrived = useAppStore((s) => s.templatesVehicleId === vehicle.id && s.templatesArrived);
  const [copying, setCopying] = useState<TemplateRecord | null>(null);
  const [starterError, setStarterError] = useState<string | null>(null);
  const mutable = canMutateTemplates(vehicle);
  const atLimit = !canAddTemplate(templates.length);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 40 }}>
      {!mutable ? (
        <Banner icon="archive-outline" text={t('vehicleForm.archivedReadonly')} tone="info" />
      ) : null}
      {web && !online ? <Banner icon="wifi-off" text={t('notices.offline')} /> : null}

      {!arrived ? (
        <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />
      ) : templates.length === 0 ? (
        <>
          {starterError ? (
            <T size={13} color={th.danger}>{starterError}</T>
          ) : null}
          {mutable ? (
            <>
              <StarterPicker vehicle={vehicle} onError={setStarterError} />
              <Button
                title={t('checklists.newTemplate')}
                kind="secondary"
                icon="plus"
                onPress={() => router.push({ pathname: '/checklist/[id]', params: { id: 'new' } })}
              />
            </>
          ) : (
            <Card>
              <T weight="semi" size={16}>{t('checklists.empty')}</T>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card style={{ paddingVertical: 4 }}>
            {templates.map((tp) => (
              <Row
                key={tp.id}
                icon="clipboard-check-outline"
                title={tp.name}
                sub={t('checklists.itemCount', { count: tp.items.length })}
                onPress={() =>
                  router.push({ pathname: '/checklist/[id]', params: { id: tp.id } })}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {tp.pending ? <Icon name="clock-outline" size={14} color={th.muted} /> : null}
                    {mutable ? (
                      <>
                        <IconButton
                          icon="clipboard-play-outline"
                          size={20}
                          accessibilityLabel={t('checklists.runInspection')}
                          onPress={() =>
                            router.push({ pathname: '/entry/[type]', params: { type: 'inspection', template: tp.id } })}
                        />
                        <IconButton
                          icon="content-copy"
                          size={20}
                          accessibilityLabel={t('checklists.copyTo')}
                          onPress={() => setCopying(tp)}
                        />
                      </>
                    ) : null}
                    <Icon name="chevron-right" color={th.muted} />
                  </View>
                }
              />
            ))}
          </Card>
          {mutable ? (
            atLimit ? (
              <T size={13} color={th.muted}>{t('checklists.limitReached')}</T>
            ) : (
              <Button
                title={t('checklists.newTemplate')}
                kind="secondary"
                icon="plus"
                onPress={() => router.push({ pathname: '/checklist/[id]', params: { id: 'new' } })}
              />
            )
          ) : null}
        </>
      )}

      {copying ? (
        <CopySheet template={copying} source={vehicle} onClose={() => setCopying(null)} />
      ) : null}
    </ScrollView>
  );
}
