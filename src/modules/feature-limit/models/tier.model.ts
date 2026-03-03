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
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare label: string;

  @Column(DataType.STRING)
  declare context: string;

  @Column(DataType.DATE)
  declare createdAt: Date;

  @Column(DataType.DATE)
  declare updatedAt: Date;
}
