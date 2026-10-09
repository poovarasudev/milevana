// Drive access orchestration (DRV-04): the drive.file grant is requested
// incrementally the first time a Drive feature is used — never at sign-in.
// A one-line explanation precedes the system prompt once per device/origin;
// the 'granted' flag is stored per device keyed by uid (ED-01). Declining
// must never break the rest of the app, so every public call resolves to a
// status instead of throwing. When Google reports the grant is gone, the flag
// is cleared so the next action re-runs the permission flow with "Drive
// access was removed".

import AsyncStorage from '@react-native-async-storage/async-storage';
import { drive, DriveError } from '../data/drive/client';
import { localFlags } from '../data/localFlags';

const GRANTED = 'driveGranted';
const REVOKED = 'driveRevoked'; // set when Google reports the grant is gone
const EXPLAINED = 'mv.driveExplained'; // device-local, once per device/origin

export type DriveAccessStatus =
  | 'granted'
  | 'declined' // user dismissed the consent UI — the app keeps working
  | 'account-mismatch' // web picked a different account; message is 'Use <email>'
  | 'not-configured' // OAuth client id missing (owner-only setup)
  | 'unavailable' // network/rate-limit — try again later
  | 'unknown';

export interface DriveAccessResult {
  status: DriveAccessStatus;
  /** User-facing detail, e.g. the linked email for 'account-mismatch'. */
  message?: string;
}

/** Was the 'granted' flag stored for this uid on this device? (ED-01) */
export function isDriveGranted(uid: string): Promise<boolean> {
  return localFlags.getBool(uid, GRANTED);
}

/** True after Google reported the grant gone — the screen shows "removed". */
export function driveWasRevoked(uid: string): Promise<boolean> {
  return localFlags.getBool(uid, REVOKED);
}

/** True the first time a Drive feature is used on this device (ED-02). */
export async function shouldExplainDriveAccess(): Promise<boolean> {
  return (await AsyncStorage.getItem(EXPLAINED)) !== '1';
}

export function markDriveExplained(): Promise<void> {
  return AsyncStorage.setItem(EXPLAINED, '1');
}

/**
 * Run the interactive incremental-consent flow. `hint` is the linked Google
 * account email so the OS/browser can preselect it (ED-01). Never throws.
 */
export async function requestDriveAccess(uid: string, hint?: string): Promise<DriveAccessResult> {
  await markDriveExplained();
  try {
    await drive().requestAccess(hint);
    await localFlags.setBool(uid, GRANTED, true);
    await localFlags.setBool(uid, REVOKED, false);
    return { status: 'granted' };
  } catch (e) {
    return { status: statusFor(e), message: messageFor(e) };
  }
}

/** Map a thrown DriveError onto a status; never throws itself. */
export function statusFor(e: unknown): DriveAccessStatus {
  if (!(e instanceof DriveError)) return 'unknown';
  switch (e.code) {
    case 'access-declined':
    case 'access-revoked':
    case 'cancelled':
      return 'declined';
    case 'account-mismatch':
      return 'account-mismatch';
    case 'not-configured':
      return 'not-configured';
    case 'network':
    case 'unavailable':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

function messageFor(e: unknown): string | undefined {
  return e instanceof DriveError ? e.message : undefined;
}

/**
 * Wrap a Drive operation: translates the access failures callers must react
 * to. 'access-revoked' clears the per-uid grant flag so the next Drive action
 * re-runs the permission flow and surfaces "Drive access was removed" (ED-01).
 */
export async function withDrive<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DriveError && (e.code === 'access-revoked' || e.code === 'access-declined')) {
      await localFlags.setBool(uid, GRANTED, false);
      if (e.code === 'access-revoked') await localFlags.setBool(uid, REVOKED, true);
    }
    throw e;
  }
}
