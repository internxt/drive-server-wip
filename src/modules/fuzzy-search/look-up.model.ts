import { Column, PrimaryKey, Table, Model, Index } from 'sequelize-typescript';
import { LookUpAttributes } from './look-up.domain';

@Table({
  underscored: true,
  tableName: 'look_up',
})
export class LookUpModel extends Model implements LookUpAttributes {
  @PrimaryKey
  @Column
  id: string;

  @Column
  fileId: string;

  @Column
  folderId: string;

  @Index
  @Column
  userUuid: string;

  @Column
  name: string;
}
