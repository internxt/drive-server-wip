export default () => ({
  environment: process.env.NODE_ENV,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT) || 3000,
  database: {
    host: process.env.RDS_HOSTNAME,
    host2: process.env.RDS_HOSTNAME2,
    host3: process.env.RDS_HOSTNAME3,
    port: parseInt(process.env.RDS_PORT) || 3306,
    debug: process.env.RDS_DEBUG === 'true' || false,
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DBNAME,
    replication: {
      read: [
        {
          host: process.env.RDS_HOSTNAME2,
          username: process.env.RDS_USERNAME,
          password: process.env.RDS_PASSWORD,
        },
        {
          host: process.env.RDS_HOSTNAME3,
          username: process.env.RDS_USERNAME,
          password: process.env.RDS_PASSWORD,
        },
      ],
      write: {
        host: process.env.RDS_HOSTNAME,
        username: process.env.RDS_USERNAME,
        password: process.env.RDS_PASSWORD,
      },
    },
  },
  secrets: {
    magicIv: process.env.MAGIC_IV,
    magicSalt: process.env.MAGIC_SALT,
    cryptoSecret: process.env.CRYPTO_SECRET,
    cryptoSecret2: process.env.CRYPTO_SECRET2,
    jwt: process.env.JWT_SECRET,
    gateway: process.env.JWT_GATEWAY_PUBLIC_KEY,
  },
  apis: {
    notifications: {
      url: process.env.NOTIFICATIONS_URL,
      key: process.env.NOTIFICATIONS_API_KEY,
    },
    storage: {
      url: process.env.STORAGE_API_URL,
    },
    drive: {
      url: process.env.DRIVE_API_URL,
    },
  },
  mailer: {
    sandbox: process.env.SENDGRID_MODE_SANDBOX === 'true' || false,
    from: process.env.SENDGRID_FROM || 'hello@internxt.com',
    name: process.env.SENDGRID_NAME || 'Internxt',
    apiKey: process.env.SENDGRID_API_KEY || null,
    templates: {
      sendLinkCreateSender:
        process.env.SENDGRID_TEMPLATE_SEND_LINK_CREATE_SENDER || '',
      sendLinkCreateReceiver:
        process.env.SENDGRID_TEMPLATE_SEND_LINK_CREATE_RECEIVER || '',
      welcomeVerifyEmail:
        process.env.SENDGRID_TEMPLATE_DRIVE_WELCOME_EMAIL_VERIFICATION || '',
    },
  },
  newsletter: {
    apiKey: process.env.MAILERLITE_API_KEY,
    groupId: process.env.MAILERLITE_GROUP_ID,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  auth: {
    basic: {
      username: process.env.AUTH_BASIC_USERNAME,
      password: process.env.AUTH_BASIC_PASSWORD,
    },
  },
});
