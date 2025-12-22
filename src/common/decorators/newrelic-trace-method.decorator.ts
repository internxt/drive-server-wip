import newrelic from 'newrelic';

export function TraceMethod(customName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const segmentName =
      customName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      return newrelic.startSegment(segmentName, true, () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
