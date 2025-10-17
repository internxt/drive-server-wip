import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DeleteTfaDto } from './delete-tfa.dto';

describe('DeleteTfaDto Validation', () => {
  it('When only password is provided, then validation should pass', async () => {
    const data = {
      pass: 'encrypted_hashed_password',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When only TFA code is provided, then validation should pass', async () => {
    const data = {
      code: '123456',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When both password and TFA code are provided, then validation should pass', async () => {
    const data = {
      pass: 'encrypted_password',
      code: '123456',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When neither password nor TFA code is provided, then validation should fail', async () => {
    const data = {};
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When both fields are empty strings, then validation should fail', async () => {
    const data = {
      pass: '',
      code: '',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When password is empty string but code is provided, then validation should pass', async () => {
    const data = {
      pass: '',
      code: '123456',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When code is empty string but password is provided, then validation should pass', async () => {
    const data = {
      pass: 'encrypted_password',
      code: '',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When password is undefined and code is provided, then validation should pass', async () => {
    const data = {
      code: '123456',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When code is undefined and password is provided, then validation should pass', async () => {
    const data = {
      pass: 'encrypted_password',
    };
    const dto = plainToInstance(DeleteTfaDto, data);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
