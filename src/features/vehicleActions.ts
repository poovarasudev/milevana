// Vehicle actions used by the screens (FND-VEH-01..04). Thin orchestration
// over VehicleRepo: name-uniqueness pre-check, web write time-out, and the
// persisted "Delete didn't finish" marker (DR-14 — manual retry, survives
// restarts; no automatic resume at launch).

import { RepoError } from '../data/adapter';
import { localFlags } from '../data/localFlags';
import type { VehicleInput } from '../data/schema/vehicle';
import type { VehiclePatch, VehicleRecord } from '../data/repos/vehicleRepo';
import { useAppStore } from './appStore';
import { adapter, getRepos } from './runtime';
import { reportNonFatal } from './reporting';

/** Web writes have no durable queue — a hung write fails after 15 s (DR-18). */
export const WEB_WRITE_TIMEOUT_MS = 15_000;

export async function guardedWrite<T>(p: Promise<T>): Promise<T> {
  if (adapter().platform !== 'web') return p;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          useAppStore.setState({ online: false });
          reject(new RepoError('offline', 'web-write-timeout'));
        }, WEB_WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function vehicleNameTaken(name: string, excludeId?: string): boolean {
  const norm = name.trim().toLowerCase();
  return useAppStore
    .getState()
    .vehicles.some((v) => v.id !== excludeId && v.name.trim().toLowerCase() === norm);
}

export async function createVehicle(input: VehicleInput): Promise<string> {
  if (vehicleNameTaken(input.name)) {
    throw new RepoError('invalid-argument', 'name-taken');
  }
  return guardedWrite(getRepos().vehicles.create(input));
}

export async function updateVehicle(id: string, patch: VehiclePatch): Promise<void> {
  if (patch.name && vehicleNameTaken(patch.name, id)) {
    throw new RepoError('invalid-argument', 'name-taken');
  }
  await guardedWrite(getRepos().vehicles.update(id, patch));
}

export async function changeVehicleUnits(
  id: string,
  patch: Partial<{ odometerUnit: 'km' | 'mi' | 'hours'; currency: string; startOdometer: number }>,
): Promise<void> {
  await guardedWrite(getRepos().vehicles.changeUnits(id, patch));
}

export async function archiveVehicle(id: string): Promise<void> {
  await guardedWrite(getRepos().vehicles.archive(id));
}

export async function unarchiveVehicle(id: string): Promise<void> {
  await guardedWrite(getRepos().vehicles.unarchive(id));
}

/** Whether the typed confirmation matches the vehicle name (DR-14: trim + case). */
export function deleteNameMatches(vehicle: VehicleRecord, typed: string): boolean {
  return typed.trim().toLowerCase() === vehicle.name.trim().toLowerCase();
}

export async function deleteVehicle(id: string): Promise<void> {
  const uid = useAppStore.getState().user?.uid;
  try {
    await guardedWrite(getRepos().vehicles.delete(id));
  } catch (e) {
    if (uid) {
      const deleteFailedIds = await localFlags.markDeleteFailed(uid, id, true);
      useAppStore.setState({ deleteFailedIds });
    }
    reportNonFatal(e, { stage: 'vehicle-delete', id });
    throw e;
  }
  if (uid) {
    const deleteFailedIds = await localFlags.markDeleteFailed(uid, id, false);
    useAppStore.setState({ deleteFailedIds });
  }
}
