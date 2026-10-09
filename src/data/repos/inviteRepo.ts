// invites/{code} — read-only in Foundation; every invite write path is denied
// by the rules (FND-SEC-03 / FR-SEC-09). The repo still validates reads so a
// leaked document can never flow unparsed into the app.

import { InviteDoc, inviteDocSchema } from '../schema/invite';
import { RepoBase } from './base';

export class InviteRepo extends RepoBase {

  /** Will surface permission-denied while Foundation rules are in force. */
  async get(code: string): Promise<InviteDoc | null> {
    const path = `invites/${code}`;
    const snap = await this.adapter.getDoc(path);
    if (!snap.exists) return null;
    return this.parse('invites', inviteDocSchema, snap, path);
  }
}
