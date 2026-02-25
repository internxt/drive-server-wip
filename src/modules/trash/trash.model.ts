import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  Index,
} from 'sequelize-typescript';
import { type TrashAttributes, TrashItemType } from './trash.attributes';

@Table({
  underscored: true,
  timestamps: false,
  tableName: 'trash',
})
export class TrashModel extends Model implements TrashAttributes {
  @PrimaryKey
  @Column(DataType.UUID)
  itemId: string;

  @PrimaryKey
  @Column(DataType.ENUM('file', 'folder'))
  itemType: TrashItemType;

  @Index
  @Column(DataType.DATE)
  caducityDate: Date;

  @Index
  @Column(DataType.INTEGER)
  userId: number;
}
