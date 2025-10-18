import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'real', default: 0 })
  monthlyIncome!: number;

  @Column({ type: 'real', default: 0 })
  monthlyCost!: number;

  @Column({ type: 'boolean', default: false })
  darkMode!: boolean;

  @Column({ type: 'boolean', default: true })
  ignoreWeekends!: boolean;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  updated_at?: string;
}
