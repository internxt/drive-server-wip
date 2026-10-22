import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LegacyRecoverAccountDto } from './legacy-recover-account.dto';

describe('LegacyRecoverAccountDto', () => {
  const buildPayload = (eccKeys: Record<string, unknown>) => ({
    token: 'temporary_auth_token',
    password: 'encrypted_password',
    salt: 'encrypted_salt',
    mnemonic: 'encrypted_mnemonic',
    asymmetricEncryptedMnemonic: {
      ecc: 'mnemonic_encrypted_with_ecc',
      hybrid: 'mnemonic_encrypted_with_hybrid',
    },
    keys: {
      ecc: eccKeys,
      kyber: { public: 'kyber_public_key', private: 'kyber_private_key' },
    },
  });

  const getKeysErrors = async (payload: Record<string, unknown>) => {
    const dto = plainToInstance(LegacyRecoverAccountDto, payload);
    const errors = await validate(dto);
    return errors.filter((error) => error.property === 'keys');
  };

  describe('validate keys', () => {
    it('When ecc keys are sent without revocation key, then no errors should be returned for keys', async () => {
      const payload = buildPayload({
        public: 'ecc_public_key',
        private: 'ecc_private_key',
      });

      const keysErrors = await getKeysErrors(payload);

      expect(keysErrors).toHaveLength(0);
    });

    it('When ecc keys are sent with revocation key, then no errors should be returned for keys', async () => {
      const payload = buildPayload({
        public: 'ecc_public_key',
        private: 'ecc_private_key',
        revocationKey: 'revocation_key',
      });

      const keysErrors = await getKeysErrors(payload);

      expect(keysErrors).toHaveLength(0);
    });

    it('When ecc private key is missing, then validation error should be returned for keys', async () => {
      const payload = buildPayload({ public: 'ecc_public_key' });

      const keysErrors = await getKeysErrors(payload);

      expect(keysErrors).toHaveLength(1);
    });
  });
});
