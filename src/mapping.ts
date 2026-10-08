import type { DailyActivity, DailyReadiness, DailySleep, SleepPeriod } from './oura-types.ts';

export interface DayRecord {
  day: string;
  dailySleep?: DailySleep;
  sleep?: SleepPeriod;
  readiness?: DailyReadiness;
  activity?: DailyActivity;
}

export type CellValue = string | number | null | undefined;

export interface Column {
  header: string;
  value: (r: DayRecord) => CellValue;
}

/**
 * Columns of the retired Oura web "Trends" CSV, in its original order.
 * Header strings are reproduced exactly, including Oura's own typo
 * ("Sleep Timin Score") and the trailing space in "Total Bedtime ".
 */
export const COLUMNS: readonly Column[] = [
  { header: 'date', value: (r) => r.day },
  { header: 'Activity Burn', value: (r) => r.activity?.active_calories },
  { header: 'Total Sleep Duration', value: (r) => r.sleep?.total_sleep_duration },
  { header: 'Average Resting Heart Rate', value: (r) => r.sleep?.average_heart_rate },
  { header: 'Restless Sleep', value: (r) => r.sleep?.restless_periods },
  { header: 'Previous Night Score', value: (r) => r.readiness?.contributors.previous_night },
  { header: 'Sleep Score', value: (r) => r.dailySleep?.score },
  { header: 'Bedtime End', value: (r) => r.sleep?.bedtime_end },
  { header: 'Sleep Balance Score', value: (r) => r.readiness?.contributors.sleep_balance },
  { header: 'Activity Score', value: (r) => r.activity?.score },
  { header: 'REM Sleep Duration', value: (r) => r.sleep?.rem_sleep_duration },
  { header: 'Low Activity Time', value: (r) => r.activity?.low_activity_time },
  { header: 'Previous Day Activity Score', value: (r) => r.readiness?.contributors.previous_day_activity },
  { header: 'Steps', value: (r) => r.activity?.steps },
  { header: 'High Activity Time', value: (r) => r.activity?.high_activity_time },
  { header: 'Long Periods of Inactivity', value: (r) => r.activity?.inactivity_alerts },
  { header: 'Temperature Trend Deviation', value: (r) => r.readiness?.temperature_trend_deviation },
  { header: 'Total Sleep Score', value: (r) => r.dailySleep?.contributors.total_sleep },
  { header: 'Stay Active Score', value: (r) => r.activity?.contributors.stay_active },
  { header: 'Readiness Score', value: (r) => r.readiness?.score },
  { header: 'Equivalent Walking Distance', value: (r) => r.activity?.equivalent_walking_distance },
  { header: 'Sleep Timing', value: () => null }, // not exposed by the API
  { header: 'Rest Time', value: (r) => r.activity?.resting_time },
  { header: 'Inactive Time', value: (r) => r.activity?.sedentary_time },
  { header: 'Sleep Timin Score', value: (r) => r.dailySleep?.contributors.timing },
  { header: 'Total Bedtime ', value: (r) => r.sleep?.time_in_bed },
  { header: 'Total Burn', value: (r) => r.activity?.total_calories },
  { header: 'Medium Activity Time', value: (r) => r.activity?.medium_activity_time },
  { header: 'Restfulness Score', value: (r) => r.dailySleep?.contributors.restfulness },
  { header: 'Training Frequency Score', value: (r) => r.activity?.contributors.training_frequency },
  { header: 'Deep Sleep Duration', value: (r) => r.sleep?.deep_sleep_duration },
  { header: 'Awake Time', value: (r) => r.sleep?.awake_time },
  { header: 'Sleep Efficiency Score', value: (r) => r.dailySleep?.contributors.efficiency },
  { header: 'Sleep Latency', value: (r) => r.sleep?.latency },
  { header: 'Activity Balance Score', value: (r) => r.readiness?.contributors.activity_balance },
  { header: 'Non-wear Time', value: (r) => r.activity?.non_wear_time },
  { header: 'REM Sleep Score', value: (r) => r.dailySleep?.contributors.rem_sleep },
  { header: 'Recovery Index Score', value: (r) => r.readiness?.contributors.recovery_index },
  { header: 'Move Every Hour Score', value: (r) => r.activity?.contributors.move_every_hour },
  { header: 'Average HRV', value: (r) => r.sleep?.average_hrv },
  { header: 'Temperature Deviation (°C)', value: (r) => r.readiness?.temperature_deviation },
  { header: 'Temperature Score', value: (r) => r.readiness?.contributors.body_temperature },
  { header: 'Lowest Resting Heart Rate', value: (r) => r.sleep?.lowest_heart_rate },
  { header: 'Deep Sleep Score', value: (r) => r.dailySleep?.contributors.deep_sleep },
  { header: 'Sleep Latency Score', value: (r) => r.dailySleep?.contributors.latency },
  { header: 'Bedtime Start', value: (r) => r.sleep?.bedtime_start },
  { header: 'Average MET', value: (r) => r.activity?.average_met_minutes },
  { header: 'Resting Heart Rate Score', value: (r) => r.readiness?.contributors.resting_heart_rate },
  { header: 'Respiratory Rate', value: (r) => r.sleep?.average_breath },
  { header: 'Meet Daily Targets Score', value: (r) => r.activity?.contributors.meet_daily_targets },
  { header: 'Training Volume Score', value: (r) => r.activity?.contributors.training_volume },
  { header: 'Light Sleep Duration', value: (r) => r.sleep?.light_sleep_duration },
  { header: 'Sleep Efficiency', value: (r) => r.sleep?.efficiency },
  { header: 'HRV Balance Score', value: (r) => r.readiness?.contributors.hrv_balance },
];

export const HEADERS: readonly string[] = COLUMNS.map((c) => c.header);
