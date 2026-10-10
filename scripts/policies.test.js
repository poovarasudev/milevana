// REL-10 — the Hosting policy pages carry the statements the stories and
// Play declarations require (SC-REL10-02/03). A pure file-content check: the
// pages are static, so asserting the text here keeps the listing honest.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const privacy = readFileSync(join(__dirname, '..', 'public', 'privacy.html'), 'utf8');
const terms = readFileSync(join(__dirname, '..', 'public', 'terms.html'), 'utf8');
const hosting = JSON.parse(readFileSync(join(__dirname, '..', 'firebase', 'firebase.json'), 'utf8'));

test('/privacy and /terms rewrite to the static pages (SC-REL10-01)', () => {
  const rewrites = hosting.hosting.rewrites;
  expect(rewrites).toContainEqual({ source: '/privacy', destination: '/privacy.html' });
  expect(rewrites).toContainEqual({ source: '/terms', destination: '/terms.html' });
  expect(rewrites).toContainEqual({ source: '**', destination: '/index.html' });
});

test('privacy page states the required disclosures (SC-REL10-02)', () => {
  const must = [
    /Google Drive/,                       // Drive use
    /drive\.file/,                        // the scope
    /no advertising|no ads/i,             // no ads
    /do not sell/i,                       // no selling
    /Delete account|deleting your data/i, // how deletion works
    /Limited Use/,                        // Google API Limited Use statement
    /installation id/i,                   // Crashlytics installation id
    /name and Google email/,              // members' names and emails disclosed
    /name stays on the entries|your name on them/i, // entries keep a user's name
    /next time the uploader's app opens/i,          // delayed receipt revocation
  ];
  for (const re of must) expect(privacy).toMatch(re);
});

test('privacy page makes no false promise about orphaned documents (SC-REL10-03)', () => {
  expect(privacy).toMatch(/cannot promise that data is deleted/i);
});

test('both pages name the developer, the mailbox and the audience (SC-REL10-03)', () => {
  for (const page of [privacy, terms]) {
    expect(page).toMatch(/Poovarasu Sekar/);
    expect(page).toMatch(/support@poovarasu\.dev/);
  }
  expect(terms).toMatch(/laws of India/);        // governing law
  expect(terms).toMatch(/18 or over/);           // audience
  expect(privacy).toMatch(/18 and over/);
});

test('terms page points at both deletion routes (PRV-11)', () => {
  expect(terms).toMatch(/delete-account/);
});
