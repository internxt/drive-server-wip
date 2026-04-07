'use strict';

/**
 * New Relic agent configuration.
 * See https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'drive-server-wip'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  logging: {
    enabled: false,
  },

  // Enable if we require multi-service tracing in the future.
  distributed_tracing: {
    enabled: false,
  },
  transaction_tracer: {
    enabled: false,
    /* transaction_threshold: 500,
    record_sql: 'obfuscated',
    explain_threshold: 1000, */
  },
  span_events: {
    enabled: true,
    max_samples_stored: 1000,
  },
  transaction_events: {
    max_samples_stored: 1000,
  },
  custom_insights_events: {
    enabled: false,
  },

  slow_sql: {
    enabled: true,
  },
  error_collector: {
    enabled: true,
  },
  application_logging: {
    enabled: false,
  },

  // Attribute filtering
  // Rules must be camelCase per NR docs.
  // Applies globally to transactions, spans, and error events.
  attributes: {
    exclude: [
      'request.headers.accept',
      'request.headers.contentLength',
      'request.headers.contentType',
      'request.headers.host',
      'request.headers.referer',
      'request.headers.userAgent',
      'response.headers.contentLength',
      'response.headers.contentType',
    ],
  },
};
