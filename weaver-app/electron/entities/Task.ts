import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'title' })
  title!: string;

  @Column({ nullable: true, name: 'description' })
  description!: string;

  @Column({ name: 'date' })
  date!: string;

  @Column('real', { default: 0, name: 'hours' })
  hours!: number;

  @Column({ type: 'int', nullable: true })
  adoWorkItemId!: number | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
