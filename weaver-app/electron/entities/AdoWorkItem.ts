import {
  Column,
  Entity,
  PrimaryColumn
} from 'typeorm';

@Entity('ado_work_items')
export class AdoWorkItem {
  @PrimaryColumn({ type: 'int' })
  adoId!: number;

  @Column({ type: 'text', name: 'title' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  activeOn!: string | null;

  @Column({ type: 'text', nullable: true })
  rangeEnd!: string | null;

  @Column({ type: 'text', nullable: true })
  ranges!: string | null;

  @Column({ type: 'text', nullable: true })
  workItemType!: string | null;

  @Column({ type: 'text', nullable: true })
  state!: string | null;

  @Column({ type: 'float', nullable: true })
  completedWork!: number | null;

  @Column({ type: 'text', nullable: true })
  changedOn!: string | null;
}
