import { type UserAttributes } from '../../../modules/user/user.attributes';
import { type SharingInviteAttributes } from '../../../modules/sharing/sharing.domain';
import { type File } from '../../../modules/file/file.domain';
import { type Folder } from '../../../modules/folder/folder.domain';
import { NotificationEvent } from './notification.event';

export const SHARING_REQUEST_CREATED = 'SHARING_REQUEST_CREATED';

export class AccessRequestToShareItemEvent extends NotificationEvent {
  itemName: File['plainName'] | Folder['plainName'];

  constructor(params: {
    ownerUuid: UserAttributes['uuid'];
    ownerEmail: UserAttributes['email'];
    requesterEmail: UserAttributes['email'];
    itemId: SharingInviteAttributes['itemId'];
    itemType: SharingInviteAttributes['itemType'];
    itemName: File['plainName'] | Folder['plainName'];
    inviteId: SharingInviteAttributes['id'];
  }) {
    super(
      'notification.sharingRequestCreated',
      {
        inviteId: params.inviteId,
        itemId: params.itemId,
        itemType: params.itemType,
        requesterEmail: params.requesterEmail,
      },
      params.ownerEmail,
      null,
      params.ownerUuid,
      SHARING_REQUEST_CREATED,
    );

    this.itemName = params.itemName;
  }
}
