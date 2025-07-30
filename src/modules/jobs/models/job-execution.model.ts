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
  id: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name: string;

  @Column({
    type: DataType.ENUM('running', 'completed', 'failed'),
    defaultValue: 'running',
  })
  status: 'running' | 'completed' | 'failed';

  @Column({ type: DataType.DATE, allowNull: true })
  startedAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  completedAt: Date;

  @Column({ type: DataType.JSON, allowNull: true })
  metadata: {
    [key: string]: any;
  };
}
