export interface SleepContributors {
  deep_sleep: number | null;
  efficiency: number | null;
  latency: number | null;
  rem_sleep: number | null;
  restfulness: number | null;
  timing: number | null;
  total_sleep: number | null;
}

export interface DailySleep {
  id: string;
  day: string;
  score: number | null;
  timestamp: string;
  contributors: SleepContributors;
}

export type SleepType = 'deleted' | 'sleep' | 'long_sleep' | 'late_nap' | 'rest';

export interface SleepPeriod {
  id: string;
  day: string;
  type: SleepType | null;
  bedtime_start: string;
  bedtime_end: string;
  average_breath: number | null;
  average_heart_rate: number | null;
  average_hrv: number | null;
  awake_time: number | null;
  deep_sleep_duration: number | null;
  efficiency: number | null;
  latency: number | null;
  light_sleep_duration: number | null;
  lowest_heart_rate: number | null;
  rem_sleep_duration: number | null;
  restless_periods: number | null;
  time_in_bed: number;
  total_sleep_duration: number | null;
}

export interface ReadinessContributors {
  activity_balance: number | null;
  body_temperature: number | null;
  hrv_balance: number | null;
  previous_day_activity: number | null;
  previous_night: number | null;
  recovery_index: number | null;
  resting_heart_rate: number | null;
  sleep_balance: number | null;
  sleep_regularity: number | null;
}

export interface DailyReadiness {
  id: string;
  day: string;
  score: number | null;
  temperature_deviation: number | null;
  temperature_trend_deviation: number | null;
  timestamp: string;
  contributors: ReadinessContributors;
}

export interface ActivityContributors {
  meet_daily_targets: number | null;
  move_every_hour: number | null;
  recovery_time: number | null;
  stay_active: number | null;
  training_frequency: number | null;
  training_volume: number | null;
}

export interface DailyActivity {
  id: string;
  day: string;
  score: number | null;
  timestamp: string;
  active_calories: number;
  total_calories: number;
  steps: number;
  equivalent_walking_distance: number;
  high_activity_time: number;
  medium_activity_time: number;
  low_activity_time: number;
  sedentary_time: number;
  resting_time: number;
  non_wear_time: number;
  inactivity_alerts: number;
  average_met_minutes: number;
  contributors: ActivityContributors;
}

export interface MultiDocumentResponse<T> {
  data: T[];
  next_token: string | null;
}
