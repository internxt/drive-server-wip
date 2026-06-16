import { validate } from 'class-validator';
import CryptoJS from 'crypto-js';
import { generateMnemonic } from 'bip39';
import { IsEncryptedMnemonic } from './is-encrypted-mnemonic.decorator';

class TestDto {
  @IsEncryptedMnemonic()
  mnemonic: string;
}

const buildDto = (mnemonic: string): TestDto => {
  const dto = new TestDto();
  dto.mnemonic = mnemonic;
  return dto;
};

const encryptMnemonic = (mnemonic: string, password: string): string => {
  const b64 = CryptoJS.AES.encrypt(mnemonic, password).toString();
  const e64 = CryptoJS.enc.Base64.parse(b64);
  return e64.toString(CryptoJS.enc.Hex);
};

describe('IsEncryptedMnemonic', () => {
  it('When valid encrypted 24-word mnemonic is provided, then no errors returned', async () => {
    const mnemonic = generateMnemonic(256);
    const encrypted = encryptMnemonic(mnemonic, 'password');

    const errors = await validate(buildDto(encrypted));

    expect(errors.length).toBe(0);
  });

  it('When plaintext mnemonic is provided, then validation error returned', async () => {
    const mnemonic = generateMnemonic(256);

    const errors = await validate(buildDto(mnemonic));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toMatchObject({
      minLength: 'Invalid encrypted mnemonic.',
    });
  });

  it('When mnemonic is too long, then validation error returned', async () => {
    const errors = await validate(buildDto('a'.repeat(481)));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toMatchObject({
      maxLength: 'Invalid encrypted mnemonic.',
    });
  });

  it('When mnemonic is empty, then validation error returned', async () => {
    const errors = await validate(buildDto(''));

    expect(errors.length).toBeGreaterThan(0);
  });
});
