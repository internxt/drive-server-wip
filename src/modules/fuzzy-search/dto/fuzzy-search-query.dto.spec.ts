import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FuzzySearchQueryDto } from './fuzzy-search-query.dto';
import { FileCategory } from '../file-categories';

describe('FuzzySearchQueryDto', () => {
  test('When no fields are passed, then no errors should be returned', async () => {
    const dto = new FuzzySearchQueryDto();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  test('When valid data with all fields is passed, then no errors should be returned', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, {
      offset: '10',
      type: ['image', 'pdf'],
      minSize: '1024',
      maxSize: '5242880',
      modifiedAfter: '2026-01-01T00:00:00.000Z',
      modifiedBefore: '2026-06-30T23:59:59.999Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.offset).toBe(10);
    expect(dto.minSize).toBe(1024);
    expect(dto.maxSize).toBe(5242880);
  });

  test('When a single type is passed as string, then it should be transformed into an array', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, { type: 'pdf' });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.type).toEqual([FileCategory.Pdf]);
  });

  test('When type contains an unknown category, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, {
      type: ['image', 'documents'],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('When offset is negative, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, { offset: '-1' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('When minSize is negative, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, { minSize: '-5' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('When minSize is not a number, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, { minSize: 'abc' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('When maxSize is lower than minSize, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, {
      minSize: '1000',
      maxSize: '500',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('When maxSize is equal to minSize, then it should pass', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, {
      minSize: '1000',
      maxSize: '1000',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  test('When maxSize is passed without minSize, then it should pass', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, { maxSize: '500' });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  test('When modifiedAfter is not a valid date, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, {
      modifiedAfter: 'not-a-date',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('When modifiedBefore is not a valid date, then it should fail', async () => {
    const dto = plainToInstance(FuzzySearchQueryDto, {
      modifiedBefore: '31/12/2026',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
