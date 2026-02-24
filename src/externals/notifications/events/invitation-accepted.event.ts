import { type UserAttributes } from '../../../modules/user/user.attributes';
import { Event } from './event';

export class InvitationAcceptedEvent extends Event {
  invitedUuid: UserAttributes['uuid'];
  whoInvitesUuid: UserAttributes['uuid'];
  whoInvitesEmail: UserAttributes['email'];

  constructor(
    name: string,
    invitedUuid: UserAttributes['uuid'],
    whoInvitesUuid: UserAttributes['uuid'],
    whoInvitesEmail: UserAttributes['email'],
    payload: Record<string, any>,
  ) {
    super(name, payload);

    this.invitedUuid = invitedUuid;
    this.whoInvitesUuid = whoInvitesUuid;
    this.whoInvitesEmail = whoInvitesEmail;
  }
}
