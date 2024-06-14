import { compareVersion, convertSizeMiddleware } from './convert-size';
import { NextFunction, Request, Response } from 'express';

describe('Convert size middleware', () => {
  describe('convertSizeMiddleware', () => {
    it('When client is not drive-desktop, then it should call next', () => {
      const req = {} as Partial<Request>;
      req.headers = {
        'internxt-client': 'drive-web',
        'internxt-version': '2.2.0.40',
        'user-agent': 'Intel Mac OS X 10_15_7',
      };
      const next = jest.fn() as NextFunction;
      convertSizeMiddleware(req as Request, {} as Response, next);
      expect(next).toHaveBeenCalled();
    });
    it('When user-agent is not mac, then it should call next', () => {
      const req = {} as Partial<Request>;
      req.headers = {
        'internxt-client': 'drive-desktop',
        'internxt-version': '2.2.0.40',
        'user-agent': 'Windows NT 10.0; Win64; x64',
      };
      const next = jest.fn() as NextFunction;
      convertSizeMiddleware(req as Request, {} as Response, next);
      expect(next).toHaveBeenCalled();
    });
    it('When client version is greater than 2.2.0.50, then it should call next', () => {
      const req = {} as Partial<Request>;
      req.headers = {
        'internxt-client': 'drive-desktop',
        'internxt-version': '2.2.0.60',
        'user-agent': 'Intel Mac OS X 10_15_7',
      };
      const next = jest.fn() as NextFunction;
      convertSizeMiddleware(req as Request, {} as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('compareVersion', () => {
    it('When v1 is greater than v2, then it should return 1', () => {
      expect(compareVersion('2.2.0.50.1', '2.2.0.50')).toBe(1);
    });
    it('When v1 is greater than v2, then it should return 1', () => {
      expect(compareVersion('2.2.1', '2.2.0.50')).toBe(1);
    });
    it('When v1 is less than v2, then it should return -1', () => {
      expect(compareVersion('2.2.0.49', '2.2.0.50')).toBe(-1);
    });
    it('When v1 is less than v2, then it should return -1', () => {
      expect(compareVersion('2.1.10.50', '2.2.0.50')).toBe(-1);
    });
    it('When v1 is equal to v2, then it should return 0', () => {
      expect(compareVersion('1.0.0', '1.0.0')).toBe(0);
    });
  });
});
