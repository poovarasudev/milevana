// CHK-01 — domain tests (written first, TS-03 style): starters by vehicle
// type (SC-CHK01-01), the snapshot and its immutability (SC-CHK01-02/03),
// limits and constraints (SC-CHK01-04 covering #4, D1, D2, D4, D5).

import {
  buildInspection, canAddTemplate, copyNameFor, copyTemplateItems, failedItems,
  MAX_TEMPLATES_PER_VEHICLE, newItemId, noteTooLong, reminderTitleFor,
  starterInput, startersFor, unansweredCount, validateTemplateInput,
} from '../checklists';
import { initI18n, t } from '../../i18n';

beforeAll(() => initI18n('en'));

const tr = (k: string) => t(k) as string;

const TEMPLATE = () => ({
  name: 'Pre-trip',
  items: [
    { id: 'a', label: 'Tyres', group: 'Tyres' },
    { id: 'b', label: 'Lights' },
    { id: 'c', label: 'RC', group: 'Documents' },
  ],
});

describe('startersFor (SC-CHK01-01, CHK-01 #1)', () => {
  it('car, truck, bus and other get Car pre-trip + Long trip', () => {
    for (const type of ['car', 'truck', 'bus', 'other'] as const) {
      expect(startersFor(type)).toEqual(['car_pretrip', 'long_trip']);
    }
  });

  it('bike and scooter get Two-wheeler + Long trip', () => {
    for (const type of ['bike', 'scooter'] as const) {
      expect(startersFor(type)).toEqual(['two_wheeler', 'long_trip']);
    }
  });
});

describe('starterInput (CHK-03 #3, CD-02)', () => {
  it('car pre-trip has the SRS items, with four separate Documents items', () => {
    const s = starterInput('car_pretrip', tr);
    expect(s.name).toBe('Car pre-trip');
    const labels = s.items.map((i) => i.label);
    expect(labels).toEqual([
      'Tyre pressure and tread', 'Lights and indicators', 'Brakes', 'Horn',
      'Wipers', 'Engine oil', 'Coolant', 'Brake fluid', 'Mirrors',
      'RC', 'Insurance', 'PUC', 'Licence',
    ]);
    const docs = s.items.filter((i) => i.group === 'Documents');
    expect(docs.map((i) => i.label)).toEqual(['RC', 'Insurance', 'PUC', 'Licence']);
    // every item has a generated id
    expect(new Set(s.items.map((i) => i.id)).size).toBe(s.items.length);
  });

  it('two-wheeler and long-trip match the SRS lists', () => {
    const two = starterInput('two_wheeler', tr);
    expect(two.items.map((i) => i.label)).toEqual([
      'Tyres', 'Chain lubrication and tension', 'Brakes', 'Lights', 'Horn',
      'Mirrors', 'Fuel', 'Documents',
    ]);
    const long = starterInput('long_trip', tr);
    expect(long.items.map((i) => i.label)).toEqual([
      'Spare tyre and jack', 'Toolkit', 'First-aid kit', 'Fluids',
      'Battery', 'AC', 'FASTag balance',
    ]);
  });
});

describe('buildInspection (SC-CHK01-02, CHK-01 #2, CD-03/CD-04)', () => {
  it('copies name/labels/groups, keeps template item ids and counts fails', () => {
    const answers = new Map([
      ['a', { result: 'fail' as const, note: ' worn ' }],
      ['c', { result: 'fail' as const }],
    ]);
    const d = buildInspection(TEMPLATE(), answers);
    expect(d.templateName).toBe('Pre-trip');
    expect(d.items).toEqual([
      { id: 'a', label: 'Tyres', group: 'Tyres', result: 'fail', note: 'worn' },
      { id: 'b', label: 'Lights', result: 'na' }, // unanswered → na
      { id: 'c', label: 'RC', group: 'Documents', result: 'fail' },
    ]);
    expect(d.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(d.issueCount).toBe(2);
    expect(failedItems(d).map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('a template with no failed items yields issueCount 0', () => {
    const d = buildInspection(TEMPLATE(), new Map([
      ['a', { result: 'pass' as const }], ['b', { result: 'na' as const }], ['c', { result: 'pass' as const }],
    ]));
    expect(d.issueCount).toBe(0);
    expect(failedItems(d)).toEqual([]);
  });

  it('snapshot stays unchanged when the template is edited afterwards (SC-CHK01-03)', () => {
    const tpl = TEMPLATE();
    const d = buildInspection(tpl, new Map([['a', { result: 'fail' as const }]]));
    const before = JSON.parse(JSON.stringify(d));
    // Rename the template, delete an item, edit a label — the snapshot is a copy.
    tpl.name = 'Renamed';
    tpl.items[0].label = 'Changed';
    tpl.items.pop();
    expect(d).toEqual(before);
    expect(d.templateName).toBe('Pre-trip');
    expect(d.items).toHaveLength(3);
  });
});

describe('template validation (SC-CHK01-04, CD-01)', () => {
  const items = [{ label: 'Brakes' }];

  it('rejects empty, >60-char and duplicate (case-insensitive) names', () => {
    expect(validateTemplateInput({ name: '   ', items })).toBe('name-required');
    expect(validateTemplateInput({ name: 'x'.repeat(61), items })).toBe('name-too-long');
    expect(validateTemplateInput({ name: 'pre-TRIP', items }, ['Pre-Trip'])).toBe('name-taken');
    expect(validateTemplateInput({ name: 'Pre-Trip 2', items }, ['Pre-Trip'])).toBeNull();
  });

  it('rejects 0 items and 51 items; accepts 50', () => {
    expect(validateTemplateInput({ name: 'x', items: [] })).toBe('no-items');
    const many = Array.from({ length: 51 }, (_, i) => ({ label: `i${i}` }));
    expect(validateTemplateInput({ name: 'x', items: many })).toBe('too-many-items');
    expect(validateTemplateInput({ name: 'x', items: many.slice(0, 50) })).toBeNull();
  });

  it('labels and groups must be 1–60 chars; duplicate labels are fine', () => {
    expect(validateTemplateInput({ name: 'x', items: [{ label: ' ' }] })).toBe('item-label');
    expect(validateTemplateInput({ name: 'x', items: [{ label: 'y'.repeat(61) }] })).toBe('item-label');
    expect(validateTemplateInput({ name: 'x', items: [{ label: 'a', group: ' ' }] })).toBe('item-group');
    expect(validateTemplateInput({ name: 'x', items: [{ label: 'a', group: 'g'.repeat(61) }] })).toBe('item-group');
    expect(validateTemplateInput({ name: 'x', items: [{ label: 'same' }, { label: 'same' }] })).toBeNull();
  });

  it('the 20-per-vehicle cap refuses the 21st', () => {
    expect(canAddTemplate(19)).toBe(true);
    expect(canAddTemplate(20)).toBe(false);
    expect(canAddTemplate(21)).toBe(false); // past the cap stays blocked (CD-08)
  });
});

describe('run rules helpers (CD-04)', () => {
  it('unanswered items are counted for the save confirmation', () => {
    const answers = new Map([['a', { result: 'pass' as const }]]);
    expect(unansweredCount(TEMPLATE().items, answers)).toBe(2);
    expect(unansweredCount(TEMPLATE().items, new Map())).toBe(3);
  });

  it('notes over 500 characters are rejected', () => {
    expect(noteTooLong('x'.repeat(500))).toBe(false);
    expect(noteTooLong('x'.repeat(501))).toBe(true);
  });
});

describe('copy naming (CD-08, CHK-01 D5)', () => {
  it('appends (copy), then (copy 2)', () => {
    expect(copyNameFor('Pre-trip', [])).toBe('Pre-trip');
    expect(copyNameFor('Pre-trip', ['Pre-trip'])).toBe('Pre-trip (copy)');
    expect(copyNameFor('Pre-trip', ['Pre-trip', 'Pre-trip (copy)'])).toBe('Pre-trip (copy 2)');
  });

  it('matching ignores case and trims; the 60-char cap holds', () => {
    expect(copyNameFor('pre-trip', ['PRE-TRIP'])).toBe('pre-trip (copy)');
    const long = 'x'.repeat(60);
    expect(copyNameFor(long, [long])).toHaveLength(60);
    expect(copyNameFor(long, [long])).toBe(`${'x'.repeat(53)} (copy)`);
  });

  it('copied items get fresh ids and keep labels/groups', () => {
    const tpl = TEMPLATE();
    const out = copyTemplateItems(tpl.items);
    expect(out.map((i) => i.label)).toEqual(tpl.items.map((i) => i.label));
    expect(out[0].group).toBe('Tyres');
    expect(out[1].group).toBeUndefined();
    for (const [i, item] of out.entries()) {
      expect(item.id).not.toBe(tpl.items[i].id);
    }
  });
});

describe('misc domain (CHK-08/09 wording)', () => {
  it('newItemId produces distinct ids', () => {
    expect(new Set([newItemId(), newItemId(), newItemId()]).size).toBe(3);
  });

  it('reminder title pre-fill is "<item> — <vehicle>" (CD-07)', () => {
    expect(reminderTitleFor('Tyre pressure', 'Swift')).toBe('Tyre pressure — Swift');
  });

  it('max templates constant is 20', () => {
    expect(MAX_TEMPLATES_PER_VEHICLE).toBe(20);
  });
});
