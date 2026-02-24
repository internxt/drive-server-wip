import { type ExecutionContext } from '@nestjs/common';
import { requesterFactory } from './requester.decorator';

describe('requesterFactory', () => {
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

  it('When requester is present, it should return requester', () => {
    const mockRequest = {
      requester: { id: 1, name: 'John Doe' },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = requesterFactory(null, mockExecutionContext);

    expect(result).toEqual(mockRequest.requester);
  });

  it('When requester is absent, it should default to user', () => {
    const mockRequest = {
      user: { id: 2, name: 'Jane Doe' },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = requesterFactory(null, mockExecutionContext);

    expect(result).toEqual(mockRequest.user);
  });

  it('When both requester and user are present, it should return requester', () => {
    const mockRequest = {
      requester: { id: 1, name: 'John Doe' },
      user: { id: 2, name: 'Jane Doe' },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = requesterFactory(null, mockExecutionContext);

    expect(result).toEqual(mockRequest.requester);
  });
});
