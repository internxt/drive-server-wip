import { convertSizeToBytes } from './convert-size-to-bytes';

describe('convertSizeToBytes function', () => {
  it('When converting bytes (B), then it should return the correct byte value', () => {
    const result = convertSizeToBytes(5, 'B');
    expect(result).toBe(5);
  });

  it('When converting kilobytes (KB), then it should return the correct byte value', () => {
    const result = convertSizeToBytes(2, 'KB');
    expect(result).toBe(2 * 1024);
  });

  it('When converting megabytes (MB), then it should return the correct byte value', () => {
    const result = convertSizeToBytes(1, 'MB');
    expect(result).toBe(1 * 1024 ** 2);
  });

  it('When converting gigabytes (GB), then it should return the correct byte value', () => {
    const result = convertSizeToBytes(3, 'GB');
    expect(result).toBe(3 * 1024 ** 3);
  });

  it('When converting terabytes (TB), then it should return the correct byte value', () => {
    const result = convertSizeToBytes(1, 'TB');
    expect(result).toBe(1 * 1024 ** 4);
  });

  it('When the value is negative, then it should throw an error', () => {
    expect(() => convertSizeToBytes(-1, 'MB')).toThrow(
      'Value cannot be negative.',
    );
  });

  it('When the unit is invalid, then it should throw an error', () => {
    expect(() => convertSizeToBytes(1, 'XZ' as any)).toThrow();
  });

  it('When no unit is provided, then it should throw an error', () => {
    expect(() => convertSizeToBytes(10, '' as any)).toThrow();
  });

  it('When converting to bytes with a valid unit, then it should return the correct result', () => {
    const result = convertSizeToBytes(50, 'TB');
    expect(result).toBe(50 * 1024 ** 4);
  });

  it('When converting megabytes (MB) to bytes with a large number, then it should return the correct byte value', () => {
    const result = convertSizeToBytes(1_000_000, 'MB');
    expect(result).toBe(1_000_000 * 1024 ** 2);
  });
});
