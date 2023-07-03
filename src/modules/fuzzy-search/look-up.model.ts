import { Column, PrimaryKey, Table, Model, Index } from 'sequelize-typescript';
import { ItemType, LookUpAttributes } from './look-up.domain';

@Table({
  underscored: true,
  tableName: 'look_up',
  timestamps: false,
})
export class LookUpModel extends Model implements LookUpAttributes {
  @PrimaryKey
  @Column
  id: string;

  @Column
  itemId: string;

  @Column
  itemType: ItemType;

  @Index
  @Column
  userId: string;

  @Column
  name: string;

  @Column
  tokenizedName: string;
}
