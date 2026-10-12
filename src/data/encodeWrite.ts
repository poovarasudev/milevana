// Shared write-time value encoder for the platform adapters. The platform
// pieces (server timestamp sentinel, arrayUnion, Timestamp constructor) are
// injected so this file stays SDK-free and unit-testable.
//
// Zod keeps absent optional fields as `key: undefined`; Firestore rejects
// undefined values, so the encoder strips them — undefined means "field
// absent". (Regression: vehicle create died client-side with a FirebaseError
// before reaching the server because `make: undefined` was written.)

import { isArrayUnion, SERVER_TIMESTAMP } from './adapter';
import type { Timestamp as DomainTimestamp } from './schema/common';

export interface WriteEncoders {
  serverTimestamp: () => unknown;
  arrayUnion: (...elements: unknown[]) => unknown;
  timestamp: (seconds: number, nanoseconds: number) => unknown;
}

// Domain timestamps are plain { seconds, nanoseconds } objects; on write they
// become platform Timestamp instances, and SERVER_TIMESTAMP becomes the
// server sentinel.
function isTimestampLike(v: unknown): v is DomainTimestamp {
  return (
    typeof v === 'object' && v !== null &&
    Number.isInteger((v as DomainTimestamp).seconds) &&
    Number.isInteger((v as DomainTimestamp).nanoseconds) &&
    Object.keys(v as object).length === 2
  );
}

export function makeWriteEncoder(enc: WriteEncoders): (data: unknown) => unknown {
  const encodeWriteData = (data: unknown): unknown => {
    if (data === SERVER_TIMESTAMP) return enc.serverTimestamp();
    if (isArrayUnion(data)) return enc.arrayUnion(...data.__milevanaArrayUnion.map(encodeWriteData));
    if (isTimestampLike(data)) return enc.timestamp(data.seconds, data.nanoseconds);
    if (Array.isArray(data)) return data.map(encodeWriteData);
    if (typeof data === 'object' && data !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) if (v !== undefined) out[k] = encodeWriteData(v);
      return out;
    }
    return data;
  };
  return encodeWriteData;
}
