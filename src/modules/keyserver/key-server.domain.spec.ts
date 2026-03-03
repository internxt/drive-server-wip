import {
  KeyServer,
  type KeyServerAttributes,
  UserKeysEncryptVersions,
} from './key-server.domain';

describe('KeyServer Domain', () => {
  it('When ECC keys are validated, then it should validate successfully', () => {
    const eccKeyData = {
      id: 1,
      userId: 101,
      publicKey: 'eccPublicKey',
      privateKey: 'eccPrivateKey',
      revocationKey: 'eccRevocationKey',
      encryptVersion: UserKeysEncryptVersions.Ecc,
    };

    const isValid = KeyServer.validate(eccKeyData.encryptVersion, eccKeyData);

    expect(isValid).toEqual(true);
  });

  it('When Kyber keys are validated, then it should validate successfully', () => {
    const kyberKeyData = {
      id: 2,
      userId: 102,
      publicKey: 'kyberPublicKey',
      privateKey: 'kyberPrivateKey',
      encryptVersion: UserKeysEncryptVersions.Kyber,
    };

    const isValid = KeyServer.validate(
      kyberKeyData.encryptVersion,
      kyberKeyData,
    );

    expect(isValid).toEqual(true);
  });

  it('When Ecc keys have required fields missing, then it should throw', () => {
    const invalidEccKeyData = {
      id: 3,
      userId: 103,
      encryptVersion: UserKeysEncryptVersions.Ecc,
    };

    expect(() => {
      KeyServer.validate(
        invalidEccKeyData.encryptVersion,
        invalidEccKeyData as KeyServerAttributes,
      );
    }).toThrow();
  });

  it('When Kyber keys have missing required fields, then it should throw', () => {
    const kyberKeyData = {
      id: 5,
      userId: 105,
      privateKey: 'kyberPrivateKey',
      encryptVersion: UserKeysEncryptVersions.Kyber,
    };

    expect(() => {
      KeyServer.validate(kyberKeyData.encryptVersion, kyberKeyData);
    }).toThrow();
  });

  it('When unsupported encryption version is used, then it should throw', () => {
    const unsupportedKeyData = {
      id: 4,
      userId: 104,
      publicKey: 'unsupportedPublicKey',
      privateKey: 'unsupportedPrivateKey',
      encryptVersion: 'unsupported' as UserKeysEncryptVersions,
    };

    expect(() => {
      KeyServer.validate(unsupportedKeyData.encryptVersion, unsupportedKeyData);
    }).toThrow();
  });
});
