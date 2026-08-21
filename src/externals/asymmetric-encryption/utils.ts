import { blake3 } from 'hash-wasm';

/**
 * Extends the given secret to the required number of bits
 * @param {string} secret - The original secret
 * @param {number} length - The desired bitlength
 * @returns {Promise<string>} The extended secret of the desired bitlength
 */
export function extendSecret(
  secret: Uint8Array,
  length: number,
): Promise<string> {
  return blake3(secret, length);
}

/**
 * XORs two strings of the identical length
 * @param {string} a - The first string
 * @param {string} b - The second string
 * @returns {Uint8Array} The result of XOR of strings a and b.
 */
export function XORhex(a: string, b: string): Uint8Array {
  const aBytes = Buffer.from(a, 'hex');
  const bBytes = Buffer.from(b, 'hex');
  return xorUint8Arrays(new Uint8Array(aBytes), new Uint8Array(bBytes));
}

/**
 * XORs two arrays of the identical length
 * @param {Uint8Array} a - The first array
 * @param {Uint8Array} b - The second array
 * @returns {Uint8Array} The result of XOR of arrays a and b.
 */
export function xorUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new Error('Can XOR only identical lengths');
  }
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}
