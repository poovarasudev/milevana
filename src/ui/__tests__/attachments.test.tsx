// DRV-11/12/13 component coverage: status labels per attachment state, add
// actions (camera/gallery/pdf native, single file picker on web), the
// 5-attachment cap hiding add buttons, remove/retry callbacks, and read-only
// mode hiding mutation controls. Fixtures use PDFs or non-uploaded images —
// an uploaded image row fetches a thumbnail asynchronously, which would leak
// a setState across tests (overlapping act() in RTL v14).
//
// Thumbnail fetching itself is covered by receiptSource tests in
// features/__tests__/receipts.test.ts.

import { render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { setFirebaseFactory, resetFirebaseForTests } from '../../data/firebase';
import { resetRuntimeForTests } from '../../features/runtime';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { initI18n } from '../../i18n';
import type { AttachmentDoc } from '../../data/schema/entry';
import type { EntryRecord } from '../../data/repos/entryRepo';
import type { PendingReceipt } from '../../features/receipts';
import { AttachmentsSection } from '../entry/AttachmentsSection';

const uid = 'me';
const ts = { seconds: 1, nanoseconds: 0 };

const att = (id: string, over: Partial<AttachmentDoc> = {}): AttachmentDoc => ({
  id, ownerUid: uid, mimeType: 'application/pdf', sizeBytes: 10,
  status: 'uploaded', driveFileId: `d-${id}`, sharedWithUids: [], ...over,
});

const entryRecord: EntryRecord = {
  id: 'e1', type: 'expense', date: ts, createdAt: ts, updatedAt: ts,
  createdBy: uid, createdByName: 'Me', updatedBy: uid,
  attachments: [], uploaderUids: [], schemaVersion: 1, pending: false,
} as EntryRecord;

const pending = (id: string, over: Partial<PendingReceipt> = {}): PendingReceipt => ({
  id, mimeType: 'application/pdf', sizeBytes: 10, status: 'queued', uri: `file:///${id}.pdf`, ...over,
});

let adapter: FakeAdapter;

// fireEvent.press's act() wrapping overlaps in RTL v14 and corrupts later
// renders; our handlers are plain jest mocks so invoking the mapped onClick
// directly is equivalent.
function press(el: TestInstance): void {
  let cur: TestInstance | null = el;
  while (cur && typeof cur.props.onClick !== 'function' && typeof cur.props.onPress !== 'function') {
    cur = cur.parent;
  }
  const fn = cur?.props.onClick ?? cur?.props.onPress;
  if (typeof fn !== 'function') throw new Error('no pressable element/ancestor');
  fn();
}

async function renderSection(over: Partial<Parameters<typeof AttachmentsSection>[0]> = {}) {
  const props = {
    uid, vehicleId: 'v1', entry: entryRecord,
    attachments: [] as AttachmentDoc[], pendings: [] as PendingReceipt[],
    onAdd: jest.fn(), onRemoveExisting: jest.fn(), onRemovePending: jest.fn(), onRetry: jest.fn(),
    ...over,
  };
  return { props, q: await render(<AttachmentsSection {...props} />) };
}

beforeAll(() => initI18n('en'));

beforeEach(() => {
  resetRuntimeForTests();
  resetFirebaseForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Me', email: null };
  setFirebaseFactory(() => adapter);
});

describe('AttachmentsSection', () => {
  it('renders saved attachments with their status labels', async () => {
    const { q } = await renderSection({
      attachments: [
        att('a1', { status: 'queued' }),
        att('a2', { status: 'failed' }),
        att('a3', { status: 'missing' }),
        att('a4'),
      ],
    });
    expect(q.getAllByText('Waiting to upload').length).toBe(1);
    expect(q.getAllByText("Couldn't upload").length).toBe(1);
    expect(q.getAllByText('File no longer in Drive').length).toBe(1);
  });

  it('shows pending picked receipts with a waiting label', async () => {
    const { q } = await renderSection({ pendings: [pending('p1'), pending('p2')] });
    expect(q.getAllByText('Waiting to upload').length).toBe(2);
    expect(q.getAllByText('PDF').length).toBe(2);
  });

  it('fires onAdd for camera/gallery/pdf (ED-07)', async () => {
    const { props, q } = await renderSection({ attachments: [att('a1')] });
    press(q.getByText('Take photo'));
    press(q.getByText('Choose photo'));
    press(q.getByText('Attach PDF'));
    expect((props.onAdd as jest.Mock).mock.calls.map((c: unknown[]) => c[0])).toEqual(['camera', 'gallery', 'pdf']);
  });

  it('hides add buttons at the 5-attachment cap (ED-07)', async () => {
    const { q } = await renderSection({ attachments: [1, 2, 3, 4, 5].map((n) => att(`a${n}`)) });
    expect(q.queryByText('Take photo')).toBeNull();
    expect(q.queryByText('Choose photo')).toBeNull();
    expect(q.queryByText('Attach PDF')).toBeNull();
  });

  const useWebAdapter = (online: boolean) => {
    resetRuntimeForTests();
    resetFirebaseForTests();
    adapter = new FakeAdapter('web');
    adapter.user = { uid, isAnonymous: false, displayName: 'Me', email: null };
    adapter.online = online;
    setFirebaseFactory(() => adapter);
  };

  it('web hides the picker while offline (ED-14)', async () => {
    useWebAdapter(false);
    const { q } = await renderSection();
    expect(q.queryByText('Choose file')).toBeNull();
  });

  it('web shows a single file picker button online (ED-14)', async () => {
    useWebAdapter(true);
    const { props, q } = await renderSection();
    press(q.getByText('Choose file'));
    expect(props.onAdd).toHaveBeenCalledWith('media');
  });

  it('remove buttons call back with the right row', async () => {
    const { props, q } = await renderSection({
      attachments: [att('a1')],
      pendings: [pending('p1')],
    });
    const removes = q.getAllByLabelText('Remove');
    press(removes[0]);
    press(removes[1]);
    expect(props.onRemoveExisting).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    expect(props.onRemovePending).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('failed attachments show Retry which fires onRetry', async () => {
    const { props, q } = await renderSection({ attachments: [att('a1', { status: 'failed' })] });
    press(q.getByText('Retry'));
    expect(props.onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('read-only hides add/remove but keeps the rows tappable for viewing', async () => {
    const { q } = await renderSection({ readOnly: true, attachments: [att('a1')] });
    expect(q.queryByText('Take photo')).toBeNull();
    expect(q.queryByLabelText('Remove')).toBeNull();
    expect(q.getByText('PDF')).toBeTruthy();
  });
});
