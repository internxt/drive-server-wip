import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ItemToTrashDto,
  ItemToTrashType,
  MoveItemsToTrashDto,
} from './move-items-to-trash.dto';

describe('MoveItemsToTrashDto', () => {
  it('When valid data is passed, then no errors should be returned', async () => {
    const dto = plainToInstance(MoveItemsToTrashDto, {
      items: [
        { id: '1', type: ItemToTrashType.FILE },
        {
          uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
          type: ItemToTrashType.FOLDER,
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When items array exceeds max size, then should fail', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      id: `${i + 1}`,
      type: ItemToTrashType.FILE,
    }));
    const dto = plainToInstance(MoveItemsToTrashDto, { items });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toBeDefined();
  });

  describe('ItemToTrash', () => {
    it('When both id and uuid are provided in one item, then should fail', async () => {
      const item = plainToInstance(ItemToTrashDto, {
        id: '1',
        uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
        type: ItemToTrashType.FILE,
      });
      const errors = await validate(item);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('When neither id nor uuid are provided in one item, then should fail', async () => {
      const item = plainToInstance(ItemToTrashDto, {
        type: ItemToTrashType.FILE,
      });
      const errors = await validate(item);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('when either id or uuid are provided, then should validate successfuly ', async () => {
      const onlyIdErrors = await validate(
        plainToInstance(ItemToTrashDto, {
          id: '1',
          type: ItemToTrashType.FILE,
        }),
      );
      const onlyUuidErrors = await validate(
        plainToInstance(ItemToTrashDto, {
          uuid: '5bf9dca1-fd68-4864-9a16-ef36b77d063b',
          type: ItemToTrashType.FILE,
        }),
      );
      expect(onlyIdErrors.length).toBe(0);
      expect(onlyUuidErrors.length).toBe(0);
    });
  });
});
