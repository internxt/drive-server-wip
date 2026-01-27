import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from 'sequelize-typescript';
import { UserModel } from '../user/user.model';

interface AppSumoAttributes {
  id: number;
  userId: number;
  planId: string;
  uuid: string;
  invoiceItemUuid: string;
}

@Table({ tableName: 'appsumo', underscored: true, timestamps: true })
export class AppSumoModel
  extends Model<AppSumoModel>
  implements AppSumoAttributes
{
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id: number;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.INTEGER,
  })
  userId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  planId: string;

  @Column({
    type: DataType.STRING(36),
    allowNull: false,
  })
  uuid: string;

  @Column({
    type: DataType.STRING(36),
    allowNull: false,
  })
  invoiceItemUuid: string;
}
