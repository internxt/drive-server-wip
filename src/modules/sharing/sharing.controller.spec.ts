import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { UuidDto } from '../../common/dto/uuid.dto';
import { createMock } from '@golevelup/ts-jest';
import { Sharing } from './sharing.domain';
import { newSharing } from '../../../test/fixtures';
import getEnv from '../../config/configuration';

jest.mock('../../config/configuration');

describe('SharingController', () => {
  let controller: SharingController;
  let sharingService: SharingService;

  let sharing: Sharing;

  beforeEach(async () => {
    sharingService = createMock<SharingService>();

    controller = new SharingController(sharingService);
    sharing = newSharing({});
  });

  describe('get public sharing folder size', () => {
    it('When request the get sharing size method, then it works', async () => {
      const expectedResult = 100;

      jest
        .spyOn(sharingService, 'getPublicSharingFolderSize')
        .mockImplementation(async () => expectedResult);

      const result = await controller.getPublicSharingFolderSize({
        id: sharing.id,
      } as UuidDto);

      expect(result).toStrictEqual({ size: expectedResult });
      expect(sharingService.getPublicSharingFolderSize).toHaveBeenCalledWith(
        sharing.id,
      );
    });
  });

  describe('get public sharing domains', () => {
    it('When requesting the get sharing domains method, then it should return the list of domains', async () => {
      const expectedResult = [
        'https://share.example.com',
        'https://share.example.org',
      ];

      jest.mocked(getEnv).mockReturnValue({
        apis: {
          share: { url: expectedResult.join(',') },
        },
      } as any);

      const result = await controller.getPublicSharingDomains();

      expect(result).toStrictEqual({ list: expectedResult });
    });
  });
});
