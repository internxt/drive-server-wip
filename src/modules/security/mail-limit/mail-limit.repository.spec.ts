import { createMock } from '@golevelup/ts-jest';
import { Op } from 'sequelize';
import { SequelizeMailLimitRepository } from './mail-limit.repository';
import { type MailLimitModel } from './mail-limit.model';
import { MailTypes } from './mailTypes';

describe('SequelizeMailLimitRepository', () => {
  let repository: SequelizeMailLimitRepository;
  let mailLimitModel: typeof MailLimitModel;

  beforeEach(() => {
    mailLimitModel = createMock<typeof MailLimitModel>();
    repository = new SequelizeMailLimitRepository(mailLimitModel);
  });

  describe('countSentSince', () => {
    it('When counting mails sent since a date, then it filters by type and date', async () => {
      const since = new Date('2026-11-17T00:00:00.000Z');
      jest.spyOn(mailLimitModel, 'count').mockResolvedValue(42 as any);

      const count = await repository.countSentSince(
        MailTypes.OutdatedClient,
        since,
      );

      expect(count).toBe(42);
      expect(mailLimitModel.count).toHaveBeenCalledWith({
        where: {
          mailType: MailTypes.OutdatedClient,
          lastMailSent: { [Op.gte]: since },
        },
      });
    });
  });
});
