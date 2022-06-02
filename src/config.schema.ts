import * as Joi from '@hapi/joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().required(),
  RDS_USERNAME: Joi.string().required(),
  RDS_PASSWORD: Joi.string().required(),
  RDS_HOSTNAME: Joi.string().required(),
  RDS_PORT: Joi.number().default(5432).required(),
  RDS_DBNAME: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
});
