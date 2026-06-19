import { validate } from 'class-validator';
import { generateMnemonic } from 'bip39';
import { IsEncryptedMnemonic } from './is-encrypted-mnemonic.decorator';
import { encryptMnemonicForTest } from '../../../../test/helpers/mnemonic-test.helper';

class TestDto {
  @IsEncryptedMnemonic()
  mnemonic: string;
}

const buildDto = (mnemonic: string): TestDto => {
  const dto = new TestDto();
  dto.mnemonic = mnemonic;
  return dto;
};

describe('IsEncryptedMnemonic', () => {
  it('When valid encrypted 24-word mnemonic is provided, then no errors returned', async () => {
    const mnemonic = generateMnemonic(256);
    const encrypted = encryptMnemonicForTest(mnemonic, 'password');

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

  it('When encrypted not valid mnemonic is provided, then validation error returned', async () => {
    // Create mnemonic with 2 chars per word manually as bip39 does not allow it, which is invalid
    const shortMnemonic = Array(24).fill('aa').join(' ');
    const encrypted = encryptMnemonicForTest(shortMnemonic, 'password');

    const errors = await validate(buildDto(encrypted));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toMatchObject({
      minLength: 'Invalid encrypted mnemonic.',
    });
  });

  it('When mnemonic is empty, then validation error returned', async () => {
    const errors = await validate(buildDto(''));

    expect(errors.length).toBeGreaterThan(0);
  });
});
