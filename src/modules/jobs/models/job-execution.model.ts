import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
} from 'sequelize-typescript';

@Table({
  tableName: 'job_executions',
  timestamps: true,
  underscored: true,
})
export class JobExecutionModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Column({
    type: DataType.ENUM('running', 'completed', 'failed'),
    defaultValue: 'running',
  })
  declare status: 'running' | 'completed' | 'failed';

  @Column({ type: DataType.DATE, allowNull: true })
  declare startedAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare completedAt: Date;

  @Column({ type: DataType.JSON, allowNull: true })
  declare metadata: {
    [key: string]: any;
  };
}
