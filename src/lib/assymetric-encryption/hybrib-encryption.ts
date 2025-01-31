import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
} from './openpgp';
import { Kyber512 } from './kyber';
import { extendSecret, XORhex } from './utils';

const WORDS_HYBRID_MODE_IN_BASE64 = 'SHlicmlkTW9kZQ=='; // 'HybridMode' in BASE64 format

/**
 * Encrypts message using hybrid method (ecc and kyber) if kyber key is given, else uses ecc only
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.message - The message to encrypt.
 * @param {string} params.publicKeyInBase64 - The ECC public key in Base64 encoding.
 * @param {string} [params.publicKyberKeyBase64] - The Kyber public key in Base64 encoding. Optional.
 * @returns {Promise<string>} The encrypted message as a Base64-encoded string.
 * @throws {Error} If both ECC and Kyber keys are required but one is missing.
 */
export const hybridEncryptMessageWithPublicKey = async ({
  message,
  publicKeyInBase64,
  publicKyberKeyBase64,
}: {
  message: string;
  publicKeyInBase64: string;
  publicKyberKeyBase64?: string;
}): Promise<string> => {
  let result = '';
  let plaintext = message;
  if (publicKyberKeyBase64) {
    const kem = new Kyber512();

    const publicKyberKey = Buffer.from(publicKyberKeyBase64, 'base64');
    const { ciphertext, sharedSecret: secret } = await kem.encapsulate(
      new Uint8Array(publicKyberKey),
    );
    const kyberCiphertextStr = Buffer.from(ciphertext).toString('base64');

    const bits = message.length * 8;
    const secretHex = await extendSecret(secret, bits);
    const messageHex = Buffer.from(message).toString('hex');

    plaintext = XORhex(messageHex, secretHex);
    result = WORDS_HYBRID_MODE_IN_BASE64.concat('$', kyberCiphertextStr, '$');
  }

  const encryptedMessage = await encryptMessageWithPublicKey({
    message: plaintext,
    publicKeyInBase64,
  });
  const eccCiphertextStr = btoa(encryptedMessage as string);

  result = result.concat(eccCiphertextStr);

  return result;
};

/**
 * Decrypts ciphertext using hybrid method (ecc and kyber) if kyber key is given, else uses ecc only
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.encryptedMessageInBase64 - The encrypted message as a Base64-encoded string.
 * @param {string} params.privateKeyInBase64 - The ECC private key in Base64 encoding.
 * @param {string} [params.privateKyberKeyInBase64] - The Kyber private key in Base64 encoding. Optional.
 * @returns {Promise<string>} The decrypted message as a plain string.
 * @throws {Error} If attempting to decrypt a hybrid message without the required Kyber private key.
 */
export const hybridDecryptMessageWithPrivateKey = async ({
  encryptedMessageInBase64,
  privateKeyInBase64,
  privateKyberKeyInBase64,
}: {
  encryptedMessageInBase64: string;
  privateKeyInBase64: string;
  privateKyberKeyInBase64?: string;
}): Promise<string> => {
  let eccCiphertextStr = encryptedMessageInBase64;
  let kyberSecret;

  const ciphertexts = encryptedMessageInBase64.split('$');
  const prefix = ciphertexts[0];
  const isHybridMode = prefix === WORDS_HYBRID_MODE_IN_BASE64;

  if (isHybridMode) {
    if (!privateKyberKeyInBase64) {
      return Promise.reject(
        new Error('Attempted to decrypt hybrid ciphertex without Kyber key'),
      );
    }
    const kem = new Kyber512();

    const kyberCiphertextBase64 = ciphertexts[1];
    eccCiphertextStr = ciphertexts[2];

    const privateKyberKey = Buffer.from(privateKyberKeyInBase64, 'base64');
    const kyberCiphertext = Buffer.from(kyberCiphertextBase64, 'base64');
    const decapsulateSharedSecret = await kem.decapsulate(
      new Uint8Array(kyberCiphertext),
      new Uint8Array(privateKyberKey),
    );
    kyberSecret = decapsulateSharedSecret;
  }

  const decryptedMessage = await decryptMessageWithPrivateKey({
    encryptedMessage: atob(eccCiphertextStr),
    privateKeyInBase64,
  });
  let result = decryptedMessage as string;
  if (isHybridMode) {
    const bits = result.length * 4;
    const secretHex = await extendSecret(kyberSecret, bits);
    const xored = XORhex(result, secretHex);
    result = Buffer.from(xored, 'hex').toString('utf8');
  }

  return result;
};
