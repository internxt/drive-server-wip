import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AsymmetricEncryptionService } from './asymmetric-encryption.service';
import {
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
} from './openpgp';

vi.mock('@dashlane/pqc-kem-kyber512-node', () => ({
  default: vi.fn(() => ({
    keypair: vi.fn().mockResolvedValue({
      publicKey: new Uint8Array([1, 2, 3]),
      privateKey: new Uint8Array([4, 5, 6]),
    }),
    encapsulate: vi.fn().mockResolvedValue({
      ciphertext: new Uint8Array([11, 12, 13, 14, 15]),
      sharedSecret: new Uint8Array([
        16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      ]),
    }),
    decapsulate: vi.fn().mockResolvedValue({
      sharedSecret: new Uint8Array([
        16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      ]),
    }),
  })),
}));

describe('AsymmetricEncryptionService', () => {
  let service: AsymmetricEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsymmetricEncryptionService],
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
});
