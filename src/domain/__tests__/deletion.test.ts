// REL-05 / SC-REL05-01 — the deletion plan: shared owned vehicles hand off to
// the longest-standing member, unshared owned vehicles are deleted,
// memberships on other people's vehicles are left (VD-04/05).

import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { buildDeletionPlan, isPlanEmpty, memberCandidates } from '../deletion';

const ts = (seconds: number) => ({ seconds, nanoseconds: 0 });

function vehicle(
  id: string,
  name: string,
  ownerId: string,
  members: [uid: string, joinedAtSeconds?: number][],
  archived = false,
): VehicleRecord {
  return {
    id, pending: false, name, archived,
    type: 'car', color: 'c01', fuelTypes: ['petrol'], odometerUnit: 'km',
    currency: 'INR', startOdometer: 0, lastOdometer: 0, lastOdometerAt: ts(1),
    ownerId,
    memberIds: members.map(([uid]) => uid),
    members: Object.fromEntries(
      members.map(([uid, j]) => [
        uid,
        { role: uid === ownerId ? 'owner' : 'member', name: `${uid} name`, ...(j !== undefined ? { joinedAt: ts(j) } : {}) },
      ]),
    ),
    createdAt: ts(1), updatedAt: ts(1), updatedBy: ownerId, schemaVersion: 1,
  } as VehicleRecord;
}

describe('memberCandidates (VD-05)', () => {
  it('orders by earliest joinedAt, ties to the smallest uid, missing joinedAt last', () => {
    const v = vehicle('v', 'Car', 'me', [
      ['me', 1],
      ['m-late', 300],
      ['m-none'],
      ['m-early', 100],
      ['a-tie', 100],
    ]);
    const c = memberCandidates(v, 'me');
    expect(c.map((x) => x.uid)).toEqual(['a-tie', 'm-early', 'm-late', 'm-none']);
  });

  it('excludes the deleting user even when they are not the owner record', () => {
    const v = vehicle('v', 'Car', 'other', [['other', 1], ['me', 2], ['m3', 3]]);
    expect(memberCandidates(v, 'me').map((x) => x.uid)).toEqual(['other', 'm3']);
  });
});

describe('buildDeletionPlan (SC-REL05-01)', () => {
  it('shared owned → handoff with the longest-standing member first; unshared → delete; foreign → leave', () => {
    const plan = buildDeletionPlan('me', [
      vehicle('a', 'Shared car', 'me', [['me', 1], ['m1', 10], ['m2', 20]]),
      vehicle('b', 'My bike', 'me', [['me', 1]]),
      vehicle('c', 'Family van', 'dad', [['dad', 1], ['me', 5]]),
    ]);
    expect(plan.handoffs).toHaveLength(1);
    expect(plan.handoffs[0]!.vehicle).toEqual({ id: 'a', name: 'Shared car' });
    expect(plan.handoffs[0]!.candidates.map((c) => c.uid)).toEqual(['m1', 'm2']);
    expect(plan.deletes).toEqual([{ id: 'b', name: 'My bike' }]);
    expect(plan.leaves).toEqual([{ id: 'c', name: 'Family van' }]);
  });

  it('an owned vehicle whose only other member entry is stale counts as delete', () => {
    // memberIds lists a ghost member with no members record — no eligible target.
    const v = vehicle('v', 'Ghost car', 'me', [['me', 1]]);
    v.memberIds.push('ghost');
    const plan = buildDeletionPlan('me', [v]);
    expect(plan.deletes.map((d) => d.id)).toEqual(['v']);
    expect(plan.handoffs).toHaveLength(0);
  });

  it('archived vehicles still appear — archived state is kept through handoff (VD-05)', () => {
    const plan = buildDeletionPlan('me', [
      vehicle('arch', 'Old car', 'me', [['me', 1], ['m1', 10]], true),
    ]);
    expect(plan.handoffs.map((h) => h.vehicle.id)).toEqual(['arch']);
  });

  it('vehicles the user does not belong to are ignored entirely', () => {
    const plan = buildDeletionPlan('me', [
      vehicle('x', 'Not mine', 'other', [['other', 1], ['m2', 2]]),
    ]);
    expect(isPlanEmpty(plan)).toBe(true);
  });

  it('sorts each bucket by vehicle name for a stable summary', () => {
    const plan = buildDeletionPlan('me', [
      vehicle('z', 'Zed shared', 'me', [['me', 1], ['m', 2]]),
      vehicle('a', 'Alpha shared', 'me', [['me', 1], ['m', 2]]),
      vehicle('b2', 'Beta solo', 'me', [['me', 1]]),
      vehicle('b1', 'Alpha solo', 'me', [['me', 1]]),
    ]);
    expect(plan.handoffs.map((h) => h.vehicle.name)).toEqual(['Alpha shared', 'Zed shared']);
    expect(plan.deletes.map((d) => d.name)).toEqual(['Alpha solo', 'Beta solo']);
  });

  it('a vehicle I own with members who all left me last is still a handoff', () => {
    // The remaining members are candidates even when their joinedAt is missing.
    const v = vehicle('v', 'Handover', 'me', [['me', 1], ['m1'], ['m2', 5]]);
    const plan = buildDeletionPlan('me', [v]);
    expect(plan.handoffs[0]!.candidates.map((c) => c.uid)).toEqual(['m2', 'm1']);
  });
});

describe('isPlanEmpty', () => {
  it('is true only when all three buckets are empty', () => {
    expect(isPlanEmpty({ handoffs: [], deletes: [], leaves: [] })).toBe(true);
    expect(isPlanEmpty(buildDeletionPlan('me', [vehicle('v', 'v', 'me', [['me', 1]])]))).toBe(false);
  });
});
