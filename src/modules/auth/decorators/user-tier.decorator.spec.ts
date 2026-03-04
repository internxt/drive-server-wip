import { type ExecutionContext } from '@nestjs/common';
import { userTierFactory } from './user-tier.decorator';
import { v4 } from 'uuid';

describe('userTierFactory', () => {
  let mockGetRequest: jest.Mock;

  beforeEach(() => {
    mockGetRequest = jest.fn();
  });

  const createMockExecutionContext = (req): ExecutionContext =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: mockGetRequest.mockReturnValue(req),
      }),
    }) as unknown as ExecutionContext;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When authInfo has tier, then return tier object', () => {
    const mockTier = {
      id: v4(),
      label: 'premium_individual',
      context: 'drive',
    };
    const mockRequest = {
      authInfo: { tier: mockTier },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = userTierFactory(null, mockExecutionContext);

    expect(result).toEqual(mockTier);
  });

  it('When authInfo has no tier, then return undefined', () => {
    const mockRequest = {
      authInfo: { tier: undefined },
    };
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = userTierFactory(null, mockExecutionContext);

    expect(result).toBeUndefined();
  });

  it('When authInfo does not exist, then return undefined', () => {
    const mockRequest = {};
    const mockExecutionContext = createMockExecutionContext(mockRequest);

    const result = userTierFactory(null, mockExecutionContext);

    expect(result).toBeUndefined();
  });
});
