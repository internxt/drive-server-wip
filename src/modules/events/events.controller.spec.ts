import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { EventsController } from './events.controller';
import { EventsUseCases } from './events.usecase';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { User } from '../user/user.domain';
import { newUser } from '../../../test/fixtures';

describe('EventsController', () => {
  let controller: EventsController;
  let eventsUseCases: DeepMocked<EventsUseCases>;

  const mockUser = newUser({ attributes: { email: 'test@internxt.com' } });

  const mockIncompleteCheckoutDto: IncompleteCheckoutDto = {
    completeCheckoutUrl: 'https://drive.internxt.com/checkout/complete',
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    controller = moduleRef.get<EventsController>(EventsController);
    eventsUseCases = moduleRef.get(EventsUseCases);
  });

  it('When tests are started, then it should be defined', () => {
    expect(controller).toBeDefined();
    expect(eventsUseCases).toBeDefined();
  });

  describe('handle incomplete checkout', () => {
    it('When valid user and dto are provided, then should call usecase with correct parameters', async () => {
      const expectedResult = { success: true };
      eventsUseCases.handleIncompleteCheckoutEvent.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.handleIncompleteCheckout(
        mockUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual(expectedResult);
      expect(eventsUseCases.handleIncompleteCheckoutEvent).toHaveBeenCalledWith(
        mockUser,
        mockIncompleteCheckoutDto,
      );
    });

    it('When different user is provided, then should pass correct user to usecase', async () => {
      const differentUser = newUser({
        attributes: { email: 'different@internxt.com' },
      });
      const expectedResult = { success: true };
      eventsUseCases.handleIncompleteCheckoutEvent.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.handleIncompleteCheckout(
        differentUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual(expectedResult);
      expect(eventsUseCases.handleIncompleteCheckoutEvent).toHaveBeenCalledWith(
        differentUser,
        mockIncompleteCheckoutDto,
      );
    });

    it('When usecase throws error, then should propagate error', async () => {
      const mockError = new Error('SendGrid service unavailable');
      eventsUseCases.handleIncompleteCheckoutEvent.mockRejectedValue(mockError);

      await expect(
        controller.handleIncompleteCheckout(
          mockUser,
          mockIncompleteCheckoutDto,
        ),
      ).rejects.toThrow('SendGrid service unavailable');
    });
  });
});
