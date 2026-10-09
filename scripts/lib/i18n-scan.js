// Shared scanner for the hard-coded-string CI check (FND-SET-01, SC-SET01-01).
// Plain CommonJS so both the node script and jest tests can load it without
// a build step.

'use strict';

// Props that render text. testID, key and accessibilityRole are not rendered.
const TEXT_PROPS = [
  'accessibilityLabel', 'accessibilityHint', 'label', 'title', 'placeholder',
  'headline', 'sub', 'subtitle', 'message', 'confirmText', 'cancelText', 'text',
];

// String-literal JSX attribute:  prop="Some text"
const ATTR_RE = new RegExp(
  `\\b(?:${TEXT_PROPS.join('|')})\\s*=\\s*["'\`]([^"'\`]*[A-Za-z][^"'\`]*)["'\`]`,
  'g',
);

// JSX text children:  >Some words<   (skips pure punctuation/digits/tags)
const JSX_TEXT_RE = />\s*([A-Za-z][A-Za-z0-9 .,'’!?()\-–—:;]+)\s*</g;

// Object-literal strings for the same prop names: { title: 'X' }
const OBJECT_PROP_RE = new RegExp(
  `\\b(?:${TEXT_PROPS.join('|')})\\s*:\\s*['"]([^'"]*[A-Za-z][^'"]*)['"]`,
  'g',
);

const SKIP_LINE = /i18n-allow/;
// Route names, identifiers, icon names etc. are not user-visible.
const ALLOW_VALUE = /^[a-z0-9_./-]+$/;

/**
 * Scan a source string for hard-coded user-visible strings.
 * Returns [{ line, text, kind }] — one entry per finding.
 */
function scanSource(src, relPath = '') {
  const findings = [];
  const lines = src.split('\n');
  const lineOf = (idx) => {
    let line = 1;
    let pos = 0;
    for (let i = 0; i < lines.length; i++) {
      if (pos + lines[i].length >= idx) return i + 1;
      pos += lines[i].length + 1;
    }
    return line;
  };
  const push = (re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const value = m[1].trim();
      const line = lineOf(m.index);
      if (SKIP_LINE.test(lines[line - 1] ?? '')) continue;
      if (value.length < 3) continue;
      if (kind === 'attr' && ALLOW_VALUE.test(value)) continue;
      // JSX text in route files like </Text> is already covered; ignore braces
      if (/[{}]/.test(value)) continue;
      // `=> Promise<void>` and friends: a `>` preceded by `=` is an arrow, not JSX.
      if (kind === 'jsx' && src[m.index - 1] === '=') continue;
      findings.push({ line, text: value, kind });
    }
  };
  push(ATTR_RE, 'attr');
  push(JSX_TEXT_RE, 'jsx');
  push(OBJECT_PROP_RE, 'object');
  return findings;
}

module.exports = { scanSource, TEXT_PROPS };
