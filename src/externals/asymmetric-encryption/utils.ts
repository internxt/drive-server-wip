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
 * @returns {string} The result of XOR of strings a and b.
 */
export function XORhex(a: string, b: string): string {
  let res = '',
    i = a.length,
    j = b.length;
  if (i != j) {
    throw new Error('Can XOR only strings with identical length');
  }
  while (i-- > 0 && j-- > 0)
    res =
      (parseInt(a.charAt(i), 16) ^ parseInt(b.charAt(j), 16)).toString(16) +
      res;
  return res;
}
