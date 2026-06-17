import { v4 } from 'uuid';
import { generateMnemonic } from 'bip39';
import { aes } from '@internxt/lib';
import { generateNewKeys } from '../../src/externals/asymmetric-encryption/openpgp';
import { importEsmPackage } from '../../src/lib/import-esm-package';

const TEST_KEYS_ENCRYPTION_PASSWORD = 'test-keys-password';

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

interface EccKeys {
  publicKey: string;
  privateKey: string;
  revocationKey: string;
}

interface KyberKeys {
  publicKey: string;
  privateKey: string;
}

interface Keys {
  ecc: EccKeys;
  kyber: KyberKeys;
}

let cachedKeys: Keys | null = null;

async function generateEccKeys(): Promise<EccKeys> {
  const keys = await generateNewKeys();
  return {
    publicKey: keys.publicKeyArmored,
    privateKey: aes.encrypt(
      keys.privateKeyArmored,
      TEST_KEYS_ENCRYPTION_PASSWORD,
    ),
    revocationKey: keys.revocationCertificate,
  };
}

async function generateKyberKeys(): Promise<KyberKeys> {
  const kemBuilder = await importEsmPackage<
    typeof import('@dashlane/pqc-kem-kyber512-node').default
  >('@dashlane/pqc-kem-kyber512-node');
  const kem = await kemBuilder();
  const keys = await kem.keypair();
  const privateKeyBase64 = Buffer.from(keys.privateKey).toString('base64');
  return {
    publicKey: Buffer.from(keys.publicKey).toString('base64'),
    privateKey: aes.encrypt(privateKeyBase64, TEST_KEYS_ENCRYPTION_PASSWORD),
  };
}

export async function initializeTestKeys(): Promise<Keys> {
  if (cachedKeys) {
    return cachedKeys;
  }

  const [eccKeys, kyberKeys] = await Promise.all([
    generateEccKeys(),
    generateKyberKeys(),
  ]);

  cachedKeys = {
    ecc: eccKeys,
    kyber: kyberKeys,
  };

  return cachedKeys;
}

export async function generateValidRegistrationData(
  overrides: Partial<RegisterUserDto> = {},
): Promise<RegisterUserDto> {
  const timestamp = Date.now();
  const randomSuffix = v4().substring(0, 8);
  const uniqueId = `${timestamp}-${randomSuffix}`;

  const keys = await initializeTestKeys();

  return {
    name: 'Test',
    lastname: 'User',
    email: overrides.email || `test-${uniqueId}@test.com`,
    password: generateHashedPassword(),
    mnemonic: generateMnemonic(256),
    salt: generateSalt(),
    keys: {
      ecc: keys.ecc,
      kyber: keys.kyber,
    },
    ...overrides,
  };
}

export function generateHashedPassword(): string {
  return (v4() + v4()).replace(/-/g, '').substring(0, 64);
}

export function generateSalt(): string {
  return v4().replace(/-/g, '').substring(0, 32);
}
