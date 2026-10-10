// CHK-04 — the template editor: a name plus up to 50 items, each a label
// with an optional free-text group (CD-01). Items keep the ids they were
// created with — snapshot item ids are template item ids (CD-03). Reorder
// with the arrow buttons; the name must be unique on the vehicle ignoring
// case and at least one item is required (app-side rules).

import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import type { ChecklistTemplateDoc } from '../data/schema/checklistTemplate';
import type { TemplateRecord } from '../data/repos/templateRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { MAX_TEMPLATE_ITEMS, SHORT_TEXT_MAX } from '../data/schema/common';
import { newItemId, validateTemplateInput } from '../domain/checklists';
import { canDeleteTemplate } from '../features/checklists';
import { useAppStore } from '../features/appStore';
import { adapter } from '../features/runtime';
import { t } from '../i18n';
import { Banner, Button, Card, Field, Icon, IconButton, Label, T } from './kit';
import { KEYBOARD_BEHAVIOR } from './platform';
import { font, useTheme } from './theme';

interface ItemState {
  id: string;
  label: string;
  group: string;
}

function errorText(code: string | undefined): string {
  switch (code) {
    case 'name-required': return t('checklists.nameRequired');
    case 'name-too-long': return t('entryForm.textTooLong');
    case 'name-taken': return t('checklists.nameTaken');
    case 'no-items': return t('checklists.noItems');
    case 'too-many-items': return t('checklists.tooManyItems');
    case 'item-label': return t('checklists.itemLabelRequired');
    case 'item-group': return t('checklists.groupTooLong');
    default: return '';
  }
}

export function TemplateForm({ vehicle, template, saving, saveError, onSubmit, onDelete }: {
  vehicle: VehicleRecord;
  /** Present = edit mode; absent = create. */
  template?: TemplateRecord;
  saving?: boolean;
  saveError?: string | null;
  onSubmit: (input: { name: string; items: ChecklistTemplateDoc['items'] }) => void;
  onDelete?: () => void;
}) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const uid = useAppStore((s) => s.user?.uid);
  const templates = useAppStore((s) => (s.templatesVehicleId === vehicle.id ? s.templates : []));
  const web = adapter().platform === 'web';
  const readOnly = vehicle.archived;
  const deletable = !!template && canDeleteTemplate(template, vehicle, uid) && !!onDelete;

  const [name, setName] = useState(template?.name ?? '');
  const [items, setItems] = useState<ItemState[]>(
    () => (template?.items ?? []).map((i) => ({ id: i.id, label: i.label, group: i.group ?? '' })),
  );
  const [error, setError] = useState<string | null>(null);

  const setItem = (idx: number, patch: Partial<ItemState>) => {
    setItems((is) => is.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const remove = (idx: number) => setItems((is) => is.filter((_, i) => i !== idx));

  const addItem = () => {
    if (items.length >= MAX_TEMPLATE_ITEMS) return;
    setItems((is) => [...is, { id: newItemId(), label: '', group: '' }]);
  };

  const submit = () => {
    const clean = items.map((i) => ({
      id: i.id,
      label: i.label.trim(),
      ...(i.group.trim() ? { group: i.group.trim() } : {}),
    }));
    const other = templates.filter((tp) => tp.id !== template?.id).map((tp) => tp.name);
    const err = validateTemplateInput({ name, items: clean }, other);
    if (err) {
      setError(errorText(err));
      return;
    }
    setError(null);
    onSubmit({ name: name.trim(), items: clean });
  };

  return (
    <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {readOnly ? (
          <Banner icon="archive-outline" text={t('vehicleForm.archivedReadonly')} tone="info" />
        ) : null}
        {web && !online && !readOnly ? <Banner icon="wifi-off" text={t('notices.offline')} /> : null}

        <Field
          label={t('checklists.nameLabel')}
          value={name}
          onChangeText={setName}
          maxLength={SHORT_TEXT_MAX}
          editable={!readOnly}
          testID="template.name"
        />

        <Label>{t('checklists.itemsLabel')}</Label>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {items.map((it, idx) => (
            <Card key={it.id} style={{ paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    accessibilityLabel={t('checklists.itemLabel', { n: idx + 1 })}
                    placeholder={t('checklists.itemLabel', { n: idx + 1 })}
                    placeholderTextColor={th.muted}
                    value={it.label}
                    onChangeText={(v) => setItem(idx, { label: v })}
                    maxLength={SHORT_TEXT_MAX}
                    editable={!readOnly}
                    style={{ fontFamily: font.semi, fontSize: 16, color: th.text, paddingVertical: 8 }}
                  />
                  <TextInput
                    accessibilityLabel={t('checklists.itemGroup')}
                    placeholder={t('checklists.itemGroup')}
                    placeholderTextColor={th.muted}
                    value={it.group}
                    onChangeText={(v) => setItem(idx, { group: v })}
                    maxLength={SHORT_TEXT_MAX}
                    editable={!readOnly}
                    style={{ fontFamily: font.medium, fontSize: 13, color: th.muted, paddingVertical: 6 }}
                  />
                </View>
                {!readOnly ? (
                  <View style={{ alignItems: 'center' }}>
                    <IconButton
                      icon="arrow-up"
                      size={18}
                      color={idx === 0 ? th.divider : th.muted}
                      accessibilityLabel={t('checklists.moveUp')}
                      disabled={idx === 0}
                      onPress={() => move(idx, -1)}
                    />
                    <IconButton
                      icon="arrow-down"
                      size={18}
                      color={idx === items.length - 1 ? th.divider : th.muted}
                      accessibilityLabel={t('checklists.moveDown')}
                      disabled={idx === items.length - 1}
                      onPress={() => move(idx, 1)}
                    />
                    <IconButton
                      icon="close"
                      size={18}
                      color={th.muted}
                      accessibilityLabel={t('checklists.removeItem')}
                      onPress={() => remove(idx)}
                    />
                  </View>
                ) : null}
              </View>
            </Card>
          ))}
        </View>

        {!readOnly && items.length < MAX_TEMPLATE_ITEMS ? (
          <Pressable
            accessibilityRole="button"
            onPress={addItem}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginBottom: 16 }}
          >
            <Icon name="plus" color={th.primary} size={20} />
            <T weight="semi" color={th.primary}>{t('checklists.addItem')}</T>
          </Pressable>
        ) : null}

        {error ? <T size={13} color={th.danger} style={{ marginBottom: 12 }}>{error}</T> : null}
        {saveError ? <T size={13} color={th.danger} style={{ marginBottom: 12 }}>{saveError}</T> : null}

        {!readOnly ? (
          <Button
            title={t('common.save')}
            onPress={submit}
            disabled={!!saving || (web && !online)}
          />
        ) : null}
        {deletable ? (
          <View style={{ marginTop: 12 }}>
            <Button title={t('common.delete')} kind="danger" onPress={onDelete} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
