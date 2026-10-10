// FND-SET-01 / SC-SET01-01 — the hard-coded-string scanner itself: catches
// visible literals, leaves code identifiers alone, honours i18n-allow.

const { scanSource } = require('./lib/i18n-scan.js');

describe('i18n scanner', () => {
  it('flags a hard-coded JSX attribute', () => {
    const hits = scanSource(`<Button title="Save vehicle" />`);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe('Save vehicle');
  });

  it('flags JSX text children', () => {
    const hits = scanSource(`<Text>Add your first vehicle</Text>`);
    expect(hits).toHaveLength(1);
  });

  it('flags object-literal text props', () => {
    const hits = scanSource(`const opts = { title: 'Vehicle settings' };`);
    expect(hits).toHaveLength(1);
  });

  it('skips lines carrying the i18n-allow marker', () => {
    const src = `<Button title="Save vehicle" /> // i18n-allow — brand text`;
    expect(scanSource(src)).toHaveLength(0);
  });

  it('ignores identifier-like values (routes, icon names, testIDs)', () => {
    const src = `<Button title="vehicle/new" />`;
    expect(scanSource(src)).toHaveLength(0);
  });

  it('ignores TypeScript arrow return types like => Promise<void>', () => {
    const src = `const f = async (): Promise<void> => { };`;
    expect(scanSource(src)).toHaveLength(0);
  });

  it('ignores short strings under 3 chars', () => {
    expect(scanSource(`<Text>OK</Text>`)).toHaveLength(0);
  });

  it('translated calls produce no findings', () => {
    const src = `<Button title={t('common.save')}>{t('common.done')}</Button>`;
    expect(scanSource(src)).toHaveLength(0);
  });
});
