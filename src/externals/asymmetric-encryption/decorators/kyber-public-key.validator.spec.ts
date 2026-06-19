import { validate } from 'class-validator';
import { IsKyberPublicKey } from './kyber-public-key.validator';
import { importEsmPackage } from '../../../lib/import-esm-package';
import type { KyberBuilder } from '../providers/kyber.provider';

class TestDto {
  @IsKyberPublicKey()
  publicKey: string;
}

const KYBER512_PUBLIC_KEY_BYTES = 800;

describe('IsKyberPublicKey', () => {
  it('When value is a real Kyber512 public key, then pass', async () => {
    const kemBuilder = await importEsmPackage<
      (...args: unknown[]) => Promise<KyberBuilder>
    >('@dashlane/pqc-kem-kyber512-node');
    const kem = await kemBuilder();
    const { publicKey } = await kem.keypair();

    // Confirms the real lib's public key size matches the hardcoded constant
    // used by the validator (see kyber-public-key.validator.ts).
    expect(publicKey.length).toBe(KYBER512_PUBLIC_KEY_BYTES);

    const dto = new TestDto();
    dto.publicKey = Buffer.from(publicKey).toString('base64');

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When value decodes to fewer than 800 bytes, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = Buffer.alloc(KYBER512_PUBLIC_KEY_BYTES - 1, 1).toString(
      'base64',
    );

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('publicKey');
    expect(errors[0].constraints).toHaveProperty('isKyberPublicKey');
  });

  it('When value decodes to more than 800 bytes, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = Buffer.alloc(KYBER512_PUBLIC_KEY_BYTES + 1, 1).toString(
      'base64',
    );

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isKyberPublicKey');
  });

  it('When value is not base64, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = 'not-valid-base64!!!';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isKyberPublicKey');
  });

  it('When value is empty string, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = '';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isKyberPublicKey');
  });

  it('When value is undefined, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = undefined;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isKyberPublicKey');
  });
});
