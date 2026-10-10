// CHK-02..05, CHK-10 — the checklists feature layer against the FakeAdapter:
// the templates watch, CRUD with the app-side rules (20-per-vehicle cap,
// name-uniqueness ignoring case, archived read-only, creator-or-owner
// delete), starter creation and the copy flow (destinations, '(copy)'
// naming, fresh item ids, full-destination refusal).

import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import type { TemplateRecord } from '../../data/repos/templateRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import type { ChecklistTemplateDoc } from '../../data/schema/checklistTemplate';
import { initI18n } from '../../i18n';
import { resetAppStore, useAppStore } from '../appStore';
import {
  canDeleteTemplate, copyDestinations, copyTemplateToVehicle,
  createStarter, createTemplate, deleteTemplate, startTemplatesWatch, updateTemplate,
} from '../checklists';
import { resetRuntimeForTests } from '../runtime';
import { FakeAdapter } from './fakeAdapter';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const vehicleDoc = (over: Record<string, unknown> = {}) => ({
  name: 'City Runner', type: 'car', fuelTypes: ['petrol'], odometerUnit: 'km',
  currency: 'INR', color: 'c01', startOdometer: 0,
  lastOdometer: 0, lastOdometerAt: ts(1), archived: false,
  ownerId: 'u-me', memberIds: ['u-me'],
  members: { 'u-me': { role: 'owner', joinedAt: ts(1) } },
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
});

const vehicle = (id: string, over: Record<string, unknown> = {}) =>
  ({ ...vehicleDoc(over), id }) as unknown as VehicleRecord;

const templateDoc = (over: Record<string, unknown> = {}): ChecklistTemplateDoc => ({
  name: 'Pre-trip', items: [{ id: 'i1', label: 'Brakes' }],
  createdBy: 'u-me', schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
} as ChecklistTemplateDoc);

const templateRecord = (id: string, over: Record<string, unknown> = {}): TemplateRecord =>
  ({ ...templateDoc(over), id, pending: false } as TemplateRecord);

let adapter: FakeAdapter;

const boot = (vehicles: VehicleRecord[] = [vehicle('v1')], uid = 'u-me') => {
  adapter = new FakeAdapter('native');
  adapter.setUser({ uid, isAnonymous: true, displayName: null, email: null });
  for (const v of vehicles) {
    const { id, ...doc } = v as unknown as { id: string } & Record<string, unknown>;
    adapter.docs.set(`vehicles/${id}`, doc);
  }
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  resetFirebaseForTests();
  resetAppStore();
  useAppStore.setState({
    user: { uid, isAnonymous: true, displayName: null, email: null },
    vehicles,
    vehiclesLoaded: true,
    selectedVehicleId: vehicles[0]?.id ?? null,
    online: true,
  });
};

beforeAll(() => initI18n('en'));
beforeEach(() => boot());

// --- watch (CHK-02) -----------------------------------------------------------

test('startTemplatesWatch mirrors the vehicle\'s templates into the store', async () => {
  adapter.docs.set('vehicles/v1/checklistTemplates/t1', templateDoc());
  adapter.docs.set('vehicles/v2/checklistTemplates/other', templateDoc());
  const stop = startTemplatesWatch('v1');
  const st = useAppStore.getState();
  expect(st.templatesVehicleId).toBe('v1');
  expect(st.templatesArrived).toBe(true);
  expect(st.templates.map((t) => t.id)).toEqual(['t1']);
  stop();
});

// --- create / edit / delete (CHK-04) ------------------------------------------

test('createTemplate writes through the repo and updates the watch', async () => {
  const stop = startTemplatesWatch('v1');
  const id = await createTemplate('v1', { name: 'Pre-trip', items: [{ id: 'i1', label: 'Brakes' }] });
  expect(adapter.docs.has(`vehicles/v1/checklistTemplates/${id}`)).toBe(true);
  expect(useAppStore.getState().templates.map((t) => t.id)).toContain(id);
  stop();
});

test('the 21st template is refused (OQ-59)', async () => {
  for (let i = 0; i < 20; i++) {
    adapter.docs.set(`vehicles/v1/checklistTemplates/t${i}`, templateDoc({ name: `T${i}` }));
  }
  const stop = startTemplatesWatch('v1');
  await expect(createTemplate('v1', { name: 'One more', items: [{ id: 'i', label: 'L' }] }))
    .rejects.toMatchObject({ code: 'resource-exhausted', message: 'template-limit' });
  stop();
});

test('template names are unique per vehicle ignoring case', async () => {
  await createTemplate('v1', { name: 'Pre-trip', items: [{ id: 'i', label: 'L' }] });
  const stop = startTemplatesWatch('v1');
  await expect(createTemplate('v1', { name: '  PRE-TRIP ', items: [{ id: 'i2', label: 'L2' }] }))
    .rejects.toMatchObject({ code: 'invalid-argument', message: 'name-taken' });
  stop();
});

test('updateTemplate renames and re-validates; empty item list rejected', async () => {
  const id = await createTemplate('v1', { name: 'A', items: [{ id: 'i', label: 'L' }] });
  await createTemplate('v1', { name: 'B', items: [{ id: 'i', label: 'L' }] });
  const stop = startTemplatesWatch('v1');
  await updateTemplate('v1', id, { name: 'A2' });
  expect((adapter.docs.get(`vehicles/v1/checklistTemplates/${id}`) as { name: string }).name).toBe('A2');
  await expect(updateTemplate('v1', id, { name: 'b' }))
    .rejects.toMatchObject({ code: 'invalid-argument', message: 'name-taken' });
  await expect(updateTemplate('v1', id, { items: [] }))
    .rejects.toMatchObject({ code: 'invalid-argument', message: 'no-items' });
  stop();
});

test('archived vehicles refuse every template mutation (DR-13)', async () => {
  boot([vehicle('v1', { archived: true })]);
  await expect(createTemplate('v1', { name: 'X', items: [{ id: 'i', label: 'L' }] }))
    .rejects.toMatchObject({ code: 'invalid-argument' });
  adapter.docs.set('vehicles/v1/checklistTemplates/t1', templateDoc());
  await expect(updateTemplate('v1', 't1', { name: 'Y' })).rejects.toMatchObject({ code: 'invalid-argument' });
  await expect(deleteTemplate('v1', 't1')).rejects.toMatchObject({ code: 'invalid-argument' });
});

test('canDeleteTemplate: creator or owner only; never on archived', () => {
  const v = vehicle('v1', { ownerId: 'u-owner', memberIds: ['u-owner', 'u-me', 'u-other'] });
  const mine = templateRecord('t1', { createdBy: 'u-me' });
  expect(canDeleteTemplate(mine, v, 'u-me')).toBe(true);
  expect(canDeleteTemplate(mine, v, 'u-owner')).toBe(true);
  expect(canDeleteTemplate(mine, v, 'u-other')).toBe(false);
  expect(canDeleteTemplate(mine, vehicle('v1', { archived: true }), 'u-me')).toBe(false);
});

// --- starters (CHK-03) --------------------------------------------------------

test('createStarter writes the car pre-trip starter with the Documents group', async () => {
  const id = await createStarter('v1', 'car_pretrip');
  const doc = adapter.docs.get(`vehicles/v1/checklistTemplates/${id}`) as ChecklistTemplateDoc;
  expect(doc.name).toBe('Car pre-trip');
  expect(doc.createdBy).toBe('u-me');
  const docs = doc.items.filter((i) => i.group === 'Documents');
  expect(docs.map((i) => i.label)).toEqual(['RC', 'Insurance', 'PUC', 'Licence']);
  expect(doc.items.length).toBeGreaterThan(4);
});

test('starters count toward the 20-per-vehicle limit', async () => {
  for (let i = 0; i < 20; i++) {
    adapter.docs.set(`vehicles/v1/checklistTemplates/t${i}`, templateDoc({ name: `T${i}` }));
  }
  const stop = startTemplatesWatch('v1');
  await expect(createStarter('v1', 'long_trip'))
    .rejects.toMatchObject({ code: 'resource-exhausted', message: 'template-limit' });
  stop();
});

// --- copy (CHK-05) ------------------------------------------------------------

test('copyDestinations lists every non-archived member vehicle', () => {
  const v1 = vehicle('v1');
  const v2 = vehicle('v2');
  const v3 = vehicle('v3', { archived: true });
  expect(copyDestinations([v1, v2, v3]).map((v) => v.id)).toEqual(['v1', 'v2']);
});

test('copy lands on the destination with fresh ids and the copier as creator', async () => {
  const src = templateRecord('src', {
    name: 'Pre-trip',
    items: [
      { id: 'i1', label: 'Brakes', group: 'Safety' },
      { id: 'i2', label: 'Lights' },
    ],
    createdBy: 'u-other',
  });
  const v2 = vehicle('v2');
  boot([vehicle('v1'), v2]);
  const newId = await copyTemplateToVehicle(src, 'v2');
  const doc = adapter.docs.get(`vehicles/v2/checklistTemplates/${newId}`) as ChecklistTemplateDoc;
  expect(doc.name).toBe('Pre-trip');
  expect(doc.createdBy).toBe('u-me'); // the copier, not the original creator
  expect(doc.items.map((i) => i.label)).toEqual(['Brakes', 'Lights']);
  expect(doc.items[0].group).toBe('Safety');
  expect(doc.items.map((i) => i.id)).not.toContain('i1');
});

test('copy names: same name, then " (copy)", then " (copy 2)"', async () => {
  const src = templateRecord('src', { name: 'Pre-trip' });
  const v2 = vehicle('v2');
  adapter.docs.set('vehicles/v2/checklistTemplates/x1', templateDoc());
  adapter.docs.set('vehicles/v2/checklistTemplates/x2', templateDoc({ name: 'Pre-trip (copy)' }));
  boot([vehicle('v1'), v2]);
  adapter.docs.set('vehicles/v2/checklistTemplates/x1', templateDoc());
  adapter.docs.set('vehicles/v2/checklistTemplates/x2', templateDoc({ name: 'Pre-trip (copy)' }));
  const id = await copyTemplateToVehicle(src, 'v2');
  expect((adapter.docs.get(`vehicles/v2/checklistTemplates/${id}`) as ChecklistTemplateDoc).name)
    .toBe('Pre-trip (copy 2)');
});

test('copy to a full destination refuses with template-limit', async () => {
  const v2 = vehicle('v2');
  boot([vehicle('v1'), v2]);
  for (let i = 0; i < 20; i++) {
    adapter.docs.set(`vehicles/v2/checklistTemplates/t${i}`, templateDoc({ name: `T${i}` }));
  }
  await expect(copyTemplateToVehicle(templateRecord('src'), 'v2'))
    .rejects.toMatchObject({ code: 'resource-exhausted', message: 'template-limit' });
});

test('copy to an archived vehicle refuses', async () => {
  boot([vehicle('v1'), vehicle('v2', { archived: true })]);
  await expect(copyTemplateToVehicle(templateRecord('src'), 'v2'))
    .rejects.toMatchObject({ code: 'invalid-argument' });
});
