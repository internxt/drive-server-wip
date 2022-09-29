import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  AllowNull,
  AutoIncrement,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserAttributes } from '../modules/user/user.domain';
import { UserModel } from '../modules/user/user.repository';

interface FriendInvitationAttributes {
  id: number;
  host: UserAttributes['id'];
  guestEmail: UserAttributes['email'];
  accepted: boolean;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'friend_invitations',
})
export class FriendInvitationModel
  extends Model
  implements FriendInvitationAttributes
{
  @PrimaryKey
  @AutoIncrement
  @AllowNull(false)
  @Column(DataType.INTEGER)
  id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  @ForeignKey(() => UserModel)
  host: FriendInvitationAttributes['host'];

  @AllowNull(false)
  @Column(DataType.STRING)
  guestEmail: FriendInvitationAttributes['guestEmail'];

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  accepted: boolean;
}

export interface SharedWorkspaceRepository {
  updateByHostAndGuest(
    host: FriendInvitationAttributes['host'],
    guest: FriendInvitationAttributes['guestEmail'],
  ): Promise<void>;
}

@Injectable()
export class SequelizeSharedWorkspaceRepository
  implements SharedWorkspaceRepository
{
  constructor(
    @InjectModel(FriendInvitationModel)
    private model: typeof FriendInvitationModel,
  ) {}

  async updateByHostAndGuest(
    host: FriendInvitationAttributes['host'],
    guest: FriendInvitationAttributes['guestEmail'],
  ): Promise<void> {
    await this.model.update(
      {
        accepted: true,
      },
      {
        where: { host, guestEmail: guest },
      },
    );
  }
}
