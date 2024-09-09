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
    gateway: process.env.GATEWAY_SECRET,
    driveGateway: process.env.DRIVE_GATEWAY_PUBLIC_SECRET,
    captcha: process.env.RECAPTCHA_V3,
    jitsiSecret: process.env.JITSI_SECRET,
  },
  apis: {
    notifications: {
      url: process.env.NOTIFICATIONS_URL,
      key: process.env.NOTIFICATIONS_API_KEY,
    },
    storage: {
      url: process.env.STORAGE_API_URL,
      auth: {
        username: process.env.GATEWAY_USER,
        password: process.env.GATEWAY_PASS,
      },
    },
    drive: {
      url: process.env.DRIVE_API_URL,
    },
    share: {
      url: process.env.SHARE_DOMAINS,
    },
    captcha: {
      url: process.env.RECAPTCHA_V3_ENDPOINT,
      threshold: process.env.RECAPTCHA_V3_SCORE_THRESHOLD,
    },
    payments: {
      url: process.env.PAYMENTS_API_URL,
    },
  },
  apn: {
    url: process.env.APN_URL,
    secret: process.env.APN_SECRET,
    keyId: 'Z33KSJJSSG',
    teamId: process.env.APN_TEAM_ID,
    bundleId: process.env.APN_BUNDLE_ID,
  },
  clients: {
    drive: {
      web: process.env.HOST_DRIVE_WEB,
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
      recoverAccountEmail:
        process.env.SENDGRID_TEMPLATE_DRIVE_RECOVER_ACCOUNT || '',
      invitationToSharingReceived:
        process.env.SENDGRID_TEMPLATE_DRIVE_SHARING_INVITE_RECEIVED || '',
      invitationToSharingGuestReceived:
        process.env.SENDGRID_TEMPLATE_DRIVE_SHARING_INVITE_GUEST_RECEIVED || '',
      removedFromSharing:
        process.env.SENDGRID_TEMPLATE_DRIVE_SHARING_USER_REMOVED || '',
      updatedSharingRole:
        process.env.SENDGRID_TEMPLATE_DRIVE_SHARING_ROLE_UPDATED || '',
      updateUserEmail:
        process.env.SENDGRID_TEMPLATE_DRIVE_UPDATE_USER_EMAIL || '',
      unblockAccountEmail:
        process.env.SENDGRID_TEMPLATE_DRIVE_UNBLOCK_ACCOUNT || '',
      invitationToWorkspaceUser:
        process.env.WORKSPACES_USER_INVITATION_EMAIL_ID || '',
      invitationToWorkspaceGuestUser:
        process.env.WORKSPACES_GUEST_USER_INVITATION_EMAIL_ID || '',
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
  users: {
    preCreatedPassword: process.env.PCREATED_USERS_PASSWORD,
  },
  jitsi: {
    appId: process.env.JITSI_APP_ID,
    apiKey: process.env.JITSI_API_KEY,
  },
  avatar: {
    accessKey: process.env.AVATAR_ACCESS_KEY || 'internxt',
    secretKey: process.env.AVATAR_SECRET_KEY || 'internxt',
    bucket: process.env.AVATAR_BUCKET || 'avatars',
    region: process.env.AVATAR_REGION || 'us-east-1',
    endpoint: process.env.AVATAR_ENDPOINT,
    endpointForSignedUrls: process.env.AVATAR_ENDPOINT_REWRITE_FOR_SIGNED_URLS,
    forcePathStyle: process.env.AVATAR_FORCE_PATH_STYLE || 'true',
  },
});
