import { Inject, Injectable } from '@nestjs/common';
import { KyberProvider } from './providers/kyber.provider';
import { type KyberBuilder } from './providers/kyber.provider';
import { extendSecret, XORhex, xorUint8Arrays } from './utils';
import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
  generateNewKeys,
} from './openpgp';

const WORDS_HYBRID_MODE_IN_BASE64 = 'SHlicmlkTW9kZQ=='; // 'HybridMode' in BASE64 format
const WORDS_HYBRID_BUCKET_KEY_IN_BASE64 = 'SHlicmlkQnVja2V0S2V5'; // 'HybridBucketKey' in BASE64 format

@Injectable()
export class AsymmetricEncryptionService {
  constructor(
    @Inject(KyberProvider.provide)
    private readonly kyberKem: KyberBuilder,
  ) {}

  async generateKyberKeys() {
    const keys = await this.kyberKem.keypair();
    return {
      publicKey: Buffer.from(keys.publicKey).toString('base64'),
      privateKey: Buffer.from(keys.privateKey).toString('base64'),
    };
  }

  async generateNewKeys(date?: Date) {
    const [kyberKeys, eccKeys] = await Promise.all([
      this.generateKyberKeys(),
      generateNewKeys(date),
    ]);

    return {
      privateKeyArmored: eccKeys.privateKeyArmored,
      publicKeyArmored: eccKeys.publicKeyArmored,
      revocationCertificate: eccKeys.revocationCertificate,
      publicKyberKeyBase64: kyberKeys.publicKey,
      privateKyberKeyBase64: kyberKeys.privateKey,
    };
  }

  /**
   * Kyber encapsulates a shared secret along with a ciphertext.
   */
  async encapsulateKyberSharedSecret(
    publicKey: Uint8Array,
  ): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
    return this.kyberKem.encapsulate(publicKey);
  }

  /**
   * Decrypts the ciphertext using the recipient's private key.
   * Returns the shared secret that matches the one from encryption.
   */
  async decapsulateKyberSharedSecret(
    ciphertext: Uint8Array,
    privateKey: Uint8Array,
  ): Promise<Uint8Array> {
    const { sharedSecret } = await this.kyberKem.decapsulate(
      ciphertext,
      privateKey,
    );
    return sharedSecret;
  }

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
  async hybridEncryptMessageWithPublicKey({
    message,
    publicKeyInBase64,
    publicKyberKeyBase64,
  }: {
    message: string;
    publicKeyInBase64: string;
    publicKyberKeyBase64?: string;
  }): Promise<string> {
    let result = '';
    let plaintext = message;
    if (publicKyberKeyBase64) {
      const publicKyberKey = Buffer.from(publicKyberKeyBase64, 'base64');
      const { ciphertext, sharedSecret: secret } =
        await this.encapsulateKyberSharedSecret(new Uint8Array(publicKyberKey));
      const kyberCiphertextStr = Buffer.from(ciphertext).toString('base64');

      const bits = message.length * 8;
      const secretHex = await extendSecret(secret, bits);
      const messageHex = Buffer.from(message).toString('hex');

      const xored = XORhex(messageHex, secretHex);
      plaintext = Buffer.from(xored).toString('hex');
      result = WORDS_HYBRID_MODE_IN_BASE64.concat('$', kyberCiphertextStr, '$');
    }

    const encryptedMessage = await encryptMessageWithPublicKey({
      message: plaintext,
      publicKeyInBase64,
    });

    const eccCiphertextStr = Buffer.from(
      encryptedMessage.toString(),
      'binary',
    ).toString('base64');

    result = result.concat(eccCiphertextStr);

    return result;
  }

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
  async hybridDecryptMessageWithPrivateKey({
    encryptedMessageInBase64,
    privateKeyInBase64,
    privateKyberKeyInBase64,
  }: {
    encryptedMessageInBase64: string;
    privateKeyInBase64: string;
    privateKyberKeyInBase64?: string;
  }): Promise<string> {
    let eccCiphertextStr = encryptedMessageInBase64;
    let kyberSecret: Uint8Array;

    const ciphertexts = encryptedMessageInBase64.split('$');
    const prefix = ciphertexts[0];
    const isHybridMode = prefix === WORDS_HYBRID_MODE_IN_BASE64;

    if (isHybridMode) {
      if (!privateKyberKeyInBase64) {
        throw new Error(
          'Attempted to decrypt hybrid ciphertex without Kyber key',
        );
      }

      const kyberCiphertextBase64 = ciphertexts[1];
      eccCiphertextStr = ciphertexts[2];

      const privateKyberKey = Buffer.from(privateKyberKeyInBase64, 'base64');
      const kyberCiphertext = Buffer.from(kyberCiphertextBase64, 'base64');
      const decapsulateSharedSecret = await this.decapsulateKyberSharedSecret(
        new Uint8Array(kyberCiphertext),
        new Uint8Array(privateKyberKey),
      );
      kyberSecret = decapsulateSharedSecret;
    }

    const decryptedMessage = await decryptMessageWithPrivateKey({
      encryptedMessage: Buffer.from(eccCiphertextStr, 'base64').toString(
        'binary',
      ),
      privateKeyInBase64,
    });
    let result = decryptedMessage as string;
    if (isHybridMode) {
      const bits = result.length * 4;
      const secretHex = await extendSecret(kyberSecret, bits);
      const xored = XORhex(result, secretHex);
      result = Buffer.from(xored).toString('utf8');
    }

    return result;
  }

  async encryptBucketKeyHybrid({
    bucketKey,
    publicKeyInBase64,
    publicKyberKeyBase64,
  }: {
    bucketKey: Uint8Array;
    publicKeyInBase64: string;
    publicKyberKeyBase64?: string;
  }): Promise<string> {
    let result = '';
    if (bucketKey.length < 32) {
      throw new Error('bucketKey must be at least 32 bytes');
    }
    let plaintext: Uint8Array = bucketKey.subarray(0, 32);
    if (publicKyberKeyBase64) {
      const publicKyberKey = Buffer.from(publicKyberKeyBase64, 'base64');
      const { ciphertext, sharedSecret: secret } =
        await this.encapsulateKyberSharedSecret(new Uint8Array(publicKyberKey));
      const kyberCiphertextStr = Buffer.from(ciphertext).toString('base64');

      plaintext = xorUint8Arrays(plaintext, secret);
      result = WORDS_HYBRID_BUCKET_KEY_IN_BASE64.concat(
        '$',
        kyberCiphertextStr,
        '$',
      );
    }

    const encryptedMessage = await encryptMessageWithPublicKey({
      message: plaintext,
      publicKeyInBase64,
    });

    const eccCiphertextStr = Buffer.from(
      encryptedMessage.toString(),
      'binary',
    ).toString('base64');

    result = result.concat(eccCiphertextStr);

    return result;
  }

  async decryptBucketKeyHybrid({
    encryptedMessageInBase64,
    privateKeyInBase64,
    privateKyberKeyInBase64,
  }: {
    encryptedMessageInBase64: string;
    privateKeyInBase64: string;
    privateKyberKeyInBase64?: string;
  }): Promise<Uint8Array> {
    let eccCiphertextStr = encryptedMessageInBase64;
    let kyberSecret: Uint8Array | undefined;

    const ciphertexts = encryptedMessageInBase64.split('$');
    const prefix = ciphertexts[0];
    const isHybridMode = prefix === WORDS_HYBRID_BUCKET_KEY_IN_BASE64;

    if (isHybridMode) {
      if (!privateKyberKeyInBase64) {
        throw new Error(
          'Attempted to decrypt hybrid ciphertex without Kyber key',
        );
      }

      const kyberCiphertextBase64 = ciphertexts[1];
      eccCiphertextStr = ciphertexts[2];

      const privateKyberKey = Buffer.from(privateKyberKeyInBase64, 'base64');
      const kyberCiphertext = Buffer.from(kyberCiphertextBase64, 'base64');
      kyberSecret = await this.decapsulateKyberSharedSecret(
        new Uint8Array(kyberCiphertext),
        new Uint8Array(privateKyberKey),
      );
    }

    const decryptedMessage = await decryptMessageWithPrivateKey({
      encryptedMessage: Buffer.from(eccCiphertextStr, 'base64').toString(
        'binary',
      ),
      privateKeyInBase64,
      format: 'binary',
    });

    let result = decryptedMessage as Uint8Array;
    if (isHybridMode && kyberSecret) {
      result = xorUint8Arrays(result, kyberSecret);
    }

    return result;
  }

  isBucketKeyCiphertext(encryptedMessageInBase64: string): boolean {
    return (
      encryptedMessageInBase64.split('$')[0] ===
      WORDS_HYBRID_BUCKET_KEY_IN_BASE64
    );
  }

  async reEncryptHybridCiphertext({
    ciphertextInBase64,
    privateKeyInBase64,
    privateKyberKeyInBase64,
    newPublicKeyInBase64,
    newPublicKyberKeyInBase64,
  }: {
    ciphertextInBase64: string;
    privateKeyInBase64: string;
    privateKyberKeyInBase64?: string;
    newPublicKeyInBase64: string;
    newPublicKyberKeyInBase64?: string;
  }): Promise<string> {
    if (this.isBucketKeyCiphertext(ciphertextInBase64)) {
      const bucketKey = await this.decryptBucketKeyHybrid({
        encryptedMessageInBase64: ciphertextInBase64,
        privateKeyInBase64,
        privateKyberKeyInBase64,
      });

      return this.encryptBucketKeyHybrid({
        bucketKey,
        publicKeyInBase64: newPublicKeyInBase64,
        publicKyberKeyBase64: newPublicKyberKeyInBase64,
      });
    }

    const decryptedMessage = await this.hybridDecryptMessageWithPrivateKey({
      encryptedMessageInBase64: ciphertextInBase64,
      privateKeyInBase64,
      privateKyberKeyInBase64,
    });

    return this.hybridEncryptMessageWithPublicKey({
      message: decryptedMessage.toString(),
      publicKeyInBase64: newPublicKeyInBase64,
      publicKyberKeyBase64: newPublicKyberKeyInBase64,
    });
  }
}
