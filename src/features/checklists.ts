// Checklists feature layer (CHK-02..05): the selected vehicle's templates
// watch feeding the read model, and the write paths with the app-side rules
// the rules cannot express — the 20-per-vehicle cap (OQ-59, L17), name
// uniqueness ignoring case (CD-01), starter creation (CD-02) and the copy
// flow (CD-08). Archived vehicles are read-only in the app (DR-13); delete
// is creator-or-owner like the rules.

import { RepoError } from '../data/adapter';
import type { Unsubscribe } from '../data/adapter';
import type { TemplateInput, TemplateRecord } from '../data/repos/templateRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import {
  canAddTemplate, copyNameFor, copyTemplateItems, starterInput, StarterId,
  validateTemplateInput,
} from '../domain/checklists';
import { t } from '../i18n';
import { useAppStore } from './appStore';
import { reportNonFatal } from './reporting';
import { getRepos } from './runtime';
import { guardedWrite } from './vehicleActions';

// --- watch (CHK-02) ------------------------------------------------------------

/** Mirror the selected vehicle's templates into the read model. */
export function startTemplatesWatch(vehicleId: string): Unsubscribe {
  useAppStore.setState({ templatesVehicleId: vehicleId, templatesArrived: false, templates: [] });
  return getRepos().templates.watch(
    vehicleId,
    (templates) => {
      const st = useAppStore.getState();
      if (st.templatesVehicleId !== vehicleId) return;
      useAppStore.setState({ templates, templatesArrived: true });
    },
    {
      onError: (e) => {
        reportNonFatal(e, { stage: 'watch-templates' });
        useAppStore.setState({ ownerError: true });
      },
    },
  );
}

// --- authority ------------------------------------------------------------------

/** DR-13: archived vehicles accept no template changes (app-side). */
export function canMutateTemplates(vehicle: VehicleRecord | null | undefined): boolean {
  return !!vehicle && !vehicle.archived;
}

/** Creator or the vehicle's owner deletes (§23.7 *Permissions*). */
export function canDeleteTemplate(
  template: Pick<TemplateRecord, 'createdBy'>,
  vehicle: VehicleRecord | null | undefined,
  uid?: string,
): boolean {
  if (!canMutateTemplates(vehicle) || !uid) return false;
  return template.createdBy === uid || vehicle!.ownerId === uid;
}

function vehicleOrThrow(vehicleId: string): VehicleRecord {
  const vehicle = useAppStore.getState().vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) throw new RepoError('not-found', vehicleId);
  if (vehicle.archived) throw new RepoError('invalid-argument', 'archived vehicle');
  return vehicle;
}

function templateCount(vehicleId: string): number {
  const st = useAppStore.getState();
  return st.templatesVehicleId === vehicleId ? st.templates.length : 0;
}

// --- writes ----------------------------------------------------------------------

export async function createTemplate(vehicleId: string, input: TemplateInput): Promise<string> {
  vehicleOrThrow(vehicleId);
  if (!canAddTemplate(templateCount(vehicleId))) {
    throw new RepoError('resource-exhausted', 'template-limit');
  }
  const err = validateTemplateInput(
    input,
    useAppStore.getState().templates.map((tp) => tp.name),
  );
  if (err) throw new RepoError('invalid-argument', err);
  return guardedWrite(getRepos().templates.create(vehicleId, input));
}

export async function updateTemplate(
  vehicleId: string,
  id: string,
  patch: { name?: string; items?: TemplateInput['items'] },
): Promise<void> {
  vehicleOrThrow(vehicleId);
  const st = useAppStore.getState();
  const existing = st.templates.find((tp) => tp.id === id);
  if (!existing) throw new RepoError('not-found', id);
  const merged = { name: patch.name ?? existing.name, items: patch.items ?? existing.items };
  const err = validateTemplateInput(
    merged,
    st.templates.filter((tp) => tp.id !== id).map((tp) => tp.name),
  );
  if (err) throw new RepoError('invalid-argument', err);
  await guardedWrite(getRepos().templates.update(vehicleId, id, patch));
}

export async function deleteTemplate(vehicleId: string, id: string): Promise<void> {
  vehicleOrThrow(vehicleId);
  await guardedWrite(getRepos().templates.delete(vehicleId, id));
}

/** CD-02: a starter is an ordinary editable template, text from English i18n. */
export async function createStarter(vehicleId: string, starter: StarterId): Promise<string> {
  return createTemplate(vehicleId, starterInput(starter, t));
}

// --- copy (CHK-05, CD-08) -----------------------------------------------------------

/**
 * The copy destination list: every vehicle the user belongs to except
 * archived ones (CD-08). The source vehicle stays in the list — copying onto
 * the same vehicle is how "duplicate this checklist" falls out of CD-08's
 * naming rule.
 */
export function copyDestinations(vehicles: VehicleRecord[]): VehicleRecord[] {
  return vehicles.filter((v) => !v.archived);
}

/**
 * Copy a template to another vehicle: new item ids, the copier as creator,
 * '(copy)' naming on a clash (CD-08). Throws 'template-limit' when the
 * destination already has 20 — the UI shows 'That vehicle already has 20
 * checklists.'
 */
export async function copyTemplateToVehicle(
  template: TemplateRecord,
  destVehicleId: string,
): Promise<string> {
  vehicleOrThrow(destVehicleId);
  const repos = getRepos();
  const existing = await repos.templates.list(destVehicleId);
  if (!canAddTemplate(existing.length)) {
    throw new RepoError('resource-exhausted', 'template-limit');
  }
  const input: TemplateInput = {
    name: copyNameFor(template.name, existing.map((tp) => tp.name)),
    items: copyTemplateItems(template.items),
  };
  return guardedWrite(repos.templates.create(destVehicleId, input));
}
