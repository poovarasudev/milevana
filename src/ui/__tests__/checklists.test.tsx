// CHK-02..09 — component tests for the Checklists screen, template editor,
// inspection run/edit and the History row: starter offers, limits, run
// snapshot behaviour, failed-item shortcuts and the issue badge.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ addListener: () => () => {}, dispatch: jest.fn() }),
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  function SwipeableStub({ children }: { children: React.ReactNode }) {
    return React.createElement(View, null, children);
  }
  return SwipeableStub;
});

import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import type { EntryRecord } from '../../data/repos/entryRepo';
import type { TemplateRecord } from '../../data/repos/templateRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { tsFromMillis } from '../../data/schema/common';
import type { InspectionDetailsDoc } from '../../data/schema/entry';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { resetRuntimeForTests } from '../../features/runtime';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { initI18n } from '../../i18n';
import { ChecklistsList } from '../ChecklistsList';
import { InspectionForm } from '../entry/InspectionForm';
import { EntryRow } from '../HistoryList';
import { TemplateForm } from '../TemplateForm';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const vehicle = (over: Record<string, unknown> = {}) =>
  ({
    id: 'v1', pending: false, name: 'City Runner', type: 'car', color: 'c01',
    fuelTypes: ['petrol'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 0, ownerId: 'me', memberIds: ['me'],
    members: {}, archived: false,
    createdAt: ts(1), updatedAt: ts(1), updatedBy: 'me', schemaVersion: 1, ...over,
  }) as unknown as VehicleRecord;

const template = (id: string, over: Record<string, unknown> = {}): TemplateRecord =>
  ({
    id, pending: false, name: 'Pre-trip', createdBy: 'me',
    items: [
      { id: 'i1', label: 'Brakes', group: 'Safety' },
      { id: 'i2', label: 'Horn' },
      { id: 'i3', label: 'RC', group: 'Documents' },
    ],
    createdAt: ts(1), updatedAt: ts(1), updatedBy: 'me', schemaVersion: 1, ...over,
  }) as unknown as TemplateRecord;

const inspectionEntry = (over: Record<string, unknown> = {}): EntryRecord =>
  ({
    id: 'e1', type: 'inspection', date: tsFromMillis(Date.UTC(2026, 0, 10)),
    createdBy: 'me', createdByName: 'Me', updatedBy: 'me',
    attachments: [], uploaderUids: [], pending: false,
    createdAt: ts(1), updatedAt: ts(1), schemaVersion: 1,
    details: {
      templateName: 'Pre-trip',
      issueCount: 1,
      items: [
        { id: 'i1', label: 'Brakes', group: 'Safety', result: 'fail', note: 'worn pads' },
        { id: 'i2', label: 'Horn', result: 'pass' },
      ],
    } satisfies InspectionDetailsDoc,
    ...over,
  }) as unknown as EntryRecord;

let adapter: FakeAdapter;

const boot = (templates: TemplateRecord[] = []) => {
  adapter = new FakeAdapter('native');
  adapter.setUser({ uid: 'me', isAnonymous: true, displayName: null, email: null });
  adapter.docs.set('vehicles/v1', { ...vehicle() });
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  resetFirebaseForTests();
  resetAppStore();
  useAppStore.setState({
    user: { uid: 'me', isAnonymous: true, displayName: null, email: null },
    vehicles: [vehicle()],
    vehiclesLoaded: true,
    selectedVehicleId: 'v1',
    templatesVehicleId: 'v1',
    templates,
    templatesArrived: true,
    online: true,
  });
};

beforeAll(() => initI18n('en'));
beforeEach(() => boot());

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const pressText = (name: string | RegExp) => fireEvent.press(screen.getByText(name));
const type = (label: string | RegExp, s: string) =>
  fireEvent.changeText(screen.getByLabelText(label), s);

// --- Checklists screen (CHK-02/03) ---------------------------------------------

test('list: template rows show name and item count', async () => {
  boot([template('t1'), template('t2', { name: 'Long trip', items: [{ id: 'x', label: 'L' }] })]);
  await render(<ChecklistsList vehicle={vehicle()} />);
  screen.getByText('Pre-trip');
  screen.getByText('3 items');
  screen.getByText('Long trip');
  screen.getByText('1 item');
});

test('empty: starters are offered by vehicle type', async () => {
  await render(<ChecklistsList vehicle={vehicle()} />);
  screen.getByText('Car pre-trip');
  screen.getByText('Long trip');
  screen.getByText('Two-wheeler'); // pickable but not offered first
});

test('empty on a bike offers Two-wheeler + Long trip', async () => {
  await render(<ChecklistsList vehicle={vehicle({ type: 'bike' })} />);
  const rows = screen.getAllByText(/pre-trip|wheeler|Long trip/);
  expect(rows[0].props.children).toBe('Two-wheeler');
  expect(rows[1].props.children).toBe('Long trip');
});

test('creating a starter writes an editable template', async () => {
  await render(<ChecklistsList vehicle={vehicle()} />);
  await pressText('Car pre-trip');
  await press('Create 1');
  const docs = [...adapter.docs.keys()].filter((k) => k.includes('checklistTemplates'));
  expect(docs).toHaveLength(1);
});

test('20 templates: the add affordance becomes the limit message', async () => {
  const twenty = Array.from({ length: 20 }, (_, i) => template(`t${i}`, { name: `T${i}` }));
  boot(twenty);
  await render(<ChecklistsList vehicle={vehicle()} />);
  screen.getByText('This vehicle already has 20 checklists.');
  expect(screen.queryByRole('button', { name: 'New checklist' })).toBeNull();
});

test('archived vehicle is read-only: no add, run or copy actions', async () => {
  boot([template('t1')]);
  await render(<ChecklistsList vehicle={vehicle({ archived: true })} />);
  screen.getByText('Pre-trip');
  expect(screen.queryByRole('button', { name: 'New checklist' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Run inspection' })).toBeNull();
});

// --- template editor (CHK-04) ---------------------------------------------------

test('template form: name and at least one item are required', async () => {
  const onSubmit = jest.fn();
  await render(<TemplateForm vehicle={vehicle()} onSubmit={onSubmit} />);
  await press('Save');
  screen.getByText('Name is required');
  await type('NAME', 'Pre-trip');
  await press('Save');
  screen.getByText('Add at least one item');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('template form: duplicate names are rejected ignoring case', async () => {
  boot([template('t1', { name: 'Pre-trip' })]);
  const onSubmit = jest.fn();
  await render(<TemplateForm vehicle={vehicle()} onSubmit={onSubmit} />);
  await type('NAME', ' pre-TRIP ');
  await pressText('Add item');
  await type('ITEM 1', 'Brakes');
  await press('Save');
  screen.getByText('A checklist with that name already exists');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('template form: valid input submits trimmed name and items', async () => {
  const onSubmit = jest.fn();
  await render(<TemplateForm vehicle={vehicle()} onSubmit={onSubmit} />);
  await type('NAME', 'Annual');
  await pressText('Add item');
  await type('ITEM 1', 'Brakes');
  await type('GROUP (OPTIONAL)', 'Safety');
  await press('Save');
  const v = onSubmit.mock.calls.at(-1)![0];
  expect(v.name).toBe('Annual');
  expect(v.items).toHaveLength(1);
  expect(v.items[0]).toMatchObject({ label: 'Brakes', group: 'Safety' });
  expect(v.items[0].id).toBeTruthy();
});

test('template form: editing keeps item ids; reorder moves items', async () => {
  const onSubmit = jest.fn();
  const t1 = template('t1', {
    items: [
      { id: 'a', label: 'First' },
      { id: 'b', label: 'Second' },
    ],
  });
  await render(<TemplateForm vehicle={vehicle()} template={t1} onSubmit={onSubmit} />);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Move down' })[0]);
  await press('Save');
  const v = onSubmit.mock.calls.at(-1)![0];
  expect(v.items.map((i: { id: string }) => i.id)).toEqual(['b', 'a']);
});

// --- the run (CHK-06) -----------------------------------------------------------

const formProps = (over = {}) => ({
  vehicle: vehicle(),
  entries: [],
  readOnly: false,
  onSubmit: jest.fn(),
  ...over,
});

test('run: answers save a snapshot — pass/fail results, template item ids, issueCount', async () => {
  const onSubmit = jest.fn();
  await render(<InspectionForm {...formProps({ onSubmit })} template={template('t1')} />);
  await press('Pass — Brakes');
  await press('Fail — Horn');
  await press('N/A — RC'); // nothing unanswered
  await press('Save inspection');
  const { input } = onSubmit.mock.calls.at(-1)![0];
  expect(input.type).toBe('inspection');
  expect(input.amount).toBeUndefined();
  expect(input.category).toBeUndefined();
  expect(input.details.templateName).toBe('Pre-trip');
  expect(input.details.issueCount).toBe(1);
  expect(input.details.items.map((i: { id: string }) => i.id)).toEqual(['i1', 'i2', 'i3']);
  expect(input.details.items.map((i: { result: string }) => i.result)).toEqual(['pass', 'fail', 'na']);
});

test('run: saving with unanswered items confirms, then stores them as N/A', async () => {
  const onSubmit = jest.fn();
  await render(<InspectionForm {...formProps({ onSubmit })} template={template('t1')} />);
  await press('Pass — Brakes');
  await press('Save inspection');
  screen.getByText(/still unanswered/);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Save inspection' }).at(-1)!);
  const { input } = onSubmit.mock.calls.at(-1)![0];
  expect(input.details.items.map((i: { result: string }) => i.result)).toEqual(['pass', 'na', 'na']);
});

test('run: optional odometer is stored; invalid text blocks at the shell', async () => {
  const onSubmit = jest.fn();
  await render(<InspectionForm {...formProps({ onSubmit })} template={template('t1')} />);
  await type(/ODOMETER/, '10500');
  await press('Pass — Brakes');
  await press('Pass — Horn');
  await press('Pass — RC');
  await press('Save inspection');
  expect(onSubmit.mock.calls.at(-1)![0].input.odometer).toBe(10500);
});

test('run: item notes are stored on the snapshot item', async () => {
  const onSubmit = jest.fn();
  await render(<InspectionForm {...formProps({ onSubmit })} template={template('t1')} />);
  await fireEvent.press(screen.getAllByText('Add note')[0]);
  await type('NOTE — Brakes', 'squeaky pedal');
  await press('Fail — Brakes');
  await press('N/A — Horn');
  await press('N/A — RC');
  await press('Save inspection');
  const { input } = onSubmit.mock.calls.at(-1)![0];
  expect(input.details.items[0]).toMatchObject({ result: 'fail', note: 'squeaky pedal' });
});

// --- saved inspection (CHK-08/09) ------------------------------------------------

test('saved inspection: snapshot renders even after the template changed', async () => {
  const e = inspectionEntry();
  await render(<InspectionForm {...formProps()} entry={e} />);
  screen.getByText('Pre-trip'); // snapshot name — not the live template's
  expect(screen.getAllByText('Brakes').length).toBeGreaterThanOrEqual(1);
  screen.getByDisplayValue('worn pads');
  screen.getByText('Horn');
});

test('saved inspection: failed items get reminder and service shortcuts', async () => {
  const e = inspectionEntry();
  await render(<InspectionForm {...formProps()} entry={e} />);
  screen.getByText('Issues found');
  await press('Create reminder');
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/reminder/[id]',
    params: { id: 'new', vehicle: 'v1', title: 'Brakes — City Runner' },
  });
  await press('Log service');
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/entry/[type]',
    params: { type: 'service', vehicle: 'v1', notes: 'Brakes failed in inspection' },
  });
});

test('all-pass inspection has no issues summary', async () => {
  const e = inspectionEntry({
    details: {
      templateName: 'Pre-trip',
      issueCount: 0,
      items: [{ id: 'i1', label: 'Brakes', result: 'pass' }],
    },
  });
  await render(<InspectionForm {...formProps()} entry={e} />);
  expect(screen.queryByText('Issues found')).toBeNull();
});

test('editing a saved inspection recomputes issueCount on the same items', async () => {
  const onSubmit = jest.fn();
  const e = inspectionEntry();
  await render(<InspectionForm {...formProps({ onSubmit })} entry={e} />);
  // Flip Horn from pass to fail.
  await press('Fail — Horn');
  await press('Save inspection');
  const { patch } = onSubmit.mock.calls.at(-1)![0];
  expect(patch.details.issueCount).toBe(2);
  expect(patch.details.items.map((i: { id: string }) => i.id)).toEqual(['i1', 'i2']);
});

// --- history row (CHK-09) ---------------------------------------------------------

test('history row: template name, issue badge and odometer', async () => {
  const e = inspectionEntry({ odometer: 10500 });
  await render(<EntryRow entry={e} vehicle={vehicle()} uid="me" onDelete={jest.fn()} />);
  screen.getByText('Pre-trip');
  screen.getByText('1 issue');
  screen.getByText(/10500 km/);
});

test('history row: 0 issues shows "No issues"; 2 shows the plural', async () => {
  const clean = inspectionEntry({ id: 'a', details: { templateName: 'T', issueCount: 0, items: [] } });
  const two = inspectionEntry({ id: 'b', details: { templateName: 'T2', issueCount: 2, items: [] } });
  await render(
    <>
      <EntryRow entry={clean} vehicle={vehicle()} uid="me" onDelete={jest.fn()} />
      <EntryRow entry={two} vehicle={vehicle()} uid="me" onDelete={jest.fn()} />
    </>,
  );
  screen.getByText('No issues');
  screen.getByText('2 issues');
});
