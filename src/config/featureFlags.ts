/**
 * Feature flags for enabling/disabling features in the app.
 * 
 * To enable a feature, set its flag to `true`.
 * To disable a feature, set its flag to `false`.
 */
export const featureFlags = {
  /**
   * When enabled, the app tracks user activity (DAU/MAU metrics) and uploads it to the backend.
   */
  enableUserActivityTracking: true,
} as const;
