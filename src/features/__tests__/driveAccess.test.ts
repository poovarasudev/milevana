// DRV-04 / SC-DRV03-03/04: incremental consent stores the grant per uid,
// explain-once per device, decline/unknown map to statuses without throwing,
// and a revoked grant clears the flag + sets the 'removed' notice (ED-01/02).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DriveError, resetDriveForTests, setDriveFactory } from '../../data/drive/client';
import {
  driveWasRevoked, isDriveGranted, requestDriveAccess, shouldExplainDriveAccess,
  statusFor, withDrive,
} from '../driveAccess';
import { FakeDriveClient } from './fakeDrive';

let client: FakeDriveClient;
const uid = 'u1';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveForTests();
  client = new FakeDriveClient();
  setDriveFactory(() => client);
});

describe('requestDriveAccess', () => {
  it('grants, stores the flag per uid and marks the explanation shown', async () => {
    expect(await isDriveGranted(uid)).toBe(false);
    expect(await shouldExplainDriveAccess()).toBe(true);
    const res = await requestDriveAccess(uid, 'linked@x.com');
    expect(res.status).toBe('granted');
    expect(client.accessHints).toEqual(['linked@x.com']);
    expect(await isDriveGranted(uid)).toBe(true);
    expect(await shouldExplainDriveAccess()).toBe(false);
    // The flag is per uid (ED-01).
    expect(await isDriveGranted('other')).toBe(false);
  });

  it('decline resolves a status and never throws (SC-DRV04-03)', async () => {
    client.failNext.access = new DriveError('access-declined');
    const res = await requestDriveAccess(uid);
    expect(res.status).toBe('declined');
    expect(await isDriveGranted(uid)).toBe(false);
  });

  it('maps account-mismatch with the message for "Use <email>"', async () => {
    client.failNext.access = new DriveError('account-mismatch', 'other@x.com');
    const res = await requestDriveAccess(uid);
    expect(res.status).toBe('account-mismatch');
    expect(res.message).toBe('other@x.com');
  });

  it('maps missing OAuth config to not-configured', async () => {
    client.failNext.access = new DriveError('not-configured');
    expect((await requestDriveAccess(uid)).status).toBe('not-configured');
  });
});

describe('withDrive', () => {
  it('clears the grant and records the revoked notice on access-revoked (ED-01)', async () => {
    await requestDriveAccess(uid);
    await expect(
      withDrive(uid, async () => { throw new DriveError('access-revoked'); }),
    ).rejects.toMatchObject({ code: 'access-revoked' });
    expect(await isDriveGranted(uid)).toBe(false);
    expect(await driveWasRevoked(uid)).toBe(true);
    // Re-granting clears the notice.
    await requestDriveAccess(uid);
    expect(await driveWasRevoked(uid)).toBe(false);
  });

  it('passes other errors through untouched', async () => {
    await requestDriveAccess(uid);
    await expect(withDrive(uid, async () => { throw new DriveError('network'); })).rejects.toMatchObject({ code: 'network' });
    expect(await isDriveGranted(uid)).toBe(true); // not cleared for transient errors
  });
});

describe('statusFor', () => {
  it.each([
    ['access-declined', 'declined'], ['access-revoked', 'declined'], ['cancelled', 'declined'],
    ['account-mismatch', 'account-mismatch'], ['not-configured', 'not-configured'],
    ['network', 'unavailable'], ['unavailable', 'unavailable'], ['unknown', 'unknown'],
  ] as const)('maps %s → %s', (code, status) => {
    expect(statusFor(new DriveError(code))).toBe(status);
  });
  it('maps non-Drive errors to unknown', () => {
    expect(statusFor(new Error('x'))).toBe('unknown');
  });
});
