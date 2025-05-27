import { Id } from "./data-interface";
/**
 * Data stream
 *
 * @remarks
 * {@link DataStream} offers an always up to date stream of items from a {@link DataSet} or {@link DataView}.
 * That means that the stream is evaluated at the time of iteration, conversion to another data type or when {@link cache} is called, not when the {@link DataStream} was created.
 * Multiple invocations of for example {@link toItemArray} may yield different results (if the data source like for example {@link DataSet} gets modified).
 * @typeParam Item - The item type this stream is going to work with.
 */
export declare class DataStream<Item> implements Iterable<[Id, Item]> {
    private readonly _pairs;
    /**
     * Create a new data stream.
     *
     * @param pairs - The id, item pairs.
     */
    constructor(pairs: Iterable<[Id, Item]>);
    /**
     * Return an iterable of key, value pairs for every entry in the stream.
     */
    [Symbol.iterator](): IterableIterator<[Id, Item]>;
    /**
     * Return an iterable of key, value pairs for every entry in the stream.
     */
    entries(): IterableIterator<[Id, Item]>;
    /**
     * Return an iterable of keys in the stream.
     */
    keys(): IterableIterator<Id>;
    /**
     * Return an iterable of values in the stream.
     */
    values(): IterableIterator<Item>;
    /**
     * Return an array containing all the ids in this stream.
     *
     * @remarks
     * The array may contain duplicities.
     * @returns The array with all ids from this stream.
     */
    toIdArray(): Id[];
    /**
     * Return an array containing all the items in this stream.
     *
     * @remarks
     * The array may contain duplicities.
     * @returns The array with all items from this stream.
     */
    toItemArray(): Item[];
    /**
     * Return an array containing all the entries in this stream.
     *
     * @remarks
     * The array may contain duplicities.
     * @returns The array with all entries from this stream.
     */
    toEntryArray(): [Id, Item][];
    /**
     * Return an object map containing all the items in this stream accessible by ids.
     *
     * @remarks
     * In case of duplicate ids (coerced to string so `7 == '7'`) the last encoutered appears in the returned object.
     * @returns The object map of all id → item pairs from this stream.
     */
    toObjectMap(): Record<Id, Item>;
    /**
     * Return a map containing all the items in this stream accessible by ids.
     *
     * @returns The map of all id → item pairs from this stream.
     */
    toMap(): Map<Id, Item>;
    /**
     * Return a set containing all the (unique) ids in this stream.
     *
     * @returns The set of all ids from this stream.
     */
    toIdSet(): Set<Id>;
    /**
     * Return a set containing all the (unique) items in this stream.
     *
     * @returns The set of all items from this stream.
     */
    toItemSet(): Set<Item>;
    /**
     * Cache the items from this stream.
     *
     * @remarks
     * This method allows for items to be fetched immediatelly and used (possibly multiple times) later.
     * It can also be used to optimize performance as {@link DataStream} would otherwise reevaluate everything upon each iteration.
     *
     * ## Example
     * ```javascript
     * const ds = new DataSet([…])
     *
     * const cachedStream = ds.stream()
     *   .filter(…)
     *   .sort(…)
     *   .map(…)
     *   .cached(…) // Data are fetched, processed and cached here.
     *
     * ds.clear()
     * chachedStream // Still has all the items.
     * ```
     * @returns A new {@link DataStream} with cached items (detached from the original {@link DataSet}).
     */
    cache(): DataStream<Item>;
    /**
     * Get the distinct values of given property.
     *
     * @param callback - The function that picks and possibly converts the property.
     * @typeParam T - The type of the distinct value.
     * @returns A set of all distinct properties.
     */
    distinct<T>(callback: (item: Item, id: Id) => T): Set<T>;
    /**
     * Filter the items of the stream.
     *
     * @param callback - The function that decides whether an item will be included.
     * @returns A new data stream with the filtered items.
     */
    filter(callback: (item: Item, id: Id) => boolean): DataStream<Item>;
    /**
     * Execute a callback for each item of the stream.
     *
     * @param callback - The function that will be invoked for each item.
     */
    forEach(callback: (item: Item, id: Id) => boolean): void;
    /**
     * Map the items into a different type.
     *
     * @param callback - The function that does the conversion.
     * @typeParam Mapped - The type of the item after mapping.
     * @returns A new data stream with the mapped items.
     */
    map<Mapped>(callback: (item: Item, id: Id) => Mapped): DataStream<Mapped>;
    /**
     * Get the item with the maximum value of given property.
     *
     * @param callback - The function that picks and possibly converts the property.
     * @returns The item with the maximum if found otherwise null.
     */
    max(callback: (item: Item, id: Id) => number): Item | null;
    /**
     * Get the item with the minimum value of given property.
     *
     * @param callback - The function that picks and possibly converts the property.
     * @returns The item with the minimum if found otherwise null.
     */
    min(callback: (item: Item, id: Id) => number): Item | null;
    /**
     * Reduce the items into a single value.
     *
     * @param callback - The function that does the reduction.
     * @param accumulator - The initial value of the accumulator.
     * @typeParam T - The type of the accumulated value.
     * @returns The reduced value.
     */
    reduce<T>(callback: (accumulator: T, item: Item, id: Id) => T, accumulator: T): T;
    /**
     * Sort the items.
     *
     * @param callback - Item comparator.
     * @returns A new stream with sorted items.
     */
    sort(callback: (itemA: Item, itemB: Item, idA: Id, idB: Id) => number): DataStream<Item>;
}
//# sourceMappingURL=data-stream.d.ts.map