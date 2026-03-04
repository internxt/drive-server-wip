import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jwtDecoratorFactory } from './get-jwt.decorator';

describe('jwtDecoratorFactory', () => {
  let mockGetRequest: jest.Mock;

  beforeEach(() => {
    mockGetRequest = jest.fn();
  });

  const createMockExecutionContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: mockGetRequest.mockReturnValue(req),
      }),
    }) as unknown as ExecutionContext;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When authorization header contains valid Bearer token, it should return the token', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';
    const mockRequest = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = jwtDecoratorFactory(null, mockExecutionContext);

    expect(result).toBe(token);
  });

  it('When authorization header is missing, it should throw', () => {
    const mockRequest = {
      headers: {},
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    expect(() => jwtDecoratorFactory(null, mockExecutionContext)).toThrow(
      new UnauthorizedException('Authorization header is missing'),
    );
  });

  it('When authorization header does not start with Bearer, it should throw', () => {
    const mockRequest = {
      headers: {
        authorization:
          'Basic eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30',
      },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    expect(() => jwtDecoratorFactory(null, mockExecutionContext)).toThrow(
      new UnauthorizedException('Invalid authorization header format'),
    );
  });

  it('When authorization header is Bearer without token, it should throw', () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer ',
      },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    expect(() => jwtDecoratorFactory(null, mockExecutionContext)).toThrow(
      new UnauthorizedException('Token is missing'),
    );
  });
});
