import { colors } from '../src/theme';

describe('theme colors', () => {
  const hexPattern = /^#[0-9a-fA-F]{6}$/;

  it('all color values are valid 6-digit hex', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value).toMatch(hexPattern);
    }
  });

  it('has required background colors', () => {
    expect(colors.bg).toBeDefined();
    expect(colors.bgCard).toBeDefined();
    expect(colors.bgInput).toBeDefined();
  });

  it('has required text colors', () => {
    expect(colors.textPrimary).toBeDefined();
    expect(colors.textSecondary).toBeDefined();
  });

  it('has required accent colors', () => {
    expect(colors.accent).toBeDefined();
    expect(colors.pink).toBeDefined();
    expect(colors.cyan).toBeDefined();
    expect(colors.purple).toBeDefined();
  });
});
