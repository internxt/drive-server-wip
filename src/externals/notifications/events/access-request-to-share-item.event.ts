import { type UserAttributes } from '../../../modules/user/user.attributes';
import { type File } from '../../../modules/file/file.domain';
import { type Folder } from '../../../modules/folder/folder.domain';
import { NotificationEvent } from './notification.event';
import { type GetInviteDto } from 'src/modules/sharing/dto/get-invites.dto';

export const SHARING_REQUEST_CREATED = 'SHARING_REQUEST_CREATED';

export class AccessRequestToShareItemEvent extends NotificationEvent {
  itemName: File['plainName'] | Folder['plainName'];

  constructor(params: {
    ownerUuid: UserAttributes['uuid'];
    ownerEmail: UserAttributes['email'];
    payload: GetInviteDto;

    itemName: File['plainName'] | Folder['plainName'];
  }) {
    super(
      'notification.sharingRequestCreated',
      params.payload,
      params.ownerEmail,
      null,
      params.ownerUuid,
      SHARING_REQUEST_CREATED,
    );

    this.itemName = params.itemName;
  }
}
