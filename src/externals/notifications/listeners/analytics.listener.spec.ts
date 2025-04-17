import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { AnalyticsListener } from './analytics.listener';
import { DeactivationRequestEvent } from '../events/deactivation-request.event';
import { AnalyticsTrackName } from '../../../lib/analytics';
import { Request } from 'express';
import { newUser } from '../../../../test/fixtures';

jest.mock('../../../lib/analytics');
jest.mock('../../../lib/request-context');
jest.mock('geoip-lite');
jest.mock('node-device-detector');
jest.mock('./analytics.listener', () => ({
  ...jest.requireActual('./analytics.listener'),
  getContext: jest.fn(),
}));

describe('AnalyticsListener', () => {
  let analyticsListener: AnalyticsListener;
  let requestMock: DeepMocked<Request>;
  let mockAnalytics: DeepMocked<(typeof analyticsListener)['analytics']>;

  beforeEach(async () => {
    mockAnalytics = createMock();

    analyticsListener = new AnalyticsListener();
    analyticsListener.analytics = mockAnalytics;

    requestMock = createMock<Request>();

    jest.clearAllMocks();
  });

  describe('handleDeactivationRequest', () => {
    it('When deactivation request is handled, then it should call analytics with the correct parameters', async () => {
      const mockUser = newUser();
      const event: DeactivationRequestEvent = new DeactivationRequestEvent(
        mockUser,
        requestMock,
      );

      await analyticsListener.handleDeactivationRequest(event);

      expect(mockAnalytics.track).toHaveBeenCalledWith({
        userId: mockUser.uuid,
        event: AnalyticsTrackName.DeactivationRequest,
        context: expect.anything(),
      });
    });
  });
});
