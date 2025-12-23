/**
 * @fileoverview Jest test setup and global utilities
 * 
 * Provides custom matchers and utility functions for tests.
 */

// ============================================================================
// CRITICAL: This export {} makes this file a module
// Without it, declare global won't work properly
// ============================================================================
export {};

// ============================================================================
// Global Type Declarations
// ============================================================================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * Check if error is of specific type
       * @param expected Error constructor
       */
      toThrowErrorType(expected: new (...args: any[]) => Error): R;
      
      /**
       * Check if array contains item matching predicate
       * @param predicate Function to test each item
       */
      toContainItemMatching(predicate: (item: any) => boolean): R;
    }
  }

  /**
   * Wait for condition to be true
   * @param condition Function that returns boolean
   * @param timeout Maximum time to wait in ms
   * @param interval Check interval in ms
   */
  function waitFor(
    condition: () => boolean,
    timeout?: number,
    interval?: number
  ): Promise<void>;

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   */
  function sleep(ms: number): Promise<void>;
}

// ============================================================================
// Custom Jest Matchers
// ============================================================================

expect.extend({
  /**
   * Check if thrown error is of specific type
   */
  toThrowErrorType(
    received: () => void,
    expected: new (...args: any[]) => Error
  ) {
    try {
      received();
      return {
        pass: false,
        message: () => `Expected function to throw ${expected.name}, but it didn't throw`,
      };
    } catch (error) {
      const pass = error instanceof expected;
      return {
        pass,
        message: () =>
          pass
            ? `Expected function not to throw ${expected.name}`
            : `Expected function to throw ${expected.name}, but it threw ${
                error instanceof Error ? error.constructor.name : typeof error
              }`,
      };
    }
  },

  /**
   * Check if array contains item matching predicate
   */
  toContainItemMatching(received: any[], predicate: (item: any) => boolean) {
    const pass = received.some(predicate);
    return {
      pass,
      message: () =>
        pass
          ? 'Expected array not to contain matching item'
          : 'Expected array to contain matching item',
    };
  },
});

// ============================================================================
// Global Utility Functions
// ============================================================================

/**
 * Wait for a condition to be true with timeout
 * 
 * @param condition Function that returns boolean
 * @param timeout Maximum time to wait (default: 5000ms)
 * @param interval Check interval (default: 100ms)
 * @throws Error if timeout is reached
 * 
 * @example
 * ```typescript
 * await waitFor(() => eventBus.publishedEvents.length > 0, 2000, 50);
 * ```
 */
(global as any).waitFor = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/**
 * Sleep for specified milliseconds
 * 
 * @param ms Milliseconds to sleep
 * 
 * @example
 * ```typescript
 * await sleep(1000); // Sleep for 1 second
 * ```
 */
(global as any).sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};