import type { DailyActivity, DailyReadiness, DailySleep, SleepPeriod } from '../src/oura-types.ts';

export const DAY = '2025-01-02';

export const DAILY_SLEEP: DailySleep = {
  id: 'daily-sleep-1',
  day: DAY,
  score: 81,
  timestamp: '2025-01-02T00:00:00+00:00',
  contributors: {
    deep_sleep: 91,
    efficiency: 76,
    latency: 96,
    rem_sleep: 71,
    restfulness: 66,
    timing: 86,
    total_sleep: 89,
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
  average_hrv: 61,
  awake_time: 3020,
  deep_sleep_duration: 5410,
  efficiency: 84,
  latency: 610,
  light_sleep_duration: 15020,
  lowest_heart_rate: 48,
  rem_sleep_duration: 6020,
  restless_periods: 150,
  time_in_bed: 32420,
  total_sleep_duration: 26420,
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
  score: 77,
  temperature_deviation: 0.15,
  temperature_trend_deviation: -0.2,
  timestamp: '2025-01-02T00:00:00+00:00',
  contributors: {
    activity_balance: 82,
    body_temperature: 92,
    hrv_balance: 87,
    previous_day_activity: 72,
    previous_night: 83,
    recovery_index: 62,
    resting_heart_rate: 97,
    sleep_balance: 68,
    sleep_regularity: 74,
  },
};

export const ACTIVITY: DailyActivity = {
  id: 'activity-1',
  day: DAY,
  score: 73,
  timestamp: '2025-01-02T04:00:00-05:00',
  active_calories: 310,
  total_calories: 2510,
  steps: 6010,
  equivalent_walking_distance: 4510,
  high_activity_time: 420,
  medium_activity_time: 1810,
  low_activity_time: 3010,
  sedentary_time: 40010,
  resting_time: 36010,
  non_wear_time: 0,
  inactivity_alerts: 3,
  average_met_minutes: 1.25,
  contributors: {
    meet_daily_targets: 27,
    move_every_hour: 78,
    recovery_time: 94,
    stay_active: 63,
    training_frequency: 98,
    training_volume: 93,
  },
};

export const ACTIVITY_NEXT_DAY: DailyActivity = {
  ...ACTIVITY,
  id: 'activity-2',
  day: '2025-01-03',
  steps: 100,
};
