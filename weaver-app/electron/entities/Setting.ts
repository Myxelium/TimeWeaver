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

  @Column({ type: 'real', default: 8 })
  maxHoursPerDay!: number;

  @Column({ type: 'boolean', default: true })
  maxHoursEnabled!: boolean;

  @Column({ type: 'text', nullable: true })
  holidayCountry?: string | null;

  @Column({ type: 'text', default: 'public,bank' })
  holidayTypes!: string; // Comma-separated: public,bank,school,optional,observance

  @Column({ type: 'int', default: 1 })
  firstDayOfWeek!: number;

  @Column({ type: 'real', default: 0 })
  overtimeRate!: number;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  updated_at?: string;
}
