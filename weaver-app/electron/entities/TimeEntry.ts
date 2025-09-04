import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Task } from './Task';

@Entity('time_entries')
export class TimeEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  task_id!: number;

  @Column()
  date!: string; // YYYY-MM-DD format

  @Column('real')
  hours!: number;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
