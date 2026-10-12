import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

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

  @Column({ type: 'boolean', default: false })
  launchAtLogin!: boolean;

  @Column({ type: 'text', default: '[]' })
  popupRules!: string;

  @Column({ type: 'text', nullable: true })
  adoOrganization?: string | null;

  @Column({ type: 'text', nullable: true })
  adoPat?: string | null;

  @Column({ type: 'text', default: 'pat' })
  adoAuthMethod!: string;

  @Column({ type: 'boolean', default: false })
  adoSyncEnabled!: boolean;

  @Column({ type: 'text', nullable: true })
  adoLastSyncOn?: string | null;

  @Column({ type: 'text', nullable: true })
  adoLastSyncError?: string | null;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  updated_at?: string;
}
