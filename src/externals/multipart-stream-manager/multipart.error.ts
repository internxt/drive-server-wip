type MultipartUploadErrorCode =
  | 'LIMIT_PART_COUNT'
  | 'LIMIT_FILE_SIZE'
  | 'LIMIT_FILE_COUNT'
  | 'LIMIT_FIELD_KEY'
  | 'LIMIT_FIELD_VALUE'
  | 'LIMIT_FIELD_COUNT'
  | 'LIMIT_UNEXPECTED_FILE'
  | 'MISSING_FIELD_NAME';

const errorMessages: { [key in MultipartUploadErrorCode]: string } = {
  LIMIT_PART_COUNT: 'Too many parts',
  LIMIT_FILE_SIZE: 'File too large',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_FIELD_KEY: 'Field name too long',
  LIMIT_FIELD_VALUE: 'Field value too long',
  LIMIT_FIELD_COUNT: 'Too many fields',
  LIMIT_UNEXPECTED_FILE: 'Unexpected field',
  MISSING_FIELD_NAME: 'Field name missing',
};

class MultipartUploadError extends Error {
  public code: MultipartUploadErrorCode;
  public field?: string;

  constructor(code: MultipartUploadErrorCode, field?: string) {
    super(errorMessages[code]);
    Error.captureStackTrace(this, this.constructor);
    this.name = 'MultipartUploadError';
    this.code = code;
    this.field = field;
  }
}

export default MultipartUploadError;
