import { validate } from 'class-validator';
import { UuidDto } from './uuid.dto';
import { newUser } from '../../test/fixtures';

describe('UuidDto Validation', () => {
  const user = newUser();

  it('When a valid UUID is passed, then pass', async () => {
    const dto = new UuidDto();
    dto.id = user.uuid;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When an invalid UUID is passed, then fail', async () => {
    const dto = new UuidDto();
    dto.id = 'invalid_uuid_string';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });

  it('When an empty string is passed, then fail', async () => {
    const dto = new UuidDto();
    dto.id = 'invalid-uuid';
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});
