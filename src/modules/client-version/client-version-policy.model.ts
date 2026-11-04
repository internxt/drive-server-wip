import {
  AllowNull,
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { type ClientVersionPolicyAttributes } from './client-version-policy.domain';

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'client_version_policies',
})
export class ClientVersionPolicyModel
  extends Model
  implements ClientVersionPolicyAttributes
{
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  client: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  minVersion: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  deprecatedBelow: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  sunsetAt: Date | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  recommendedVersion: string | null;

  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;

  @AllowNull(false)
  @Column(DataType.DATE)
  updatedAt: Date;
}
