// Invite-code domain rules (SHR-04/06, SD-02/05): the 8-character code from an
// unambiguous alphabet, the XXXX-XXXX display form, typed-input normalization
// and invite validity states for the UI.

import type { Timestamp } from '../data/schema/common';
import type { InviteDoc } from '../data/schema/invite';
import type { VehicleDoc } from '../data/schema/vehicle';

/** No 0, O, 1, I or L (SD-02). 31 symbols ≈ 4.95 bits per character. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
/** Pending invites per vehicle are app-enforced (SD-05); rules can't count. */
export const MAX_PENDING_INVITES = 5;
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

/** Map random bytes onto the alphabet. Pass at least INVITE_CODE_LENGTH bytes. */
export function codeFromBytes(bytes: Uint8Array | number[]): string {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
}

/** Display form: K7QM-2XPA. */
export function displayCode(code: string): string {
  const c = normalizeCode(code);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Typed entry ignores case, hyphens and spaces (SD-02). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, '');
}

export function looksLikeCode(input: string): boolean {
  const c = normalizeCode(input);
  return (
    c.length === INVITE_CODE_LENGTH &&
    [...c].every((ch) => INVITE_ALPHABET.includes(ch))
  );
}

/** The share URL; the link carries the plain uppercase code, no hyphen (SD-02). */
export function inviteLink(code: string): string {
  return `https://milevana.poovarasu.dev/join/${normalizeCode(code)}`;
}

export type InviteState = 'valid' | 'used' | 'expired' | 'full';

/**
 * Classify an invite for the UI (SC-SHR06-03). `memberCount` is the vehicle's
 * current memberIds size when known (owner side); pass null when the caller
 * cannot see the vehicle (joiner) — 'full' is then only detected at join time.
 */
export function inviteState(
  invite: Pick<InviteDoc, 'usedBy' | 'expiresAt'>,
  memberCount: number | null,
  now: Timestamp,
): InviteState {
  if (invite.usedBy) return 'used';
  if (invite.expiresAt.seconds <= now.seconds) return 'expired';
  if (memberCount !== null && memberCount >= 10) return 'full';
  return 'valid';
}

/** Owner-side convenience: pending = created by this owner for this vehicle. */
export function isPending(invite: InviteDoc, now: Timestamp): boolean {
  return inviteState(invite, null, now) === 'valid';
}

/** Members sorted per SD-10: owner first, then by join date. */
export function sortedMembers(vehicle: Pick<VehicleDoc, 'ownerId' | 'members' | 'memberIds'>): {
  uid: string;
  role: 'owner' | 'member';
  name?: string;
  email?: string;
  joinedAt?: Timestamp;
}[] {
  return vehicle.memberIds
    .map((uid) => ({ uid, ...(vehicle.members[uid] ?? { role: 'member' as const }) }))
    .sort((a, b) => {
      if ((a.role === 'owner') !== (b.role === 'owner')) return a.role === 'owner' ? -1 : 1;
      return (a.joinedAt?.seconds ?? 0) - (b.joinedAt?.seconds ?? 0);
    });
}
