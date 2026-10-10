// Sharing UI coverage (SC-SHR07-03/04, SC-SHR08-01/04, SC-SHR10-01/02,
// SC-SHR11-02/03, SC-SHR12-03, SC-SHR13-02, SC-SHR14-04, SC-SHR15-02):
// the owner Invite block + pending list, the member Leave block, the members
// list screen with owner actions, the join entry + join screens, and the
// member-receipt states in AttachmentsSection.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (n: number) => new Uint8Array(n).fill(7),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { AttachmentDoc } from '../../data/schema/entry';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { resetRuntimeForTests } from '../../features/runtime';
import { initI18n } from '../../i18n';
import { AttachmentsSection } from '../entry/AttachmentsSection';
import { MemberShareBlock, OwnerShareBlock } from '../VehicleShare';
import JoinEntry from '../../../app/join/index';
import JoinByCode from '../../../app/join/[code]';
import MembersScreen from '../../../app/vehicle/members';

const uid = 'me';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const past = ts(1_700_000_000);
let adapter: FakeAdapter;

function memberRec(role: 'owner' | 'member', name: string, email?: string, joined = past) {
  return { role, name, ...(email ? { email } : {}), joinedAt: joined };
}

function sharedVehicle(over: Partial<VehicleRecord> = {}): VehicleRecord {
  const doc = adapter.docs.get('vehicles/v1')!;
  return { ...(doc as Omit<VehicleRecord, 'id' | 'pending'>), id: 'v1', pending: false, ...over };
}

function plantVehicle(members: Record<string, ReturnType<typeof memberRec>>): VehicleRecord {
  adapter.docs.set('vehicles/v1', {
    name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 1000,
    lastOdometer: 1000, lastOdometerAt: past,
    ownerId: 'me', memberIds: Object.keys(members), members, archived: false,
    createdAt: past, updatedAt: past, schemaVersion: 1,
  });
  return sharedVehicle();
}

function boot(linked = true): void {
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.setUser({
    uid, isAnonymous: !linked,
    displayName: linked ? 'Me Name' : null, email: linked ? 'me@x.com' : null,
  });
  useAppStore.setState({ user: adapter.currentUser(), online: true });
}

beforeAll(() => initI18n('en'));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetFirebaseForTests();
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
});

// --- AttachmentsSection member receipts (SHR-15) -----------------------------

const otherAtt = (over: Partial<AttachmentDoc> = {}): AttachmentDoc => ({
  id: 'a1', ownerUid: 'bob', mimeType: 'image/jpeg', sizeBytes: 10,
  status: 'uploaded', driveFileId: 'd1', sharedWithUids: [], ...over,
});

const entryFixture = {
  id: 'e1', type: 'expense', date: past, odometer: 1200,
  amount: { minor: 25000, currency: 'INR' }, category: 'cleaning',
  attachments: [], uploaderUids: ['bob'],
  createdBy: 'bob', createdByName: 'Bob', updatedBy: 'bob',
  createdAt: past, updatedAt: past, schemaVersion: 1, pending: false,
} as unknown as import('../../data/repos/entryRepo').EntryRecord;

function renderAtts(
  att: AttachmentDoc,
  vehicle: { memberIds: string[]; members: Record<string, { name?: string }> } = {
    memberIds: ['me', 'bob'], members: { bob: { name: 'Bob' } },
  },
) {
  boot();
  return render(
    <AttachmentsSection
      uid="me" vehicleId="v1" vehicle={vehicle} entry={entryFixture}
      attachments={[att]} pendings={[]} readOnly
      onAdd={() => undefined} onRemoveExisting={() => undefined}
      onRemovePending={() => undefined} onRetry={() => undefined}
    />,
  );
}

describe('member receipts (SHR-15, SD-09)', () => {
  it('shared with me → "Open in Drive" (SC-SHR15-01)', async () => {
    const q = await renderAtts(otherAtt({ sharedWithUids: ['me'] }));
    expect(q.getByText('Open in Drive')).toBeTruthy();
  });

  it('not yet shared → "Shared once Bob opens the app" (SC-SHR15-02, SC-SHR14-04)', async () => {
    const q = await renderAtts(otherAtt());
    expect(q.getByText('Shared once Bob opens the app')).toBeTruthy();
  });

  it('uploader left, never shared → "No longer available" (SC-SHR15-03)', async () => {
    const q = await renderAtts(otherAtt(), { memberIds: ['me', 'sam'], members: { sam: { name: 'Sam' } } });
    expect(q.getByText('No longer available')).toBeTruthy();
  });

  it('uploader left but already shared → still "Open in Drive" (SC-SHR15-03)', async () => {
    const q = await renderAtts(otherAtt({ sharedWithUids: ['me'] }), { memberIds: ['me'], members: {} });
    expect(q.getByText('Open in Drive')).toBeTruthy();
  });

  it('own receipt keeps the normal viewer path', async () => {
    const q = await renderAtts(otherAtt({ ownerUid: 'me', sharedWithUids: [] }));
    expect(q.queryByText('Open in Drive')).toBeNull();
    expect(q.queryByText('No longer available')).toBeNull();
  });
});

// --- OwnerShareBlock (SHR-07) -------------------------------------------------

describe('OwnerShareBlock (SHR-07, SD-05)', () => {
  it('Invite creates an invite and shows the XXXX-XXXX code + link', async () => {
    boot();
    const v = plantVehicle({ me: memberRec('owner', 'Me', 'me@x.com') });
    const q = await render(<OwnerShareBlock vehicle={v} />);
    await q.findByText('Invite');
    await fireEvent.press(q.getByText('Invite'));
    await q.findAllByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/); // XXXX-XXXX display
    expect(q.getByText(/milevana\.poovarasu\.dev\/join\//)).toBeTruthy();
  });

  it('pending invites list expiry; Cancel deletes them (SC-SHR07-03)', async () => {
    boot();
    const v = plantVehicle({ me: memberRec('owner', 'Me', 'me@x.com') });
    const now = adapter.now();
    adapter.docs.set('invites/K7QXM2PA', {
      vehicleId: 'v1', vehicleName: 'Swift', ownerId: 'me', ownerName: 'Me',
      createdBy: 'me', createdAt: now, expiresAt: ts(now.seconds + 7 * 24 * 3600),
      schemaVersion: 1,
    });
    adapter.docs.set('invites/AAAA2222', {
      vehicleId: 'v1', vehicleName: 'Swift', ownerId: 'me', ownerName: 'Me',
      createdBy: 'me', createdAt: ts(now.seconds - 8 * 24 * 3600),
      expiresAt: ts(now.seconds - 24 * 3600), schemaVersion: 1,
    });
    const q = await render(<OwnerShareBlock vehicle={v} />);
    await q.findByText('K7QX-M2PA');
    expect(q.getByText('Expired')).toBeTruthy();
    const cancels = q.getAllByText('Cancel');
    await fireEvent.press(cancels[0]);
    await waitFor(() => {
      expect(adapter.docs.has('invites/K7QXM2PA') && adapter.docs.has('invites/AAAA2222')).toBe(false);
      expect(adapter.docs.has('invites/K7QXM2PA') || adapter.docs.has('invites/AAAA2222')).toBe(true);
    });
  });

  it('at 10 members the Invite action is disabled with a message (SC-SHR07-03)', async () => {
    boot();
    const members: Record<string, ReturnType<typeof memberRec>> = { me: memberRec('owner', 'Me', 'me@x.com') };
    for (let i = 0; i < 9; i++) members[`m${i}`] = memberRec('member', `M${i}`, `m${i}@x.com`);
    const v = plantVehicle(members);
    const q = await render(<OwnerShareBlock vehicle={v} />);
    await q.findByText('This vehicle already has 10 members');
  });
});

// --- MemberShareBlock (SHR-11) ------------------------------------------------

describe('MemberShareBlock (SHR-11, SD-07)', () => {
  it('Leave opens the SD-07 confirmation and leaving removes the record', async () => {
    boot();
    adapter.docs.set('vehicles/v1', {
      name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 1000,
      lastOdometer: 1000, lastOdometerAt: past,
      ownerId: 'ann', memberIds: ['ann', 'me'], archived: false,
      members: { ann: memberRec('owner', 'Ann', 'a@x.com'), me: memberRec('member', 'Me', 'me@x.com') },
      createdAt: past, updatedAt: past, schemaVersion: 1,
    });
    const v = sharedVehicle({ ownerId: 'ann' });
    useAppStore.setState({ vehicles: [v], selectedVehicleId: 'v1' });
    const q = await render(<MemberShareBlock vehicle={v} />);
    await fireEvent.press(q.getByText('Leave vehicle'));
    await q.findByText('Leave Swift?');
    expect(q.getByText(/lose access\. Your past entries stay, labelled with your name/)).toBeTruthy();
    await fireEvent.press(q.getAllByText('Leave vehicle').at(-1)!);
    await waitFor(() => {
      const doc = adapter.docs.get('vehicles/v1')!;
      expect(doc.memberIds).toEqual(['ann']);
      expect((doc.members as Record<string, unknown>).me).toBeUndefined();
    });
  });
});

// --- Members screen (SHR-10/12/13) --------------------------------------------

describe('members screen (SHR-10/12/13, SD-10)', () => {
  function membersVehicle() {
    adapter.docs.set('vehicles/v1', {
      name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 1000,
      lastOdometer: 1000, lastOdometerAt: past,
      ownerId: 'me', memberIds: ['me', 'bob', 'sam'], archived: false,
      members: {
        me: memberRec('owner', 'Me', 'me@x.com', ts(1_690_000_000)),
        bob: memberRec('member', 'Bob', 'bob@x.com', ts(1_700_100_000)),
        sam: memberRec('member', 'Sam', 'sam@x.com', ts(1_700_000_000)),
      },
      createdAt: past, updatedAt: past, schemaVersion: 1,
    });
    useAppStore.setState({ vehicles: [sharedVehicle()] });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'v1' });
  }

  it('owner first then by join date, with name/email/role/joined (SC-SHR10-02)', async () => {
    boot();
    membersVehicle();
    const q = await render(<MembersScreen />);
    // Owner first, then Sam (earlier join) before Bob — verified via the
    // sorted order used by the Remove buttons below.
    await q.findByText('Owner');
    expect(q.getByText('Me (you)')).toBeTruthy();
    expect(q.getByText(/bob@x\.com/)).toBeTruthy();
    expect(q.getByText(/sam@x\.com/)).toBeTruthy();
    expect(q.getAllByText(/Joined \d{2}\/\d{2}\/\d{4}/).length).toBe(3);
  });

  it('the owner sees Remove + Transfer with the SD-07 wording (SC-SHR05-06, SHR-12/13)', async () => {
    boot();
    membersVehicle();
    const q = await render(<MembersScreen />);
    await fireEvent.press((await q.findAllByText('Remove'))[0]);
    await q.findByText('Remove Sam?'); // first member row after owner is Sam (earlier join)
    expect(q.getByText(/keep Drive access/)).toBeTruthy();
    await fireEvent.press(q.getByText('Cancel'));
    await fireEvent.press((await q.findAllByText('Transfer ownership'))[0]);
    await q.findByText('Make Sam the owner?');
    expect(q.getByText(/become a member/)).toBeTruthy();
    await fireEvent.press(q.getAllByText('Transfer ownership').at(-1)!); // dialog confirm
    await waitFor(() => {
      const doc = adapter.docs.get('vehicles/v1')!;
      expect(doc.ownerId).toBe('sam');
      expect((doc.members as Record<string, { role: string }>).sam.role).toBe('owner');
      expect((doc.members as Record<string, { role: string }>).me.role).toBe('member');
    });
  });

  it('a non-owner sees the list but no Remove/Transfer (SC-SHR12-03)', async () => {
    boot();
    adapter.setUser({ uid: 'bob', isAnonymous: false, displayName: 'Bob', email: 'bob@x.com' });
    useAppStore.setState({ user: adapter.currentUser() });
    membersVehicle();
    const q = await render(<MembersScreen />);
    await q.findByText('Owner');
    expect(q.queryByText('Remove')).toBeNull();
    expect(q.queryByText('Transfer ownership')).toBeNull();
  });
});

// --- Join screens (SHR-08/09) --------------------------------------------------

describe('join entry (SHR-08)', () => {
  it('normalizes the typed code and routes to /join/<CODE> (SC-SHR08-01, SD-02)', async () => {
    boot();
    const q = await render(<JoinEntry />);
    await fireEvent.changeText(q.getByLabelText('INVITE CODE'), 'k7qx m2pa');
    await fireEvent.press(q.getByText('Continue'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/join/[code]', params: { code: 'K7QXM2PA' } });
  });

  it('a malformed code shows the hint and does not navigate', async () => {
    boot();
    const q = await render(<JoinEntry />);
    await fireEvent.changeText(q.getByLabelText('INVITE CODE'), 'nope');
    await fireEvent.press(q.getByText('Continue'));
    await q.findByText('Enter the 8-character code');
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('join by code (SHR-08/09)', () => {
  function plantInvite(over: Record<string, unknown> = {}) {
    const now = adapter.now();
    adapter.docs.set('invites/K7QXM2PA', {
      vehicleId: 'v1', vehicleName: 'Swift', ownerId: 'ann', ownerName: 'Ann',
      createdBy: 'ann', createdAt: now, expiresAt: ts(now.seconds + 7 * 24 * 3600),
      schemaVersion: 1, ...over,
    });
    adapter.docs.set('vehicles/v1', {
      name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 1000,
      lastOdometer: 1000, lastOdometerAt: past,
      ownerId: 'ann', memberIds: ['ann'], members: { ann: memberRec('owner', 'Ann', 'a@x.com') },
      archived: false, createdAt: past, updatedAt: past, schemaVersion: 1,
    });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: 'K7QXM2PA' });
  }

  it('a valid invite shows the vehicle and owner names + Join (SC-SHR08-01)', async () => {
    boot();
    plantInvite();
    const q = await render(<JoinByCode />);
    await q.findByText('Swift');
    expect(q.getByText(/invited you to/)).toBeTruthy();
    expect(q.getByText('Join')).toBeTruthy();
  });

  it('joining writes the member record and shows the joined state', async () => {
    boot();
    plantInvite();
    const q = await render(<JoinByCode />);
    await fireEvent.press(await q.findByText('Join'));
    await q.findByText('You joined Swift');
    const v = adapter.docs.get('vehicles/v1')!;
    expect(v.memberIds).toContain('me');
    expect(adapter.docs.get('invites/K7QXM2PA')!.usedBy).toBe('me');
  });

  // One render per test — stacking renders with findBy* queries in a single
  // test leaves overlapping act() scopes and corrupts the later render.
  it('used invites show their own message (SC-SHR08-04)', async () => {
    boot();
    plantInvite({ usedBy: 'bob', usedAt: past });
    const q = await render(<JoinByCode />);
    await q.findByText('This invite was already used');
  });

  it('expired invites show their own message (SC-SHR08-04)', async () => {
    boot();
    const now = adapter.now();
    plantInvite({ expiresAt: ts(now.seconds - 10) });
    const q = await render(<JoinByCode />);
    await q.findByText('This invite has expired');
  });

  it('an unknown code shows the invalid message (SC-SHR08-04)', async () => {
    boot();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: 'ZZZZZZZZ' });
    const q = await render(<JoinByCode />);
    await q.findByText("That code doesn't match an invite");
  });
});
