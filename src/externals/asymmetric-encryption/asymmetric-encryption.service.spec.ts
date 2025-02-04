import { Test, TestingModule } from '@nestjs/testing';
import { AsymmetricEncryptionService } from './asymmetric-encryption.service';
import { KyberBuilder, kyberProvider } from './providers/kyber.provider';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import * as openpgp from './openpgp';
import * as utils from './utils';

jest.mock('./openpgp');
jest.mock('./utils');

describe('AsymmetricEncryptionService', () => {
  let service: AsymmetricEncryptionService;
  let kyberKem: DeepMocked<KyberBuilder>;

  beforeEach(async () => {
    kyberKem = createMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsymmetricEncryptionService,
        {
          provide: kyberProvider.provide,
          useValue: kyberKem,
        },
      ],
    }).compile();

    service = module.get<AsymmetricEncryptionService>(
      AsymmetricEncryptionService,
    );
  });

  it('When tests are created, then expected mocks should be created', () => {
    expect(service).toBeDefined();
    expect(kyberKem).toBeDefined();
  });

  describe('generateKyberKeys', () => {
    it('When called, should generate a pair of keys', async () => {
      const publicKey = 'publicKey';
      const privateKey = 'privateKey';

      kyberKem.keypair.mockResolvedValue({
        publicKey: Buffer.from(publicKey),
        privateKey: Buffer.from(privateKey),
      });

      const keys = await service.generateKyberKeys();

      expect(keys).toEqual({
        publicKey: Buffer.from(publicKey).toString('base64'),
        privateKey: Buffer.from(privateKey).toString('base64'),
      });
    });
  });

  describe('encapsulateWithKyber', () => {
    it('When called, then it should encapsulate secret with kyber keys', async () => {
      const mockCiphertext = new Uint8Array([1, 2, 3]);
      const mockSecret = new Uint8Array([4, 5, 6]);
      kyberKem.encapsulate.mockResolvedValue({
        ciphertext: mockCiphertext,
        sharedSecret: mockSecret,
      });

      const result = await service.encapsulateWithKyber(
        new Uint8Array([7, 8, 9]),
      );

      expect(result).toEqual({
        ciphertext: mockCiphertext,
        sharedSecret: mockSecret,
      });
    });
  });

  describe('decapsulateWithKyber', () => {
    it('When called, then it should decapsulate secret with kyber keys', async () => {
      const mockSecret = new Uint8Array([4, 5, 6]);
      kyberKem.decapsulate.mockResolvedValue({ sharedSecret: mockSecret });

      const result = await service.decapsulateWithKyber(
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
      );

      expect(result).toEqual(mockSecret);
    });
  });

  describe('hybridEncryptMessageWithPublicKey', () => {
    it('When kyber key is passed, then it should encrypt with hybrid mode', async () => {
      const mockCipherText = new Uint8Array([4, 5, 6]);
      const mockSharedSecret = new Uint8Array([4, 5, 6]);

      jest.spyOn(utils, 'extendSecret').mockResolvedValue('extendedSecret');
      jest.spyOn(utils, 'XORhex').mockReturnValue('xoredMessage');
      jest
        .spyOn(openpgp, 'encryptMessageWithPublicKey')
        .mockResolvedValue('encryptedECCMessage');

      jest.spyOn(service, 'encapsulateWithKyber').mockResolvedValueOnce({
        ciphertext: mockCipherText,
        sharedSecret: mockSharedSecret,
      });

      const result = await service.hybridEncryptMessageWithPublicKey({
        message: 'Hello',
        publicKeyInBase64: 'ECCPublicKey',
        publicKyberKeyBase64: 'KyberPublicKey',
      });

      expect(result).toContain('SHlicmlkTW9kZQ==');
      expect(result).toContain('$'); // Hybrid format separator
    });

    it('When no Kyber key is passed, then it should encrypt using ECC only', async () => {
      const encryptedMessage = Buffer.from('encryptedECCMessage').toString(
        'binary',
      );
      const expectedBase64 = Buffer.from(encryptedMessage, 'binary').toString(
        'base64',
      );

      jest
        .spyOn(openpgp, 'encryptMessageWithPublicKey')
        .mockResolvedValue(encryptedMessage);

      const result = await service.hybridEncryptMessageWithPublicKey({
        message: 'Hello',
        publicKeyInBase64: 'ECCPublicKey',
      });

      expect(result).toContain(expectedBase64);
      expect(result).not.toContain('$');
    });
  });

  describe('hybridDecryptMessageWithPrivateKey', () => {
    it('When both ECC and Kyber keys are passed, then it should decrypt using hybrid mode', async () => {
      const mockDecryptedMessage = 'decryptedMessage';
      const mockSharedSecret = new Uint8Array([4, 5, 6]);
      const mockXoredMessage =
        Buffer.from(mockDecryptedMessage).toString('hex');
      const mockDecryptedECCMessage = 'decryptedECCMessage';

      jest
        .spyOn(service, 'decapsulateWithKyber')
        .mockResolvedValue(mockSharedSecret);
      jest
        .spyOn(openpgp, 'decryptMessageWithPrivateKey')
        .mockResolvedValue(mockDecryptedECCMessage);

      jest.spyOn(utils, 'extendSecret').mockResolvedValue('extendedSecret');
      jest.spyOn(utils, 'XORhex').mockReturnValue(mockXoredMessage);

      const encryptedMessageInBase64 =
        'SHlicmlkTW9kZQ==$mockKyberCiphertext$mockEccCiphertext';

      const result = await service.hybridDecryptMessageWithPrivateKey({
        encryptedMessageInBase64,
        privateKeyInBase64: 'ECCPrivateKey',
        privateKyberKeyInBase64: 'KyberPrivateKey',
      });

      expect(result).toEqual(mockDecryptedMessage);
    });

    it('When no Kyber key is passed, then it should decrypt using ECC only', async () => {
      const mockDecryptedECCMessage = 'Any decrypted text';

      jest
        .spyOn(openpgp, 'decryptMessageWithPrivateKey')
        .mockResolvedValue(mockDecryptedECCMessage);

      const encryptedMessageInBase64 = 'mockEccCiphertextBase64';

      const result = await service.hybridDecryptMessageWithPrivateKey({
        encryptedMessageInBase64,
        privateKeyInBase64: 'ECCPrivateKey',
      });

      expect(result).toEqual(mockDecryptedECCMessage);
    });

    it('When attempting to decrypt a hybrid message without a Kyber private key, then it should throw error', async () => {
      const encryptedMessageInBase64 =
        'SHlicmlkTW9kZQ==$mockKyberCiphertext$mockEccCiphertext';

      await expect(
        service.hybridDecryptMessageWithPrivateKey({
          encryptedMessageInBase64,
          privateKeyInBase64: 'ECCPrivateKey',
        }),
      ).rejects.toThrow(
        'Attempted to decrypt hybrid ciphertex without Kyber key',
      );
    });
  });
});
