import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { MailTypes } from './mailTypes';
import { UserModel } from '../../../modules/user/user.model';

export interface MailLimitModelAttributes {
  id: number;
  userId: number;
  mailType: MailTypes;
  attemptsCount: number;
  attemptsLimit: number;
  lastMailSent: Date;
}

@Table({
  underscored: true,
  timestamps: false,
  tableName: 'mail_limits',
})
export class MailLimitModel extends Model implements MailLimitModelAttributes {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => UserModel)
  @Column
  userId: number;

  @BelongsTo(() => UserModel)
  user: UserModel;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM,
    values: Object.values(MailTypes),
  })
  mailType: MailTypes;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  attemptsCount: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  attemptsLimit: number;

  @AllowNull(false)
  @Default(new Date())
  @Column(DataType.DATE)
  lastMailSent: Date;
}
