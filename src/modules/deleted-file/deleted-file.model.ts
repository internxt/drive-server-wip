import { Table, Model, PrimaryKey, Column } from 'sequelize-typescript';
import { DeletedFileAttributes } from './deleted-file.domain';

@Table({
  underscored: true,
  timestamps: false,
  tableName: 'deleted_files',
})
export class DeletedFileModel extends Model implements DeletedFileAttributes {
  @PrimaryKey
  @Column
  file_id: string;

  @Column
  user_id: number;

  @Column
  folder_id: number;

  @Column
  bucket: string;
}
