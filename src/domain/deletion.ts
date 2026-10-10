// Account-deletion plan (VD-04/05, REL-05): pure functions over the live
// vehicle set. Owned shared vehicles default to a handoff to the
// longest-standing member; vehicles only the user drives are deleted;
// memberships on other people's vehicles are left (entries keep the name).

import type { Timestamp } from '../data/schema/common';
import type { VehicleDoc } from '../data/schema/vehicle';
import type { VehicleRecord } from '../data/repos/vehicleRepo';

/** Ordered deletion stages recorded in users/{uid}.deletion.completedSteps. */
export const DELETION_STEPS = [
  'handoffs',
  'vehicles',
  'memberships',
  'invites',
  'user',
  'account',
] as const;
export type DeletionStepName = (typeof DELETION_STEPS)[number];

export interface DeletionVehicle {
  id: string;
  name: string;
}

/** A member who can receive ownership (non-owner, sorted longest-standing). */
export interface HandoffCandidate {
  uid: string;
  name: string;
  joinedAt?: Timestamp;
}

/** A shared owned vehicle with its eligible new-owner candidates in order. */
export interface HandoffChoice {
  vehicle: DeletionVehicle;
  candidates: HandoffCandidate[];
}

export interface DeletionPlan {
  /** Owned and shared — the user picks a new owner per vehicle, or delete. */
  handoffs: HandoffChoice[];
  /** Owned with no other members — deleted outright. */
  deletes: DeletionVehicle[];
  /** Vehicles owned by someone else — the user leaves. */
  leaves: DeletionVehicle[];
}

const tsMs = (t?: Timestamp): number => (t ? t.seconds * 1000 + t.nanoseconds / 1e6 : Infinity);

/**
 * VD-05: default new owner is the non-owner member with the earliest
 * joinedAt; ties go to the smallest uid. Members without a joinedAt sort
 * last. The list order is the fallback order when the first member leaves.
 */
export function memberCandidates(
  vehicle: Pick<VehicleDoc, 'memberIds' | 'members'>,
  excludeUid: string,
): HandoffCandidate[] {
  const out: HandoffCandidate[] = [];
  for (const uid of vehicle.memberIds) {
    if (uid === excludeUid) continue;
    const m = vehicle.members[uid];
    if (!m) continue;
    out.push({ uid, name: m.name ?? '', joinedAt: m.joinedAt });
  }
  out.sort((a, b) => tsMs(a.joinedAt) - tsMs(b.joinedAt) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

/** Build the plan shown on the summary screen and used to drive the run. */
export function buildDeletionPlan(uid: string, vehicles: VehicleRecord[]): DeletionPlan {
  const handoffs: HandoffChoice[] = [];
  const deletes: DeletionVehicle[] = [];
  const leaves: DeletionVehicle[] = [];
  for (const v of vehicles) {
    const info: DeletionVehicle = { id: v.id, name: v.name };
    if (v.ownerId === uid) {
      const candidates = memberCandidates(v, uid);
      if (candidates.length > 0) handoffs.push({ vehicle: info, candidates });
      else deletes.push(info);
    } else if (v.memberIds.includes(uid)) {
      leaves.push(info);
    }
  }
  const byName = (a: DeletionVehicle, b: DeletionVehicle) => a.name.localeCompare(b.name);
  handoffs.sort((a, b) => byName(a.vehicle, b.vehicle));
  deletes.sort(byName);
  leaves.sort(byName);
  return { handoffs, deletes, leaves };
}

/** True when the plan leaves nothing to delete, hand off or leave. */
export function isPlanEmpty(plan: DeletionPlan): boolean {
  return plan.handoffs.length === 0 && plan.deletes.length === 0 && plan.leaves.length === 0;
}
