import { Column, PrimaryKey, Table, Model } from 'sequelize-typescript';
import { LookUpAttributes } from './look-up.domain';

@Table({
  underscored: true,
  tableName: 'fuzzy_search',
})
export class LookUpModel extends Model implements LookUpAttributes {
  @PrimaryKey
  @Column
  id: string;

  @Column
  userUuid: string;

  @Column
  name: string;
}
