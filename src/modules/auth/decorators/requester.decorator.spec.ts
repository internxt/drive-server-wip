import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { requesterFactory } from './requester.decorator';

describe('requesterFactory', () => {
  let mockGetRequest: Mock;

  beforeEach(() => {
    mockGetRequest = vi.fn();
  });

  const createMockExecutionContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: mockGetRequest.mockReturnValue(req),
      }),
    }) as unknown as ExecutionContext;

  afterEach(() => {
    vi.clearAllMocks();
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
