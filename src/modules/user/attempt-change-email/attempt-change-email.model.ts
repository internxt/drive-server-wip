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
  AttemptChangeEmailAttributes,
  AttemptChangeEmailStatus,
} from './attempt-change-email.attributes';
import { Time } from 'src/lib/time';
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
  id: AttemptChangeEmailAttributes['id'];

  @Column(DataType.INTEGER)
  userId: AttemptChangeEmailAttributes['userId'];

  @Column(DataType.STRING)
  newEmail: AttemptChangeEmailAttributes['newEmail'];

  @Default(Time.dateWithDaysAdded(7))
  @Column(DataType.DATE)
  expiresAt: Date;

  @Default(AttemptChangeEmailStatus.PENDING)
  @Column(DataType.ENUM(...Object.values(AttemptChangeEmailStatus)))
  status: AttemptChangeEmailAttributes['status'];

  @Default(Sequelize.fn('now'))
  @Column(DataType.DATE)
  createdAt: AttemptChangeEmailAttributes['createdAt'];

  @Default(Sequelize.fn('now'))
  @Column(DataType.DATE)
  updatedAt: AttemptChangeEmailAttributes['updatedAt'];

  get isExpired() {
    return Time.now(this.expiresAt) < Time.now();
  }

  get isVerified() {
    return this.status === AttemptChangeEmailStatus.VERIFIED;
  }
}
