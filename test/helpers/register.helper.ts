import { v4 } from 'uuid';
import { generateMnemonic } from 'bip39';

export interface RegisterUserDto {
  name: string;
  lastname: string;
  email: string;
  password: string;
  mnemonic: string;
  salt: string;
  keys?: {
    ecc?: {
      publicKey: string;
      privateKey: string;
      revocationKey?: string;
    };
    kyber?: {
      publicKey: string;
      privateKey: string;
    };
  };
  referrer?: string;
}

export function generateValidRegistrationData(
  overrides: Partial<RegisterUserDto> = {},
): RegisterUserDto {
  const timestamp = Date.now();
  const randomSuffix = v4().substring(0, 8);
  const uniqueId = `${timestamp}-${randomSuffix}`;

  return {
    name: 'Test',
    lastname: 'User',
    email: overrides.email || `test-${uniqueId}@test.com`,
    password: generateHashedPassword(),
    mnemonic: generateMnemonic(256),
    salt: generateSalt(),
    keys: {
      ecc: {
        publicKey: `ecc-public-key-test-${uniqueId}`,
        privateKey: `ecc-private-key-test-${uniqueId}`,
        revocationKey: `ecc-revocation-key-test-${uniqueId}`,
      },
      kyber: {
        publicKey: `kyber-public-key-test-${uniqueId}`,
        privateKey: `kyber-private-key-test-${uniqueId}`,
      },
    },
    ...overrides,
  };
}

export function generateHashedPassword(): string {
  return '$2a$08$' + v4().replace(/-/g, '').substring(0, 53);
}

export function generateSalt(): string {
  return v4().replace(/-/g, '').substring(0, 32);
}
