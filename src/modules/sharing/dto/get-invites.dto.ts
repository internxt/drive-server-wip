import { type SharingInviteAttributes } from '../sharing.domain';
import { type User } from '../../user/user.domain';

export interface GetInviteDto extends SharingInviteAttributes {
  invited: Pick<User, 'uuid' | 'email' | 'name' | 'lastname' | 'avatar'>;
}

export type GetInvitesDto = GetInviteDto[];
