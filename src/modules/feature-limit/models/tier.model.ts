import {
  Column,
  Model,
  Table,
  PrimaryKey,
  DataType,
  AllowNull,
} from 'sequelize-typescript';

export interface TierAttributes {
  id: string;
  label: string;
  context: string;
  createdAt: Date;
  updatedAt: Date;
}

@Table({
  underscored: true,
  timestamps: true,
  tableName: 'tiers',
})
export class TierModel extends Model implements TierAttributes {
  @PrimaryKey
  @Column(DataType.UUIDV4)
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  label: string;

  @Column(DataType.STRING)
  context: string;

  @Column
  createdAt: Date;

  @Column
  updatedAt: Date;
}
