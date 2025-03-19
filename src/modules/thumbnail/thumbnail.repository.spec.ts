import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SequelizeThumbnailRepository } from './thumbnail.repository';
import { ThumbnailModel } from './thumbnail.model';
import { createMock } from '@golevelup/ts-jest';

describe('SequelizeThumbnailRepository', () => {
  let repository: SequelizeThumbnailRepository;
  let thumbnailModel: typeof ThumbnailModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeThumbnailRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeThumbnailRepository>(
      SequelizeThumbnailRepository,
    );
    thumbnailModel = module.get<typeof ThumbnailModel>(
      getModelToken(ThumbnailModel),
    );
  });

  describe('findById', () => {
    it('When id exists then return the corresponding thumbnail', async () => {
      const mockThumbnail = { id: 1, fileId: 2 } as ThumbnailModel;
      jest.spyOn(thumbnailModel, 'findByPk').mockResolvedValue(mockThumbnail);

      const result = await repository.findById(1);

      expect(result).toEqual(expect.objectContaining({ id: 1, fileId: 2 }));
      expect(thumbnailModel.findByPk).toHaveBeenCalledWith(1);
    });

    it('When id does not exist then return null', async () => {
      jest.spyOn(thumbnailModel, 'findByPk').mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
      expect(thumbnailModel.findByPk).toHaveBeenCalledWith(999);
    });
  });

  describe('findByFileId', () => {
    it('When fileId exists then return the corresponding thumbnail', async () => {
      const mockThumbnail = { id: 1, fileId: 2 } as ThumbnailModel;
      jest.spyOn(thumbnailModel, 'findOne').mockResolvedValue(mockThumbnail);

      const result = await repository.findByFileId(2);

      expect(result).toEqual(expect.objectContaining({ id: 1, fileId: 2 }));
      expect(thumbnailModel.findOne).toHaveBeenCalledWith({
        where: { file_id: 2 },
      });
    });

    it('When fileId does not exist then return null', async () => {
      jest.spyOn(thumbnailModel, 'findOne').mockResolvedValue(null);

      const result = await repository.findByFileId(999);

      expect(result).toBeNull();
      expect(thumbnailModel.findOne).toHaveBeenCalledWith({
        where: { file_id: 999 },
      });
    });
  });

  describe('create', () => {
    it('When valid data is provided then create and return the thumbnail', async () => {
      const newThumbnail = { fileId: 2, type: 'image' } as any;
      const mockThumbnail = { id: 1, ...newThumbnail } as ThumbnailModel;
      jest.spyOn(thumbnailModel, 'create').mockResolvedValue(mockThumbnail);

      const result = await repository.create(newThumbnail);

      expect(result).toEqual(expect.objectContaining({ id: 1, fileId: 2 }));
      expect(thumbnailModel.create).toHaveBeenCalledWith(newThumbnail);
    });
  });

  describe('update', () => {
    it('When valid data is provided then update the thumbnail', async () => {
      const updateData = { type: 'video' };
      const where = { id: 1 };
      jest.spyOn(thumbnailModel, 'update').mockResolvedValue([1]);

      await repository.update(updateData, where);

      expect(thumbnailModel.update).toHaveBeenCalledWith(updateData, {
        where,
      });
    });
  });

  describe('deleteById', () => {
    it('When id exists then delete the thumbnail', async () => {
      jest.spyOn(thumbnailModel, 'destroy').mockResolvedValue(1);

      await repository.deleteById(1);

      expect(thumbnailModel.destroy).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('deleteBy', () => {
    it('When condition matches then delete the thumbnails', async () => {
      const where = { fileId: 2 };
      jest.spyOn(thumbnailModel, 'destroy').mockResolvedValue(1);

      await repository.deleteBy(where);

      expect(thumbnailModel.destroy).toHaveBeenCalledWith({ where });
    });
  });
});
