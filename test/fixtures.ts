import type { DailyActivity, DailyReadiness, DailySleep, SleepPeriod } from '../src/oura-types.ts';

export const DAY = '2025-01-02';

export const DAILY_SLEEP: DailySleep = {
  id: 'daily-sleep-1',
  day: DAY,
  score: 80,
  timestamp: '2025-01-02T00:00:00+00:00',
  contributors: {
    deep_sleep: 90,
    efficiency: 75,
    latency: 95,
    rem_sleep: 70,
    restfulness: 65,
    timing: 85,
    total_sleep: 88,
  },
};

export const LONG_SLEEP: SleepPeriod = {
  id: 'sleep-long-1',
  day: DAY,
  type: 'long_sleep',
  bedtime_start: '2025-01-01T23:30:00-05:00',
  bedtime_end: '2025-01-02T08:30:00-05:00',
  average_breath: 14.5,
  average_heart_rate: 55.5,
  average_hrv: 60,
  awake_time: 3000,
  deep_sleep_duration: 5400,
  efficiency: 85,
  latency: 600,
  light_sleep_duration: 15000,
  lowest_heart_rate: 48,
  rem_sleep_duration: 6000,
  restless_periods: 150,
  time_in_bed: 32400,
  total_sleep_duration: 26400,
};

export const SHORT_LONG_SLEEP: SleepPeriod = {
  ...LONG_SLEEP,
  id: 'sleep-long-2',
  bedtime_start: '2025-01-01T22:00:00-05:00',
  bedtime_end: '2025-01-02T03:30:00-05:00',
  average_heart_rate: 70,
  time_in_bed: 19800,
  total_sleep_duration: 18000,
};

export const NAP: SleepPeriod = {
  ...LONG_SLEEP,
  id: 'sleep-nap-1',
  type: 'sleep',
  bedtime_start: '2025-01-02T14:00:00-05:00',
  bedtime_end: '2025-01-02T15:00:00-05:00',
  average_heart_rate: 99,
  time_in_bed: 3600,
  total_sleep_duration: 3300,
};

export const READINESS: DailyReadiness = {
  id: 'readiness-1',
  day: DAY,
  score: 75,
  temperature_deviation: 0.15,
  temperature_trend_deviation: -0.2,
  timestamp: '2025-01-02T00:00:00+00:00',
  contributors: {
    activity_balance: 80,
    body_temperature: 90,
    hrv_balance: 85,
    previous_day_activity: 70,
    previous_night: 88,
    recovery_index: 60,
    resting_heart_rate: 95,
    sleep_balance: 66,
    sleep_regularity: 72,
  },
};

export const ACTIVITY: DailyActivity = {
  id: 'activity-1',
  day: DAY,
  score: 70,
  timestamp: '2025-01-02T04:00:00-05:00',
  active_calories: 300,
  total_calories: 2500,
  steps: 6000,
  equivalent_walking_distance: 4500,
  high_activity_time: 0,
  medium_activity_time: 1800,
  low_activity_time: 3000,
  sedentary_time: 40000,
  resting_time: 36000,
  non_wear_time: 0,
  inactivity_alerts: 2,
  average_met_minutes: 1.25,
  contributors: {
    meet_daily_targets: 25,
    move_every_hour: 80,
    recovery_time: 100,
    stay_active: 60,
    training_frequency: 96,
    training_volume: 90,
  },
};

export const ACTIVITY_NEXT_DAY: DailyActivity = {
  ...ACTIVITY,
  id: 'activity-2',
  day: '2025-01-03',
  steps: 100,
};
