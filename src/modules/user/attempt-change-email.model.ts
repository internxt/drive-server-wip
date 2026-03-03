import {
  AutoIncrement,
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import {
  type AttemptChangeEmailAttributes,
  AttemptChangeEmailStatus,
} from './attempt-change-email.attributes';
import { Time } from '../../lib/time';
import { Sequelize } from 'sequelize';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'users_attempt_change_email',
})
export class AttemptChangeEmailModel
  extends Model
  implements AttemptChangeEmailAttributes
{
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: AttemptChangeEmailAttributes['id'];

  @Column(DataType.UUID)
  declare userUuid: AttemptChangeEmailAttributes['userUuid'];

  @Column(DataType.STRING)
  declare newEmail: AttemptChangeEmailAttributes['newEmail'];

  @Default(Time.dateWithTimeAdded(7, 'day'))
  @Column(DataType.DATE)
  declare expiresAt: Date;

  @Default(AttemptChangeEmailStatus.PENDING)
  @Column(DataType.ENUM(...Object.values(AttemptChangeEmailStatus)))
  declare status: AttemptChangeEmailAttributes['status'];

  @Default(Sequelize.fn('now'))
  @Column(DataType.DATE)
  declare createdAt: AttemptChangeEmailAttributes['createdAt'];

  @Default(Sequelize.fn('now'))
  @Column(DataType.DATE)
  declare updatedAt: AttemptChangeEmailAttributes['updatedAt'];

  get isExpired() {
    return Time.now(this.expiresAt) < Time.now();
  }

  get isVerified() {
    return this.status === AttemptChangeEmailStatus.VERIFIED;
  }
}
