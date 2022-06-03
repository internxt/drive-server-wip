export default () => ({
  port: parseInt(process.env.PORT) || 3000,
  database: {
    host: process.env.RDS_HOSTNAME,
    port: parseInt(process.env.RDS_PORT) || 3306,
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DBNAME,
  },
  secrets: {
    magicIv: process.env.MAGIC_IV,
    magicSalt: process.env.MAGIC_SALT,
    cryptoSecret: process.env.CRYPTO_SECRET,
    cryptoSecret2: process.env.CRYPTO_SECRET2,
  },
  apis: {
    notifications: {
      url: process.env.NOTIFICATIONS_URL,
      key: process.env.NOTIFICATIONS_API_KEY,
    },
  },
});
