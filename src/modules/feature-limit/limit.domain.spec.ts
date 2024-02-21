import { newFeatureLimit } from '../../../test/fixtures';
import { LimitTypes } from './limits.enum';

describe('Limit Domain', () => {
  describe('isBooleanLimit()', () => {
    it('When limit is boolean type, then it should return true', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'false',
      });

      expect(limit.isBooleanLimit()).toBeTruthy();
    });

    it('When limit is not boolean type, then it should return false', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      expect(limit.isBooleanLimit()).toBeFalsy();
    });
  });

  describe('shouldLimitBeEnforced()', () => {
    it('When limit is boolean type and value is false, then limit should be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'false',
      });

      expect(limit.shouldLimitBeEnforced()).toBeTruthy();
    });

    it('When limit is boolean type and value is true, then limit should not be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Boolean,
        value: 'true',
      });

      expect(limit.shouldLimitBeEnforced()).toBeFalsy();
    });

    it('When limit is counter type and current count from context is greater or equal than value, then limit should be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      expect(limit.shouldLimitBeEnforced({ currentCount: 3 })).toBeTruthy();
    });

    it('When limit is counter type and current count from context is less than value, then limit should be not be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      expect(limit.shouldLimitBeEnforced({ currentCount: 2 })).toBeFalsy();
    });

    it('When bypassLimit is passed from the context, then limit should not be enforced', async () => {
      const limit = newFeatureLimit({
        type: LimitTypes.Counter,
        value: '3',
      });

      expect(limit.shouldLimitBeEnforced({ bypassLimit: true })).toBeFalsy();
    });
  });
});
