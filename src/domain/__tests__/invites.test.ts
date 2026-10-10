// SC-SHR06-01/03 — invite codes: alphabet, length, display form, input
// normalization, validity states and member sorting (SD-02/05/10).

import {
  codeFromBytes, displayCode, INVITE_ALPHABET, INVITE_CODE_LENGTH, inviteLink,
  inviteState, isPending, looksLikeCode, normalizeCode, sortedMembers,
} from '../invites';
import type { InviteDoc } from '../../data/schema/invite';

const ts = (seconds: number) => ({ seconds, nanoseconds: 0 });

describe('codeFromBytes', () => {
  it('produces 8 characters from the unambiguous alphabet', () => {
    const code = codeFromBytes([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const ch of code) expect(INVITE_ALPHABET).toContain(ch);
  });

  it('maps each byte mod the alphabet size onto the alphabet', () => {
    const n = INVITE_ALPHABET.length;
    const code = codeFromBytes([0, 1, 31, 32, 33, 63, 64, 255]);
    const expectIdx = [0, 1, 31, 32, 33, 63, 64, 255].map((b) => b % n);
    expect(code).toBe(expectIdx.map((i) => INVITE_ALPHABET[i]).join(''));
  });

  it('never contains 0, O, 1, I or L (SC-SHR06-01)', () => {
    for (let b = 0; b < 256; b += 17) {
      const code = codeFromBytes([b, b, b, b, b, b, b, b]);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });
});

describe('normalization and display (SD-02)', () => {
  it("'k7qx m2pa', 'K7QX-M2PA' and 'K7QXM2PA' all normalize the same", () => {
    for (const input of ['k7qx m2pa', 'K7QX-M2PA', 'K7QXM2PA', ' k7qx-m2pa ']) {
      expect(normalizeCode(input)).toBe('K7QXM2PA');
    }
  });

  it('displayCode renders XXXX-XXXX', () => {
    expect(displayCode('K7QXM2PA')).toBe('K7QX-M2PA');
    expect(displayCode('k7qx-m2pa')).toBe('K7QX-M2PA');
  });

  it('looksLikeCode validates length and alphabet', () => {
    expect(looksLikeCode('K7QX-M2PA')).toBe(true);
    expect(looksLikeCode('K7QXM2PA')).toBe(true);
    expect(looksLikeCode('K7QXM2P')).toBe(false); // short
    expect(looksLikeCode('K7QXM2PA9')).toBe(false); // long
    expect(looksLikeCode('K7QXM2P0')).toBe(false); // 0 not in alphabet
    expect(looksLikeCode('K7QXM2PI')).toBe(false); // I not in alphabet
    expect(looksLikeCode('')).toBe(false);
  });

  it('inviteLink carries the plain uppercase code (SD-02)', () => {
    expect(inviteLink('k7qx-m2pa')).toBe('https://milevana.poovarasu.dev/join/K7QXM2PA');
  });
});

describe('inviteState (SC-SHR06-03)', () => {
  const base: Pick<InviteDoc, 'usedBy' | 'expiresAt'> = {
    expiresAt: ts(2000),
  };

  it('valid when unused, unexpired and under 10 members', () => {
    expect(inviteState(base, 3, ts(1000))).toBe('valid');
    expect(inviteState(base, null, ts(1000))).toBe('valid');
  });

  it('used wins over expired', () => {
    expect(inviteState({ ...base, usedBy: 'u' }, 1, ts(3000))).toBe('used');
  });

  it('expired when expiresAt <= now', () => {
    expect(inviteState(base, 1, ts(2000))).toBe('expired');
  });

  it('full at 10 members when the count is known', () => {
    expect(inviteState(base, 10, ts(1000))).toBe('full');
    expect(inviteState(base, null, ts(1000))).toBe('valid'); // joiner can't count
  });

  it('isPending is the owner-side shortcut', () => {
    const inv = { ...base } as InviteDoc;
    expect(isPending(inv, ts(1000))).toBe(true);
    expect(isPending({ ...inv, usedBy: 'u' }, ts(1000))).toBe(false);
  });
});

describe('sortedMembers (SD-10)', () => {
  it('owner first, then members by join date', () => {
    const v = {
      ownerId: 'o',
      memberIds: ['o', 'm2', 'm1'],
      members: {
        o: { role: 'owner' as const, joinedAt: ts(100) },
        m1: { role: 'member' as const, joinedAt: ts(300) },
        m2: { role: 'member' as const, joinedAt: ts(200) },
      },
    };
    expect(sortedMembers(v).map((m) => m.uid)).toEqual(['o', 'm2', 'm1']);
  });
});
