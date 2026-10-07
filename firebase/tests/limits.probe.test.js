// Does the emulator enforce Firestore's rules access-call limits, and does it de-duplicate
// repeated get() calls on the same document? Informs how far the batch-of-500 result can be trusted.
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, writeBatch, setLogLevel } = require('firebase/firestore');
setLogLevel('error');

const D = '/databases/$(database)/documents';
const g = (name) => `get(${D}/seed/${name}).data.v == 1`;
const rules = `
rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
  match /seed/{id} { allow read, write: if true; }
  match /distinct12/{id} { allow write: if ${Array.from({ length: 12 }, (_, i) => g('s' + (i + 1))).join(' && ')}; }
  match /same12/{id}     { allow write: if ${Array.from({ length: 12 }, () => g('s1')).join(' && ')}; }
  match /batchSame/{id}  { allow write: if ${g('s1')}; }
  match /batchDistinct/{id} { allow write: if get(${D}/seed/$(id)).data.v == 1; }
}}`;

test('probe emulator access-call behaviour', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-milevana-probe', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (let i = 1; i <= 12; i++) await setDoc(doc(d, 'seed', 's' + i), { v: 1 });
    for (let i = 0; i < 30; i++) await setDoc(doc(d, 'seed', 'b' + i), { v: 1 });
  });
  const d = env.authenticatedContext('u').firestore();
  const res = {};
  const run = async (label, fn) => { res[label] = await fn().then(() => 'ok', (e) => e.code + ': ' + String(e.message).replace(/\s+/g,' ').slice(0, 700)); };
  await run('single write, 12 DISTINCT docs read', () => setDoc(doc(d, 'distinct12', 'x'), { a: 1 }));
  await run('single write, same doc read 12 times', () => setDoc(doc(d, 'same12', 'x'), { a: 1 }));
  await run('batch of 30, each reads the SAME doc once', async () => {
    const b = writeBatch(d); for (let i = 0; i < 30; i++) b.set(doc(d, 'batchSame', 'x' + i), { a: 1 }); await b.commit();
  });
  await run('batch of 30, each reads a DIFFERENT doc', async () => {
    const b = writeBatch(d); for (let i = 0; i < 30; i++) b.set(doc(d, 'batchDistinct', 'b' + i), { a: 1 }); await b.commit();
  });
  console.log('LIMIT PROBE', JSON.stringify(res, null, 2));
  await env.cleanup();
  expect(Object.keys(res).length).toBe(4);
});
