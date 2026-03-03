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
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => UserModel)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM,
    values: Object.values(MailTypes),
  })
  declare mailType: MailTypes;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare attemptsCount: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare attemptsLimit: number;

  @AllowNull(false)
  @Default(new Date())
  @Column(DataType.DATE)
  declare lastMailSent: Date;
}
