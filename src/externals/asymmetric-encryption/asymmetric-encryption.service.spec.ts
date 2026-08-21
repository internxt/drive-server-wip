import { Test, type TestingModule } from '@nestjs/testing';
import { AsymmetricEncryptionService } from './asymmetric-encryption.service';
import { KyberProvider } from './providers/kyber.provider';
import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
} from './openpgp';

describe('AsymmetricEncryptionService', () => {
  let service: AsymmetricEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsymmetricEncryptionService, KyberProvider],
    }).compile();

    await module.init();

    service = module.get<AsymmetricEncryptionService>(
      AsymmetricEncryptionService,
    );
  });

  it('When tests are created, then expected mocks should be created', () => {
    expect(service).toBeDefined();
  });

  describe('Generate new keys', () => {
    it('When called, it should generate ecc and kyber keys', async () => {
      const keys = await service.generateNewKeys();

      expect(keys).toHaveProperty('publicKyberKeyBase64');
      expect(keys).toHaveProperty('privateKyberKeyBase64');
      expect(keys).toHaveProperty('privateKeyArmored');
      expect(keys).toHaveProperty('publicKeyArmored');
      expect(keys).toHaveProperty('revocationCertificate');
    });
  });

  describe('Encapsulate and decapsulate with Kyber', () => {
    it('When a shared secret is encapsulated and decapsulated, then shared secret should match', async () => {
      const keys = await service.generateNewKeys();

      const encapsulationResult = await service.encapsulateKyberSharedSecret(
        new Uint8Array(Buffer.from(keys.publicKyberKeyBase64, 'base64')),
      );
      const sharedSecretDecapsulated =
        await service.decapsulateKyberSharedSecret(
          encapsulationResult.ciphertext,
          new Uint8Array(Buffer.from(keys.privateKyberKeyBase64, 'base64')),
        );

      expect(sharedSecretDecapsulated).toEqual(
        encapsulationResult.sharedSecret,
      );
    });
  });

  describe('Hybrid Message encryption', () => {
    it('When using hybrid encryption, it should be able to encrypt and decrypt the message', async () => {
      const keys = await service.generateNewKeys();

      const originalMessage =
        'until bonus summer risk chunk oyster census ability frown win pull steel measure employ rigid improve riot remind system earn inch broken chalk clip';

      const encryptedMessageInBase64 =
        await service.hybridEncryptMessageWithPublicKey({
          message: originalMessage,
          publicKeyInBase64: keys.publicKeyArmored,
          publicKyberKeyBase64: keys.publicKyberKeyBase64,
        });

      const decryptedMessage = await service.hybridDecryptMessageWithPrivateKey(
        {
          encryptedMessageInBase64,
          privateKeyInBase64: keys.privateKeyArmored,
          privateKyberKeyInBase64: keys.privateKyberKeyBase64,
        },
      );

      expect(keys).toHaveProperty('privateKeyArmored');
      expect(keys).toHaveProperty('publicKeyArmored');
      expect(encryptedMessageInBase64).not.toEqual(originalMessage);
      expect(decryptedMessage).toEqual(originalMessage);
    });

    it('When hybrid ciphertext but no kyber key, it should throw an error', async () => {
      const keys = await service.generateNewKeys();

      const originalMessage =
        'until bonus summer risk chunk oyster census ability frown win pull steel measure employ rigid improve riot remind system earn inch broken chalk clip';

      const encryptedMessageInBase64 =
        await service.hybridEncryptMessageWithPublicKey({
          message: originalMessage,
          publicKeyInBase64: keys.publicKeyArmored,
          publicKyberKeyBase64: keys.publicKyberKeyBase64,
        });

      await expect(
        service.hybridDecryptMessageWithPrivateKey({
          encryptedMessageInBase64,
          privateKeyInBase64: keys.privateKeyArmored,
        }),
      ).rejects.toThrow(
        'Attempted to decrypt hybrid ciphertex without Kyber key',
      );
    });

    it('When old ciphertext and no kyber keys, then it should be able to decrypt as before', async () => {
      const keys = await service.generateNewKeys();

      const originalMessage =
        'until bonus summer risk chunk oyster census ability frown win pull steel measure employ rigid improve riot remind system earn inch broken chalk clip';

      const encryptedMessage = await encryptMessageWithPublicKey({
        message: originalMessage,
        publicKeyInBase64: keys.publicKeyArmored,
      });

      const encryptedMessageInBase64 = Buffer.from(
        encryptedMessage.toString(),
        'binary',
      ).toString('base64');

      const decryptedMessage = await service.hybridDecryptMessageWithPrivateKey(
        {
          encryptedMessageInBase64,
          privateKeyInBase64: keys.privateKeyArmored,
        },
      );

      const oldDecryptedMessage = await decryptMessageWithPrivateKey({
        encryptedMessage: Buffer.from(
          encryptedMessageInBase64,
          'base64',
        ).toString('binary'),
        privateKeyInBase64: keys.privateKeyArmored,
      });

      expect(decryptedMessage).toEqual(oldDecryptedMessage);
      expect(decryptedMessage).toEqual(originalMessage);
    });

    it('When old ciphertext and kyber keys, then it should be able to decrypt as before', async () => {
      const keys = await service.generateNewKeys();

      const originalMessage =
        'until bonus summer risk chunk oyster census ability frown win pull steel measure employ rigid improve riot remind system earn inch broken chalk clip';

      const encryptedMessage = await encryptMessageWithPublicKey({
        message: originalMessage,
        publicKeyInBase64: keys.publicKeyArmored,
      });

      const encryptedMessageInBase64 = Buffer.from(
        encryptedMessage.toString(),
        'binary',
      ).toString('base64');

      const decryptedMessage = await service.hybridDecryptMessageWithPrivateKey(
        {
          encryptedMessageInBase64,
          privateKeyInBase64: keys.privateKeyArmored,
          privateKyberKeyInBase64: keys.privateKyberKeyBase64,
        },
      );

      const oldDecryptedMessage = await decryptMessageWithPrivateKey({
        encryptedMessage: Buffer.from(
          encryptedMessageInBase64,
          'base64',
        ).toString('binary'),
        privateKeyInBase64: keys.privateKeyArmored,
      });

      expect(decryptedMessage).toEqual(oldDecryptedMessage);
      expect(decryptedMessage).toEqual(originalMessage);
    });
  });

  describe('Hybrid bucket key encryption', () => {
    it('When using hybrid encryption, it should be able to encrypt and decrypt the bucket key', async () => {
      const keys = await service.generateNewKeys();
      const bucketKey = new Uint8Array(32);

      const encryptedMessageInBase64 = await service.encryptBucketKeyHybrid({
        bucketKey,
        publicKeyInBase64: keys.publicKeyArmored,
        publicKyberKeyBase64: keys.publicKyberKeyBase64,
      });

      const decryptedBucketKey = await service.decryptBucketKeyHybrid({
        encryptedMessageInBase64,
        privateKeyInBase64: keys.privateKeyArmored,
        privateKyberKeyInBase64: keys.privateKyberKeyBase64,
      });

      expect(encryptedMessageInBase64).not.toEqual(
        Buffer.from(bucketKey).toString('base64'),
      );
      expect(decryptedBucketKey).toEqual(bucketKey);
    });

    it('When bucketKey is shorter than 32 bytes, it should throw an error', async () => {
      const keys = await service.generateNewKeys();
      const bucketKey = new Uint8Array(16);

      await expect(
        service.encryptBucketKeyHybrid({
          bucketKey,
          publicKeyInBase64: keys.publicKeyArmored,
          publicKyberKeyBase64: keys.publicKyberKeyBase64,
        }),
      ).rejects.toThrow('bucketKey must be at least 32 bytes');
    });
  });

  describe('reEncryptHybridCiphertext', () => {
    it('Should re-encrypt bucket key to a new keypair', async () => {
      const oldKeys = await service.generateNewKeys();
      const newKeys = await service.generateNewKeys();
      const bucketKey = new Uint8Array(32);
      const encrypted = await service.encryptBucketKeyHybrid({
        bucketKey,
        publicKeyInBase64: oldKeys.publicKeyArmored,
        publicKyberKeyBase64: oldKeys.publicKyberKeyBase64,
      });

      const reEncrypted = await service.reEncryptHybridCiphertext({
        ciphertextInBase64: encrypted,
        privateKeyInBase64: oldKeys.privateKeyArmored,
        privateKyberKeyInBase64: oldKeys.privateKyberKeyBase64,
        newPublicKeyInBase64: newKeys.publicKeyArmored,
        newPublicKyberKeyInBase64: newKeys.publicKyberKeyBase64,
      });

      expect(service.isBucketKeyCiphertext(reEncrypted)).toBe(true);

      const decrypted = await service.decryptBucketKeyHybrid({
        encryptedMessageInBase64: reEncrypted,
        privateKeyInBase64: newKeys.privateKeyArmored,
        privateKyberKeyInBase64: newKeys.privateKyberKeyBase64,
      });

      expect(decrypted).toEqual(bucketKey);

      await expect(
        service.decryptBucketKeyHybrid({
          encryptedMessageInBase64: reEncrypted,
          privateKeyInBase64: oldKeys.privateKeyArmored,
          privateKyberKeyInBase64: oldKeys.privateKyberKeyBase64,
        }),
      ).rejects.toThrow();
    });

    it('Should re-encrypt mnemonic to a new keypair', async () => {
      const oldKeys = await service.generateNewKeys();
      const newKeys = await service.generateNewKeys();
      const message =
        'until bonus summer risk chunk oyster census ability frown win pull steel measure employ rigid improve riot remind system earn inch broken chalk clip';

      const encrypted = await service.hybridEncryptMessageWithPublicKey({
        message,
        publicKeyInBase64: oldKeys.publicKeyArmored,
        publicKyberKeyBase64: oldKeys.publicKyberKeyBase64,
      });

      const reEncrypted = await service.reEncryptHybridCiphertext({
        ciphertextInBase64: encrypted,
        privateKeyInBase64: oldKeys.privateKeyArmored,
        privateKyberKeyInBase64: oldKeys.privateKyberKeyBase64,
        newPublicKeyInBase64: newKeys.publicKeyArmored,
        newPublicKyberKeyInBase64: newKeys.publicKyberKeyBase64,
      });

      expect(service.isBucketKeyCiphertext(reEncrypted)).toBe(false);

      const decrypted = await service.hybridDecryptMessageWithPrivateKey({
        encryptedMessageInBase64: reEncrypted,
        privateKeyInBase64: newKeys.privateKeyArmored,
        privateKyberKeyInBase64: newKeys.privateKyberKeyBase64,
      });

      expect(decrypted).toEqual(message);
    });
  });
});
