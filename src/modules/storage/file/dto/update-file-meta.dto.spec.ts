import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateFileMetaDto } from './update-file-meta.dto';

describe('UpdateFileMetaDto', () => {
  it('When valid data is passed, then no errors should be returned', async () => {
    const metadata = {
      plainName: 'test',
      type: 'png',
    };
    const dto = plainToInstance(UpdateFileMetaDto, metadata);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto).toEqual(metadata);
  });

  it('When valid name is passed but it has leading and trailing spaces, then no errors should be returned', async () => {
    const metadataWithSpaces = {
      plainName: ' test',
      type: 'png ',
    };
    const expectedMetadata = {
      plainName: 'test',
      type: 'png',
    };
    const dto = plainToInstance(UpdateFileMetaDto, metadataWithSpaces);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto).toEqual(expectedMetadata);
  });
});
