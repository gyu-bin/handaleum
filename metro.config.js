const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** Sentry Metro config — Debug IDs / source maps for EAS production builds. */
module.exports = getSentryExpoConfig(__dirname);
