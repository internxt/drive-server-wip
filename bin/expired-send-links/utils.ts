import { Op } from 'sequelize';
import { ModelType, Repository, Sequelize } from 'sequelize-typescript';
import { DeletedFileModel } from 'src/modules/deleted-file/deleted-file.model';
import { SendLinkItemAttributes } from '../../src/modules/send/send-link-item.domain';
import { SendLinkItemModel } from '../../src/modules/send/send-link-item.model';
import { SendLinkAttributes } from '../../src/modules/send/send-link.domain';
import { SendLinkModel } from '../../src/modules/send/send-link.model';

type Timer = { start: () => void; end: () => number };

export const createTimer = (): Timer => {
  let timeStart: [number, number];

  return {
    start: () => {
      timeStart = process.hrtime();
    },
    end: () => {
      const NS_PER_SEC = 1e9;
      const NS_TO_MS = 1e6;
      const diff = process.hrtime(timeStart);

      return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
    },
  };
};

export function getExpiredSendLinks(
  SendLinkRepository: Repository<SendLinkModel>,
  SendLinkItemModel: ModelType<SendLinkItemModel, SendLinkItemModel>,
  limit: number,
): Promise<SendLinkAttributes[]> {
  return SendLinkRepository.findAll({
    limit,
    order: [['id', 'ASC']],
    where: {
      expirationAt: {
        [Op.lt]: Sequelize.literal('NOW()'),
      },
    },
    include: {
      model: SendLinkItemModel,
      attributes: ['id', 'networkId'],
      where: {
        networkId: {
          [Op.not]: null,
        },
      },
    },
  }).then((res) => {
    return res as unknown as SendLinkAttributes[];
  });
}

export function moveItemsToDeletedFiles(
  deletedFilesRepository: Repository<DeletedFileModel>,
  expiredSendLinkItems: SendLinkItemAttributes[],
  userId: number,
  folderId: number,
  bucketId: string,
): Promise<DeletedFileModel[]> {
  const deletedFiles: {
    file_id: string;
    user_id: number;
    folder_id: number;
    bucket: string;
  }[] = expiredSendLinkItems.map((item) => {
    return {
      file_id: item.networkId,
      user_id: userId,
      folder_id: folderId,
      bucket: bucketId,
    };
  });


  return deletedFilesRepository.bulkCreate(deletedFiles);
}

export function moveToDeletedFiles(
  DeletedFilesRepository: Repository<DeletedFileModel>,
  expiredSendLink: SendLinkItemAttributes,
  SEND_USER_ID: number,
  SEND_FOLDER_ID: number,
  SEND_BUCKET: string,
): Promise<DeletedFileModel> {
  return DeletedFilesRepository.create({
    file_id: expiredSendLink.networkId,
    user_id: SEND_USER_ID,
    folder_id: SEND_FOLDER_ID,
    bucket: SEND_BUCKET,
  });
}

export function clearExpiredSendLinkItems(
  SendLinkItemRepository: Repository<SendLinkItemModel>,
  expiredLink: SendLinkAttributes,
) {
  return SendLinkItemRepository.destroy({
    where: { link_id: expiredLink.id },
  });
}

export function clearExpiredSendLink(
  SendLinkRepository: Repository<SendLinkModel>,
  expiredLink: SendLinkAttributes,
) {
  return SendLinkRepository.destroy({
    where: { id: expiredLink.id },
  });
}
