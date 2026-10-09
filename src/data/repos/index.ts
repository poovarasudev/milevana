// Aggregate factory: one Repos instance per FirebaseAdapter.

import type { FirebaseAdapter } from '../adapter';
import { EntryRepo } from './entryRepo';
import { InviteRepo } from './inviteRepo';
import { MalformedReporter } from './base';
import { ReminderRepo } from './reminderRepo';
import { TemplateRepo } from './templateRepo';
import { UserRepo } from './userRepo';
import { VehicleRepo } from './vehicleRepo';

export interface Repos {
  users: UserRepo;
  vehicles: VehicleRepo;
  entries: EntryRepo;
  reminders: ReminderRepo;
  templates: TemplateRepo;
  invites: InviteRepo;
}

export function createRepos(adapter: FirebaseAdapter, reportMalformed?: MalformedReporter): Repos {
  return {
    users: new UserRepo(adapter, reportMalformed),
    vehicles: new VehicleRepo(adapter, reportMalformed),
    entries: new EntryRepo(adapter, reportMalformed),
    reminders: new ReminderRepo(adapter, reportMalformed),
    templates: new TemplateRepo(adapter, reportMalformed),
    invites: new InviteRepo(adapter, reportMalformed),
  };
}

export { RepoError, SERVER_TIMESTAMP } from '../adapter';
export type { FirebaseAdapter } from '../adapter';
export type { MalformedDocInfo, MalformedReporter } from './base';
export { EntryRepo } from './entryRepo';
export { InviteRepo } from './inviteRepo';
export { ReminderRepo } from './reminderRepo';
export { TemplateRepo } from './templateRepo';
export { UserRepo, USER_DEFAULTS } from './userRepo';
export { VehicleRepo } from './vehicleRepo';
export type { EntryInput, EntryPatch, EntryRecord } from './entryRepo';
export type { ReminderInput, ReminderPatch, ReminderRecord } from './reminderRepo';
export type { TemplateInput, TemplatePatch, TemplateRecord } from './templateRepo';
export type { VehiclePatch } from './vehicleRepo';
export type { EnsureUserOptions } from './userRepo';
