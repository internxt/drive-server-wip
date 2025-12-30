jest.mock('newrelic');

import newrelic from 'newrelic';
import { TraceMethod } from './newrelic-trace-method.decorator';

const mockedNewrelic = newrelic as jest.Mocked<typeof newrelic>;

describe('TraceMethod Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNewrelic.startSegment.mockImplementation((name, record, handler) => {
      return handler();
    });
  });

  it('When applied without custom name, then uses ClassName.methodName', () => {
    class TestClass {
      @TraceMethod()
      testMethod() {
        return 'result';
      }
    }

    const instance = new TestClass();
    instance.testMethod();

    expect(mockedNewrelic.startSegment).toHaveBeenCalledWith(
      'TestClass.testMethod',
      true,
      expect.any(Function),
    );
  });

  it('When applied with custom name, then uses provided name', () => {
    class TestClass {
      @TraceMethod('CustomSegmentName')
      testMethod() {
        return 'result';
      }
    }

    const instance = new TestClass();
    instance.testMethod();

    expect(mockedNewrelic.startSegment).toHaveBeenCalledWith(
      'CustomSegmentName',
      true,
      expect.any(Function),
    );
  });

  it('When method has arguments and return value, then both pass through correctly', () => {
    class TestClass {
      @TraceMethod()
      testMethod(arg1: string, arg2: number) {
        return `${arg1}-${arg2}`;
      }
    }

    const instance = new TestClass();
    const result = instance.testMethod('test', 42);

    expect(result).toBe('test-42');
  });

  it('When method uses this context, then this is correctly bound', () => {
    class TestClass {
      private value = 'instance value';

      @TraceMethod()
      getValue() {
        return this.value;
      }

      @TraceMethod()
      setValue(newValue: string) {
        this.value = newValue;
        return this.value;
      }
    }

    const instance = new TestClass();

    expect(instance.getValue()).toBe('instance value');
    expect(instance.setValue('new value')).toBe('new value');
    expect(instance.getValue()).toBe('new value');
  });

  it('When method is async, then Promise is correctly handled', async () => {
    class TestClass {
      @TraceMethod()
      async asyncMethod(userId: number, name: string) {
        return { userId, name, processed: true };
      }
    }

    const instance = new TestClass();
    const result = await instance.asyncMethod(123, 'John');

    expect(result).toEqual({ userId: 123, name: 'John', processed: true });
    expect(mockedNewrelic.startSegment).toHaveBeenCalledTimes(1);
  });

  it('When method throws error, then error propagates through decorator', () => {
    class TestClass {
      @TraceMethod()
      throwError() {
        throw new Error('Test error');
      }
    }

    const instance = new TestClass();

    expect(() => instance.throwError()).toThrow('Test error');
    expect(mockedNewrelic.startSegment).toHaveBeenCalledTimes(1);
  });

  it('When async method rejects, then error propagates through decorator', async () => {
    class TestClass {
      @TraceMethod()
      async asyncThrowError() {
        throw new Error('Async test error');
      }
    }

    const instance = new TestClass();

    await expect(instance.asyncThrowError()).rejects.toThrow(
      'Async test error',
    );
  });

  it('When multiple methods are decorated, then each has correct segment name', () => {
    class TestClass {
      @TraceMethod()
      method1() {
        return 'result1';
      }

      @TraceMethod()
      method2() {
        return 'result2';
      }

      @TraceMethod('CustomName')
      method3() {
        return 'result3';
      }
    }

    const instance = new TestClass();

    instance.method1();
    expect(mockedNewrelic.startSegment).toHaveBeenLastCalledWith(
      'TestClass.method1',
      true,
      expect.any(Function),
    );

    instance.method2();
    expect(mockedNewrelic.startSegment).toHaveBeenLastCalledWith(
      'TestClass.method2',
      true,
      expect.any(Function),
    );

    instance.method3();
    expect(mockedNewrelic.startSegment).toHaveBeenLastCalledWith(
      'CustomName',
      true,
      expect.any(Function),
    );

    expect(mockedNewrelic.startSegment).toHaveBeenCalledTimes(3);
  });

  it('When newrelic.startSegment is called, then record flag is true', () => {
    class TestClass {
      @TraceMethod()
      testMethod() {
        return 'result';
      }
    }

    const instance = new TestClass();
    instance.testMethod();

    const [, recordFlag] = mockedNewrelic.startSegment.mock.calls[0];
    expect(recordFlag).toBe(true);
  });

  it('When newrelic.startSegment callback executes, then original method is invoked', () => {
    const originalMethodSpy = jest.fn().mockReturnValue('spy result');

    class TestClass {
      @TraceMethod()
      testMethod() {
        return originalMethodSpy();
      }
    }

    const instance = new TestClass();
    instance.testMethod();

    expect(originalMethodSpy).toHaveBeenCalledTimes(1);
  });
});
