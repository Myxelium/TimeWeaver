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
}
