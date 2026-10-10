// Invite + membership orchestration (SHR-06/07/08, SD-01..07). Thin layer
// over the repos: code generation with collision retry, the 5-pending cap,
// the link gate ahead of create/join, join-state mapping for the screen,
// and leave/remove/transfer with selection fix-up.

import * as Crypto from 'expo-crypto';
import { Share } from 'react-native';
import { RepoError } from '../data/adapter';
import type { InviteRecord } from '../data/repos/inviteRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import {
  codeFromBytes, displayCode, inviteLink, inviteState, INVITE_CODE_LENGTH,
  looksLikeCode, MAX_PENDING_INVITES, normalizeCode,
} from '../domain/invites';
import { t } from '../i18n';
import { useAppStore } from './appStore';
import { requireLinkedAccount } from './linkPrompt';
import { adapter, getRepos } from './runtime';
import { selectVehicle } from './session';
import { guardedWrite } from './vehicleActions';

/** A fresh 8-char code from the platform's secure random source (SD-02). */
export async function newInviteCode(): Promise<string> {
  return codeFromBytes(await Crypto.getRandomBytesAsync(INVITE_CODE_LENGTH));
}

/** A code collision regenerates at most this many times (SD-02). */
export const INVITE_CREATE_RETRIES = 5;

export interface ShareState {
  /** Every invite the owner created for this vehicle, newest first. */
  invites: InviteRecord[];
  /** Only invites that are still usable right now. */
  pending: InviteRecord[];
  /** Unused invites past their expiry (owner may cancel to clear the list). */
  expired: InviteRecord[];
  memberCount: number;
  canInvite: boolean;
  /** Why Invite is disabled: 'limit' (5 pending) | 'full' (10 members). */
  blocked?: 'limit' | 'full';
}

/** Owner-side share screen data (SHR-07): invites + the member count. */
export async function loadShareState(vehicle: VehicleRecord): Promise<ShareState> {
  const now = adapter().now();
  const all = await getRepos().invites.listForVehicle(vehicle.id);
  const invites = all
    .filter((i) => !i.usedBy)
    .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
  const pending = invites.filter((i) => inviteState(i, vehicle.memberIds.length, now) === 'valid');
  const expired = invites.filter((i) => inviteState(i, vehicle.memberIds.length, now) === 'expired');
  const memberCount = vehicle.memberIds.length;
  const blocked =
    memberCount >= 10 ? 'full' : pending.length >= MAX_PENDING_INVITES ? 'limit' : undefined;
  return { invites, pending, expired, memberCount, canInvite: blocked === undefined, blocked };
}

/**
 * Create an invite for a vehicle the caller owns. Anonymous users go through
 * the link flow first (FR-LINK-03); a cancelled gate throws 'cancelled'.
 * Throws 'resource-exhausted'/'invite-limit' past 5 pending invites and
 * 'invalid-argument'/'full' at 10 members.
 */
export async function createInvite(vehicle: VehicleRecord): Promise<InviteRecord> {
  const gate = await requireLinkedAccount();
  if (gate !== 'linked') throw new RepoError('cancelled', 'link-declined');
  const state = await loadShareState(vehicle);
  if (state.blocked === 'full') throw new RepoError('invalid-argument', 'full');
  if (state.blocked === 'limit') throw new RepoError('resource-exhausted', 'invite-limit');
  for (let attempt = 0; attempt < INVITE_CREATE_RETRIES; attempt++) {
    const code = await newInviteCode();
    try {
      return await guardedWrite(getRepos().invites.create(vehicle, code));
    } catch (e) {
      // set() on a taken code is a denied update — try a fresh code (SD-02).
      if (
        e instanceof RepoError && e.code === 'permission-denied' &&
        attempt < INVITE_CREATE_RETRIES - 1
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new RepoError('unknown', 'invite-create');
}

export async function cancelInvite(code: string): Promise<void> {
  await guardedWrite(getRepos().invites.cancel(code));
}

/**
 * Send the invite through the platform's share path (SHR-07, SD-11): the
 * Android share sheet on native, the browser share sheet where available,
 * else the link is copied to the clipboard.
 */
export async function shareInvite(
  code: string,
  vehicleName: string,
): Promise<'shared' | 'copied' | 'failed'> {
  const link = inviteLink(code);
  const message = t('invite.shareBody', {
    vehicle: vehicleName,
    code: displayCode(code),
    link,
  });
  try {
    if (adapter().platform === 'web') {
      const nav = globalThis.navigator;
      if (nav?.share) {
        await nav.share({ text: message, url: link });
        return 'shared';
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(link);
        return 'copied';
      }
      return 'failed';
    }
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}

// --- join ------------------------------------------------------------------

export type InviteLookup =
  | { status: 'valid'; invite: InviteRecord }
  | { status: 'archived'; invite: InviteRecord } // vehicle archived (distinct message)
  | { status: 'invalid' } // bad code / no such invite
  | { status: 'used'; invite: InviteRecord }
  | { status: 'expired'; invite: InviteRecord }
  | { status: 'gone' } // invite exists, vehicle deleted → "no longer exists"
  | { status: 'member'; vehicleId: string } // caller already belongs
  | { status: 'offline' }
  | { status: 'error' };

/** Read an invite by typed input and classify it for the join screen. */
export async function lookupInvite(input: string): Promise<InviteLookup> {
  const code = normalizeCode(input);
  if (!looksLikeCode(code)) return { status: 'invalid' };
  const st = useAppStore.getState();
  if (!st.online) return { status: 'offline' };
  let invite: InviteRecord | null;
  try {
    invite = await getRepos().invites.get(code);
  } catch (e) {
    if (e instanceof RepoError) {
      if (e.code === 'permission-denied') return { status: 'gone' };
      if (e.code === 'unavailable' || e.code === 'offline') return { status: 'offline' };
    }
    return { status: 'error' };
  }
  if (!invite) return { status: 'invalid' };
  const uid = st.user?.uid;
  if (uid && st.vehicles.some((v) => v.id === invite!.vehicleId && v.memberIds.includes(uid))) {
    return { status: 'member', vehicleId: invite.vehicleId };
  }
  if (invite.usedBy) return { status: 'used', invite };
  if (invite.expiresAt.seconds <= adapter().now().seconds) return { status: 'expired', invite };
  if (invite.vehicleArchived) return { status: 'archived', invite };
  return { status: 'valid', invite };
}

/** Reasons a join write can still fail after a 'valid' lookup. */
export type JoinFailure =
  | 'used' | 'expired' | 'full' | 'archived' | 'invalid' | 'gone'
  | 'offline' | 'cancelled' | 'error';

export class JoinError extends Error {
  constructor(public reason: JoinFailure) {
    super(`join:${reason}`);
    this.name = 'JoinError';
  }
}

/**
 * Join the vehicle this invite points to. Anonymous users are walked through
 * linking first — including the conflict path — and the pending join then
 * completes with the Google uid (SD-04). Resolves the joined vehicle id and
 * selects it; throws JoinError for every user-visible failure.
 */
export async function joinWithInvite(invite: InviteRecord): Promise<string> {
  const st = useAppStore.getState();
  if (!st.online) throw new JoinError('offline');
  const uid = st.user?.uid;
  if (uid && st.vehicles.some((v) => v.id === invite.vehicleId && v.memberIds.includes(uid))) {
    await selectVehicle(invite.vehicleId);
    return invite.vehicleId;
  }
  const gate = await requireLinkedAccount();
  if (gate !== 'linked') throw new JoinError('cancelled');
  // The session may have swapped (conflict → Switch): read the user fresh.
  const user = adapter().currentUser();
  if (!user || user.isAnonymous) throw new JoinError('cancelled');
  try {
    const vehicleId = await guardedWrite(
      getRepos().invites.join(invite, {
        name: user.displayName ?? user.email ?? 'Me',
        email: user.email ?? '',
      }),
    );
    await selectVehicle(vehicleId);
    return vehicleId;
  } catch (e) {
    if (!(e instanceof RepoError)) throw new JoinError('error');
    if (e.code === 'offline' || e.code === 'unavailable') throw new JoinError('offline');
    if (e.code !== 'permission-denied') throw new JoinError('error');
    // Denied — re-read the invite to say why (used / expired / full / gone).
    const again = await lookupInvite(invite.code);
    switch (again.status) {
      case 'gone': throw new JoinError('gone');
      case 'used': throw new JoinError('used');
      case 'expired': throw new JoinError('expired');
      case 'archived': throw new JoinError('archived');
      case 'invalid': throw new JoinError('invalid'); // invite cancelled mid-join
      case 'offline': throw new JoinError('offline');
      default:
        // Still pending but denied: the vehicle is at 10 members or was
        // archived between reads — both mean "no room" (SHR-08 full).
        throw new JoinError('full');
    }
  }
}

// --- membership ------------------------------------------------------------

/** A member leaves a shared vehicle; another vehicle is selected (SHR-11). */
export async function leaveVehicle(vehicle: VehicleRecord): Promise<void> {
  const uid = useAppStore.getState().user?.uid;
  if (!uid) throw new RepoError('permission-denied', 'not signed in');
  if (vehicle.ownerId === uid) {
    throw new RepoError('invalid-argument', 'owner-must-transfer');
  }
  await guardedWrite(getRepos().vehicles.leave(vehicle.id));
  // The vehicle leaves the list on the next watch event; drop the selection
  // now so the UI doesn't sit on a vehicle the user just left.
  if (useAppStore.getState().selectedVehicleId === vehicle.id) {
    const next = useAppStore
      .getState()
      .vehicles.find((v) => v.id !== vehicle.id && !v.archived);
    await selectVehicle(next?.id ?? '');
  }
}

/** The owner removes a member (SHR-12). */
export async function removeMember(vehicle: VehicleRecord, memberUid: string): Promise<void> {
  await guardedWrite(getRepos().vehicles.removeMember(vehicle.id, memberUid));
}

/** The owner hands the vehicle to another member (SHR-13). */
export async function transferOwnership(vehicle: VehicleRecord, newOwnerUid: string): Promise<void> {
  await guardedWrite(getRepos().vehicles.transferOwnership(vehicle.id, newOwnerUid));
}
