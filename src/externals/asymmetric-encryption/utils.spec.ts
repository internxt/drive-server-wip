import { extendSecret, XORhex } from './utils';

describe('extendSecret', () => {
  it('When given a secret, then it should return a hashed value with the desired bit-length', async () => {
    const secret = new Uint8Array([1, 2, 3, 4]);
    const bitLength = 256;

    const result = await extendSecret(secret, bitLength);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('When given different inputs, then it should produce different hashes', async () => {
    const secret1 = new Uint8Array([1, 2, 3, 4]);
    const secret2 = new Uint8Array([5, 6, 7, 8]);
    const bitLength = 256;

    const hash1 = await extendSecret(secret1, bitLength);
    const hash2 = await extendSecret(secret2, bitLength);

    expect(hash1).not.toEqual(hash2);
  });

  it('When given the same input, then it should return the same hash', async () => {
    const secret = new Uint8Array([1, 2, 3, 4]);
    const bitLength = 256;

    const hash1 = await extendSecret(secret, bitLength);
    const hash2 = await extendSecret(secret, bitLength);

    expect(hash1).toEqual(hash2);
  });
});

describe('XORhex', () => {
  it('When identical hex strings are XORed, then it should return a string of zeros', () => {
    const hexString = 'deadbeef';
    const expectedResult = '00000000';

    expect(XORhex(hexString, hexString)).toBe(expectedResult);
  });

  it('When a fixed example is provided, it should return the expected result', async () => {
    const firstHex = '74686973206973207468652074657374206d657373616765';
    const secondHex = '7468697320697320746865207365636f6e64206d65737361';
    const resultHex = '0000000000000000000000000700101b4e09451e16121404';

    const xoredMessage = XORhex(firstHex, secondHex);

    expect(xoredMessage).toEqual(resultHex);
  });

  it('When XORing with a zero-filled hex string, then it should return the original string', () => {
    const a = '12345678';
    const zeroString = '00000000';

    expect(XORhex(a, zeroString)).toBe(a);
  });

  it('When input strings have different lengths, then it should throw an error', () => {
    const a = '1234';
    const b = 'abcd12';

    expect(() => XORhex(a, b)).toThrow(
      'Can XOR only strings with identical length',
    );
  });

  it('When both input strings are empty, then it should return an empty string', () => {
    expect(XORhex('', '')).toBe('');
  });
});
