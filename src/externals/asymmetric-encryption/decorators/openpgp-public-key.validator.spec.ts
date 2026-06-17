import { generateKey } from 'openpgp';
import { validate } from 'class-validator';
import { IsOpenPgpPublicKey } from './openpgp-public-key.validator';

class TestDto {
  @IsOpenPgpPublicKey()
  publicKey: string;
}

describe('IsOpenPgpPublicKey', () => {
  it('When value is a valid OpenPGP public key, then pass', async () => {
    const { publicKey } = await generateKey({
      userIDs: [{ email: 'inxt@inxt.com' }],
      curve: 'ed25519',
    });
    const dto = new TestDto();
    dto.publicKey = Buffer.from(publicKey).toString('base64');

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When value is a private key armored as base64, then fail', async () => {
    const { privateKey } = await generateKey({
      userIDs: [{ email: 'inxt@inxt.com' }],
      curve: 'ed25519',
    });
    const dto = new TestDto();
    dto.publicKey = Buffer.from(privateKey).toString('base64');

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('publicKey');
    expect(errors[0].constraints).toHaveProperty('isOpenPgpPublicKey');
  });

  it('When value is not base64, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = 'not-a-valid-key!!!';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isOpenPgpPublicKey');
  });

  it('When value is random base64 garbage, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = Buffer.from('just some random text').toString('base64');

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isOpenPgpPublicKey');
  });

  it('When value is empty string, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = '';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isOpenPgpPublicKey');
  });

  it('When value is undefined, then fail', async () => {
    const dto = new TestDto();
    dto.publicKey = undefined;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isOpenPgpPublicKey');
  });
});
