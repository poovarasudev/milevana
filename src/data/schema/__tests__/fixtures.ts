// Valid baseline documents for every Appendix E shape; tests mutate from here.
import { Timestamp } from '../common';

export const past: Timestamp = { seconds: 1700000000, nanoseconds: 0 };
export const older: Timestamp = { seconds: 1690000000, nanoseconds: 0 };

export const vehicleDoc = {
  name: 'Swift',
  type: 'car',
  color: 'c03',
  make: 'Maruti',
  fuelTypes: ['petrol'],
  odometerUnit: 'km',
  currency: 'INR',
  startOdometer: 1000,
  lastOdometer: 1000,
  lastOdometerAt: past,
  ownerId: 'alice',
  memberIds: ['alice'],
  members: { alice: { role: 'owner', name: 'Alice', email: 'a@x.dev', joinedAt: past } },
  archived: false,
  createdAt: past,
  updatedAt: past,
  schemaVersion: 1,
};

export const entryDoc = {
  type: 'expense',
  date: past,
  odometer: 1200,
  amount: { minor: 25000, currency: 'INR' },
  notes: 'wash',
  category: 'cleaning',
  attachments: [],
  uploaderUids: [],
  createdBy: 'alice',
  createdByName: 'Alice',
  updatedBy: 'alice',
  createdAt: past,
  updatedAt: past,
  schemaVersion: 1,
};

export const fuelEntryDoc = {
  ...entryDoc,
  type: 'fuel',
  category: undefined,
  details: {
    fuelType: 'petrol',
    quantity: 32.5,
    quantityUnit: 'L',
    pricePerUnitMilli: 102500,
    fullTank: true,
    missedPrevious: false,
  },
};

export const tripEntryDoc = {
  ...entryDoc,
  type: 'trip',
  amount: undefined,
  category: undefined,
  details: {
    startAt: older, endAt: past, startOdometer: 1000, endOdometer: 1100, distance: 100,
    from: 'Home', to: 'Office', purpose: 'business',
  },
};

export const serviceEntryDoc = {
  ...entryDoc,
  type: 'service',
  amount: { minor: 120000, currency: 'INR' },
  details: {
    lines: [{ id: 'l1', serviceType: 'oil_change', costMinor: 100000 }],
    labourMinor: 30000,
    discountMinor: 10000,
  },
};

export const reminderDoc = {
  title: 'Oil change',
  subject: { kind: 'service', serviceType: 'oil_change' },
  odometerTrigger: { dueOdometer: 15000 },
  leadDays: 7,
  leadDistance: 500,
  status: 'active',
  createdBy: 'alice',
  createdAt: past,
  updatedAt: past,
  schemaVersion: 1,
};

export const templateDoc = {
  name: 'Annual check',
  items: [{ id: 'i1', label: 'Brakes' }, { id: 'i2', label: 'Lights' }],
  createdBy: 'alice',
  createdAt: past,
  updatedAt: past,
  schemaVersion: 1,
};

export const inviteDoc = {
  vehicleId: 'v1',
  vehicleName: 'Swift',
  ownerId: 'alice',
  ownerName: 'Alice',
  createdBy: 'alice',
  createdAt: past,
  expiresAt: { seconds: past.seconds + 86400, nanoseconds: 0 },
  schemaVersion: 1,
};

export const userDoc = {
  displayName: 'Alice',
  email: 'a@x.dev',
  isLinked: true,
  settings: {
    currency: 'INR',
    distanceUnit: 'km',
    volumeUnit: 'litres',
    efficiencyFormat: 'km_per_l',
    dateFormat: 'DD/MM/YYYY',
    theme: 'system',
    locale: 'en',
    backupFrequency: 'weekly',
    mutedReminderVehicleIds: [],
  },
  createdAt: past,
  schemaVersion: 1,
};
