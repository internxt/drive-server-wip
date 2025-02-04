import {
  generateNewKeys,
  decryptMessageWithPrivateKey,
  encryptMessageWithPublicKey,
} from './openpgp';
import * as openpgp from 'openpgp';

jest.mock('openpgp', () => ({
  generateKey: jest.fn(),
  readPrivateKey: jest.fn(),
  readMessage: jest.fn(),
  decrypt: jest.fn(),
  readKey: jest.fn(),
  encrypt: jest.fn(),
  createMessage: jest.fn(),
}));

describe('PGP Utils', () => {
  describe('generateNewKeys', () => {
    it('When generating new keys, then it should return keys in base64 format', async () => {
      const mockPrivateKey = 'mockPrivateKey';
      const mockPublicKey = 'mockPublicKey';
      const mockRevocationCert = 'mockRevocationCert';

      (openpgp.generateKey as jest.Mock).mockResolvedValue({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        revocationCertificate: mockRevocationCert,
      });

      const result = await generateNewKeys();

      expect(openpgp.generateKey).toHaveBeenCalledWith({
        userIDs: [{ email: 'inxt@inxt.com' }],
        curve: 'ed25519',
        date: undefined,
      });
      expect(result.privateKeyArmored).toBe(mockPrivateKey);
      expect(result.publicKeyArmored).toBe(
        Buffer.from(mockPublicKey).toString('base64'),
      );
      expect(result.revocationCertificate).toBe(
        Buffer.from(mockRevocationCert).toString('base64'),
      );
    });
  });

  describe('decryptMessageWithPrivateKey', () => {
    it('When a valid encrypted message and private key are provided, then it should decrypt the message successfully', async () => {
      const mockEncryptedMessage = 'mockEncryptedMessage';
      const mockPrivateKey = 'mockPrivateKeyBase64';
      const mockDecryptedMessage = 'Decrypted message';

      (openpgp.readPrivateKey as jest.Mock).mockResolvedValue(mockPrivateKey);
      (openpgp.readMessage as jest.Mock).mockResolvedValue(
        mockEncryptedMessage,
      );
      (openpgp.decrypt as jest.Mock).mockResolvedValue({
        data: mockDecryptedMessage,
      });

      const result = await decryptMessageWithPrivateKey({
        encryptedMessage: mockEncryptedMessage,
        privateKeyInBase64: mockPrivateKey,
      });

      expect(openpgp.readPrivateKey).toHaveBeenCalledWith({
        armoredKey: mockPrivateKey,
      });
      expect(openpgp.readMessage).toHaveBeenCalledWith({
        armoredMessage: mockEncryptedMessage,
      });
      expect(openpgp.decrypt).toHaveBeenCalledWith({
        message: mockEncryptedMessage,
        decryptionKeys: mockPrivateKey,
      });
      expect(result).toBe(mockDecryptedMessage);
    });
  });

  describe('encryptMessageWithPublicKey', () => {
    it('When a valid message and public key are provided, then it should encrypt the message successfully', async () => {
      const mockMessage = 'Decrypted message';
      const mockPublicKey = 'mockPublicKey';
      const mockPublicKeyBase64 = Buffer.from(mockPublicKey).toString('base64');
      const mockEncryptedMessage = 'mockEncryptedMessage';

      (openpgp.readKey as jest.Mock).mockResolvedValue(mockPublicKey);
      (openpgp.createMessage as jest.Mock).mockResolvedValue({
        text: mockMessage,
      });
      (openpgp.encrypt as jest.Mock).mockResolvedValue(mockEncryptedMessage);

      const result = await encryptMessageWithPublicKey({
        message: mockMessage,
        publicKeyInBase64: mockPublicKeyBase64,
      });

      expect(openpgp.readKey).toHaveBeenCalledWith({
        armoredKey: mockPublicKey,
      });
      expect(openpgp.createMessage).toHaveBeenCalledWith({ text: mockMessage });
      expect(openpgp.encrypt).toHaveBeenCalledWith({
        message: { text: mockMessage },
        encryptionKeys: mockPublicKey,
      });
      expect(result).toBe(mockEncryptedMessage);
    });
  });
});
