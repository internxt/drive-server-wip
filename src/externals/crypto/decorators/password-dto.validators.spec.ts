import { validate } from 'class-validator';
import CryptoJS from 'crypto-js';
import {
  IsEncryptedPassword,
  IsEncryptedSalt,
} from './password-dto.validators';

class PasswordDto {
  @IsEncryptedPassword()
  password: string;
}

class SaltDto {
  @IsEncryptedSalt()
  salt: string;
}

function encryptTextWithKey(text: string, key: string): string {
  const bytes = CryptoJS.AES.encrypt(text, key).toString();
  return CryptoJS.enc.Base64.parse(bytes).toString(CryptoJS.enc.Hex);
}

function passToHash(password: string): { salt: string; hash: string } {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const hash = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 10000,
  });
  return { salt: salt.toString(), hash: hash.toString() };
}

function generateValidEncryptedPassword(): string {
  const secret = 'testsecret';
  const { hash } = passToHash('testpassword');
  return encryptTextWithKey(hash, secret);
}

function generateValidEncryptedSalt(): string {
  const secret = 'testsecret';
  const { salt } = passToHash('testpassword');
  return encryptTextWithKey(salt, secret);
}

describe('IsEncryptedPassword', () => {
  let validPassword: string;

  beforeEach(() => {
    validPassword = generateValidEncryptedPassword();
  });

  it('When valid encrypted password, then pass', async () => {
    const dto = new PasswordDto();
    dto.password = validPassword;

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When valid uppercase hex, then pass', async () => {
    const dto = new PasswordDto();
    dto.password = validPassword.toUpperCase();

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When too short, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = validPassword.slice(0, 191);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedPassword');
  });

  it('When too long, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = validPassword + 'a';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedPassword');
  });

  it('When non-hex char injected at correct length, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = validPassword.slice(0, 191) + 'z';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedPassword');
  });

  it('When all non-hex chars with correct length, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = 'z'.repeat(192);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedPassword');
  });

  it('When empty string, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = '';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('When undefined, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = undefined;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('When number, then fail', async () => {
    const dto = new PasswordDto();
    dto.password = 123 as any;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('IsEncryptedSalt', () => {
  let validSalt: string;

  beforeEach(() => {
    validSalt = generateValidEncryptedSalt();
  });

  it('When valid encrypted salt, then pass', async () => {
    const dto = new SaltDto();
    dto.salt = validSalt;

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When valid uppercase hex, then pass', async () => {
    const dto = new SaltDto();
    dto.salt = validSalt.toUpperCase();

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When too short, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = validSalt.slice(0, 127);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedSalt');
  });

  it('When too long, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = validSalt + 'a';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedSalt');
  });

  it('When non-hex char injected at correct length, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = validSalt.slice(0, 127) + 'z';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedSalt');
  });

  it('When all non-hex chars with correct length, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = 'z'.repeat(128);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEncryptedSalt');
  });

  it('When empty string, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = '';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('When undefined, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = undefined;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('When number, then fail', async () => {
    const dto = new SaltDto();
    dto.salt = 123 as any;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
