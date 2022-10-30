/**
 * TODO: remove catch block, this is a workaround
 * since promise doesn't have built in cancellation
 * hence even after early termination, subsequent promises will still execute
 * this is only an issue with Polkadot RPC unit testing
 * because connection get tear down after all tests
 * and when rpc call that we don't care about anymore still get execute
 * Error("cannot call send() while not connected") will be thrown
 */
export default class PromiseExtra<T> extends Promise<T> {
  static filter<T>(
    values: Iterable<Promise<T>>,
    predicate: (
      value: T,
      index: number,
      iterable: Iterable<Promise<T>>
    ) => boolean,
    length?: number,
    thisArg?: any
  ): Promise<T[]> {
    return new Promise((resolve) => {
      const results: T[] = [];

      const promises = Array.from(values, (promise, index) =>
        promise.then((value) => {
          if (predicate?.bind(thisArg)(value, index, values) ?? true) {
            results.push(value);
          }
          if (length !== undefined && results.length >= length) {
            resolve(results.slice(0, length));
          }
        })
      );

      Promise.allSettled(promises).then(() =>
        resolve(results.slice(0, length))
      );
    });
  }

  static some<T>(
    values: Iterable<Promise<T>>,
    predicate: (
      value: T,
      index: number,
      array: Iterable<Promise<T>>
    ) => unknown,
    thisArg?: any
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const promises = Array.from(values, async (promise, index) => {
        try {
          if (predicate.bind(thisArg)(await promise, index, values)) {
            resolve(true);
            return true;
          } else {
            return false;
          }
        } catch {
          return false;
        }
      });

      const results = await Promise.all(promises);

      resolve(results.some((result) => result));
    });
  }

  static every<T>(
    values: Iterable<Promise<T>>,
    predicate: (
      value: T,
      index: number,
      array: Iterable<Promise<T>>
    ) => unknown,
    thisArg?: any
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const promises = Array.from(values, async (promise, index) => {
        try {
          if (!predicate.bind(thisArg)(await promise, index, values)) {
            resolve(false);
            return false;
          } else {
            return true;
          }
        } catch {
          resolve(false);
          return false;
        }
      });

      const results = await Promise.all(promises);

      resolve(results.every((result) => result));
    });
  }
}
