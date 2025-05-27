/** Queue configuration object. */
export interface QueueOptions {
    /** The queue will be flushed automatically after an inactivity of this delay in milliseconds. By default there is no automatic flushing (`null`). */
    delay?: null | number;
    /** When the queue exceeds the given maximum number of entries, the queue is flushed automatically. Default value is `Infinity`. */
    max?: number;
}
/**
 * Queue extending options.
 *
 * @typeParam T - The type of method names to be replaced by queued versions.
 */
export interface QueueExtendOptions<T> {
    /** A list with method names of the methods on the object to be replaced with queued ones. */
    replace: T[];
    /** When provided, the queue will be flushed automatically after an inactivity of this delay in milliseconds. Default value is null. */
    delay?: number;
    /** When the queue exceeds the given maximum number of entries, the queue is flushed automatically. Default value of max is Infinity. */
    max?: number;
}
/**
 * Queue call entry.
 * - A function to be executed.
 * - An object with function, args, context (like function.bind(context, ...args)).
 */
declare type QueueCallEntry = Function | {
    fn: Function;
    args: unknown[];
} | {
    fn: Function;
    args: unknown[];
    context: unknown;
};
/**
 * A queue.
 *
 * @typeParam T - The type of method names to be replaced by queued versions.
 */
export declare class Queue<T = never> {
    /** Delay in milliseconds. If defined the queue will be periodically flushed. */
    delay: null | number;
    /** Maximum number of entries in the queue before it will be flushed. */
    max: number;
    private readonly _queue;
    private _timeout;
    private _extended;
    /**
     * Construct a new Queue.
     *
     * @param options - Queue configuration.
     */
    constructor(options?: QueueOptions);
    /**
     * Update the configuration of the queue.
     *
     * @param options - Queue configuration.
     */
    setOptions(options?: QueueOptions): void;
    /**
     * Extend an object with queuing functionality.
     * The object will be extended with a function flush, and the methods provided in options.replace will be replaced with queued ones.
     *
     * @param object - The object to be extended.
     * @param options - Additional options.
     * @returns The created queue.
     */
    static extend<O extends {
        flush?: () => void;
    }, K extends string>(object: O, options: QueueExtendOptions<K>): Queue<O>;
    /**
     * Destroy the queue. The queue will first flush all queued actions, and in case it has extended an object, will restore the original object.
     */
    destroy(): void;
    /**
     * Replace a method on an object with a queued version.
     *
     * @param object - Object having the method.
     * @param method - The method name.
     */
    replace<M extends string>(object: Record<M, () => void>, method: M): void;
    /**
     * Queue a call.
     *
     * @param entry - The function or entry to be queued.
     */
    queue(entry: QueueCallEntry): void;
    /**
     * Check whether the queue needs to be flushed.
     */
    private _flushIfNeeded;
    /**
     * Flush all queued calls
     */
    flush(): void;
}
export {};
//# sourceMappingURL=queue.d.ts.map