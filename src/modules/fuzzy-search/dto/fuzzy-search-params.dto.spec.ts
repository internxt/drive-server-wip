import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  FuzzySearchParamsDto,
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
} from './fuzzy-search-params.dto';

describe('FuzzySearchParamsDto', () => {
  test('When the search has the minimum length, then no errors should be returned', async () => {
    const dto = plainToInstance(FuzzySearchParamsDto, {
      search: 'a'.repeat(MIN_SEARCH_LENGTH),
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  test('When the search is shorter than the minimum length, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchParamsDto, {
      search: 'a'.repeat(MIN_SEARCH_LENGTH - 1),
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  test('When the search is longer than the maximum length, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchParamsDto, {
      search: 'a'.repeat(MAX_SEARCH_LENGTH + 1),
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});
