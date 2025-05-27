import { DataInterface, DataInterfaceForEachOptions, DataInterfaceGetIdsOptions, DataInterfaceGetOptions, DataInterfaceGetOptionsArray, DataInterfaceGetOptionsObject, DataInterfaceMapOptions, DeepPartial, FullItem, Id, PartItem, UpdateItem } from "./data-interface";
import { Queue, QueueOptions } from "./queue";
import { DataSetPart } from "./data-set-part";
import { DataStream } from "./data-stream";
/**
 * Initial DataSet configuration object.
 *
 * @typeParam IdProp - Name of the property that contains the id.
 */
export interface DataSetInitialOptions<IdProp extends string> {
    /**
     * The name of the field containing the id of the items. When data is fetched from a server which uses some specific field to identify items, this field name can be specified in the DataSet using the option `fieldId`. For example [CouchDB](http://couchdb.apache.org/) uses the field `'_id'` to identify documents.
     */
    fieldId?: IdProp;
    /**
     * Queue data changes ('add', 'update', 'remove') and flush them at once. The queue can be flushed manually by calling `DataSet.flush()`, or can be flushed after a configured delay or maximum number of entries.
     *
     * When queue is true, a queue is created with default options. Options can be specified by providing an object.
     */
    queue?: QueueOptions | false;
}
/** DataSet configuration object. */
export interface DataSetOptions {
    /**
     * Queue configuration object or false if no queue should be used.
     *
     * - If false and there was a queue before it will be flushed and then removed.
     * - If {@link QueueOptions} the existing queue will be reconfigured or a new queue will be created.
     */
    queue?: Queue | QueueOptions | false;
}
/**
 * # DataSet
 *
 * Vis.js comes with a flexible DataSet, which can be used to hold and
 * manipulate unstructured data and listen for changes in the data. The DataSet
 * is key/value based. Data items can be added, updated and removed from the
 * DataSet, and one can subscribe to changes in the DataSet. The data in the
 * DataSet can be filtered and ordered. Data can be normalized when appending it
 * to the DataSet as well.
 *
 * ## Example
 *
 * The following example shows how to use a DataSet.
 *
 * ```javascript
 * // create a DataSet
 * var options = {};
 * var data = new vis.DataSet(options);
 *
 * // add items
 * // note that the data items can contain different properties and data formats
 * data.add([
 *   {id: 1, text: 'item 1', date: new Date(2013, 6, 20), group: 1, first: true},
 *   {id: 2, text: 'item 2', date: '2013-06-23', group: 2},
 *   {id: 3, text: 'item 3', date: '2013-06-25', group: 2},
 *   {id: 4, text: 'item 4'}
 * ]);
 *
 * // subscribe to any change in the DataSet
 * data.on('*', function (event, properties, senderId) {
 *   console.log('event', event, properties);
 * });
 *
 * // update an existing item
 * data.update({id: 2, group: 1});
 *
 * // remove an item
 * data.remove(4);
 *
 * // get all ids
 * var ids = data.getIds();
 * console.log('ids', ids);
 *
 * // get a specific item
 * var item1 = data.get(1);
 * console.log('item1', item1);
 *
 * // retrieve a filtered subset of the data
 * var items = data.get({
 *   filter: function (item) {
 *     return item.group == 1;
 *   }
 * });
 * console.log('filtered items', items);
 * ```
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export declare class DataSet<Item extends PartItem<IdProp>, IdProp extends string = "id"> extends DataSetPart<Item, IdProp> implements DataInterface<Item, IdProp> {
    /** Flush all queued calls. */
    flush?: () => void;
    /** @inheritDoc */
    length: number;
    /** @inheritDoc */
    get idProp(): IdProp;
    private readonly _options;
    private readonly _data;
    private readonly _idProp;
    private _queue;
    /**
     * @param options - DataSet configuration.
     */
    constructor(options?: DataSetInitialOptions<IdProp>);
    /**
     * @param data - An initial set of items for the new instance.
     * @param options - DataSet configuration.
     */
    constructor(data: Item[], options?: DataSetInitialOptions<IdProp>);
    /**
     * Set new options.
     *
     * @param options - The new options.
     */
    setOptions(options?: DataSetOptions): void;
    /**
     * Add a data item or an array with items.
     *
     * After the items are added to the DataSet, the DataSet will trigger an event `add`. When a `senderId` is provided, this id will be passed with the triggered event to all subscribers.
     *
     * ## Example
     *
     * ```javascript
     * // create a DataSet
     * const data = new vis.DataSet()
     *
     * // add items
     * const ids = data.add([
     *   { id: 1, text: 'item 1' },
     *   { id: 2, text: 'item 2' },
     *   { text: 'item without an id' }
     * ])
     *
     * console.log(ids) // [1, 2, '<UUIDv4>']
     * ```
     *
     * @param data - Items to be added (ids will be generated if missing).
     * @param senderId - Sender id.
     * @returns addedIds - Array with the ids (generated if not present) of the added items.
     * @throws When an item with the same id as any of the added items already exists.
     */
    add(data: Item | Item[], senderId?: Id | null): (string | number)[];
    /**
     * Update existing items. When an item does not exist, it will be created.
     *
     * @remarks
     * The provided properties will be merged in the existing item. When an item does not exist, it will be created.
     *
     * After the items are updated, the DataSet will trigger an event `add` for the added items, and an event `update`. When a `senderId` is provided, this id will be passed with the triggered event to all subscribers.
     *
     * ## Example
     *
     * ```javascript
     * // create a DataSet
     * const data = new vis.DataSet([
     *   { id: 1, text: 'item 1' },
     *   { id: 2, text: 'item 2' },
     *   { id: 3, text: 'item 3' }
     * ])
     *
     * // update items
     * const ids = data.update([
     *   { id: 2, text: 'item 2 (updated)' },
     *   { id: 4, text: 'item 4 (new)' }
     * ])
     *
     * console.log(ids) // [2, 4]
     * ```
     *
     * ## Warning for TypeScript users
     * This method may introduce partial items into the data set. Use add or updateOnly instead for better type safety.
     * @param data - Items to be updated (if the id is already present) or added (if the id is missing).
     * @param senderId - Sender id.
     * @returns updatedIds - The ids of the added (these may be newly generated if there was no id in the item from the data) or updated items.
     * @throws When the supplied data is neither an item nor an array of items.
     */
    update(data: DeepPartial<Item> | DeepPartial<Item>[], senderId?: Id | null): Id[];
    /**
     * Update existing items. When an item does not exist, an error will be thrown.
     *
     * @remarks
     * The provided properties will be deeply merged into the existing item.
     * When an item does not exist (id not present in the data set or absent), an error will be thrown and nothing will be changed.
     *
     * After the items are updated, the DataSet will trigger an event `update`.
     * When a `senderId` is provided, this id will be passed with the triggered event to all subscribers.
     *
     * ## Example
     *
     * ```javascript
     * // create a DataSet
     * const data = new vis.DataSet([
     *   { id: 1, text: 'item 1' },
     *   { id: 2, text: 'item 2' },
     *   { id: 3, text: 'item 3' },
     * ])
     *
     * // update items
     * const ids = data.update([
     *   { id: 2, text: 'item 2 (updated)' }, // works
     *   // { id: 4, text: 'item 4 (new)' }, // would throw
     *   // { text: 'item 4 (new)' }, // would also throw
     * ])
     *
     * console.log(ids) // [2]
     * ```
     * @param data - Updates (the id and optionally other props) to the items in this data set.
     * @param senderId - Sender id.
     * @returns updatedIds - The ids of the updated items.
     * @throws When the supplied data is neither an item nor an array of items, when the ids are missing.
     */
    updateOnly(data: UpdateItem<Item, IdProp> | UpdateItem<Item, IdProp>[], senderId?: Id | null): Id[];
    /** @inheritDoc */
    get(): FullItem<Item, IdProp>[];
    /** @inheritDoc */
    get(options: DataInterfaceGetOptionsArray<Item>): FullItem<Item, IdProp>[];
    /** @inheritDoc */
    get(options: DataInterfaceGetOptionsObject<Item>): Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    get(options: DataInterfaceGetOptions<Item>): FullItem<Item, IdProp>[] | Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    get(id: Id): null | FullItem<Item, IdProp>;
    /** @inheritDoc */
    get(id: Id, options: DataInterfaceGetOptionsArray<Item>): null | FullItem<Item, IdProp>;
    /** @inheritDoc */
    get(id: Id, options: DataInterfaceGetOptionsObject<Item>): Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    get(id: Id, options: DataInterfaceGetOptions<Item>): null | FullItem<Item, IdProp> | Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    get(ids: Id[]): FullItem<Item, IdProp>[];
    /** @inheritDoc */
    get(ids: Id[], options: DataInterfaceGetOptionsArray<Item>): FullItem<Item, IdProp>[];
    /** @inheritDoc */
    get(ids: Id[], options: DataInterfaceGetOptionsObject<Item>): Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    get(ids: Id[], options: DataInterfaceGetOptions<Item>): FullItem<Item, IdProp>[] | Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    get(ids: Id | Id[], options?: DataInterfaceGetOptions<Item>): null | FullItem<Item, IdProp> | FullItem<Item, IdProp>[] | Record<Id, FullItem<Item, IdProp>>;
    /** @inheritDoc */
    getIds(options?: DataInterfaceGetIdsOptions<Item>): Id[];
    /** @inheritDoc */
    getDataSet(): DataSet<Item, IdProp>;
    /** @inheritDoc */
    forEach(callback: (item: Item, id: Id) => void, options?: DataInterfaceForEachOptions<Item>): void;
    /** @inheritDoc */
    map<T>(callback: (item: Item, id: Id) => T, options?: DataInterfaceMapOptions<Item, T>): T[];
    private _filterFields;
    /**
     * Sort the provided array with items.
     *
     * @param items - Items to be sorted in place.
     * @param order - A field name or custom sort function.
     * @typeParam T - The type of the items in the items array.
     */
    private _sort;
    /**
     * Remove an item or multiple items by “reference” (only the id is used) or by id.
     *
     * The method ignores removal of non-existing items, and returns an array containing the ids of the items which are actually removed from the DataSet.
     *
     * After the items are removed, the DataSet will trigger an event `remove` for the removed items. When a `senderId` is provided, this id will be passed with the triggered event to all subscribers.
     *
     * ## Example
     * ```javascript
     * // create a DataSet
     * const data = new vis.DataSet([
     *   { id: 1, text: 'item 1' },
     *   { id: 2, text: 'item 2' },
     *   { id: 3, text: 'item 3' }
     * ])
     *
     * // remove items
     * const ids = data.remove([2, { id: 3 }, 4])
     *
     * console.log(ids) // [2, 3]
     * ```
     *
     * @param id - One or more items or ids of items to be removed.
     * @param senderId - Sender id.
     * @returns The ids of the removed items.
     */
    remove(id: Id | Item | (Id | Item)[], senderId?: Id | null): Id[];
    /**
     * Remove an item by its id or reference.
     *
     * @param id - Id of an item or the item itself.
     * @returns The removed item if removed, null otherwise.
     */
    private _remove;
    /**
     * Clear the entire data set.
     *
     * After the items are removed, the {@link DataSet} will trigger an event `remove` for all removed items. When a `senderId` is provided, this id will be passed with the triggered event to all subscribers.
     *
     * @param senderId - Sender id.
     * @returns removedIds - The ids of all removed items.
     */
    clear(senderId?: Id | null): Id[];
    /**
     * Find the item with maximum value of a specified field.
     *
     * @param field - Name of the property that should be searched for max value.
     * @returns Item containing max value, or null if no items.
     */
    max(field: keyof Item): Item | null;
    /**
     * Find the item with minimum value of a specified field.
     *
     * @param field - Name of the property that should be searched for min value.
     * @returns Item containing min value, or null if no items.
     */
    min(field: keyof Item): Item | null;
    distinct<T extends keyof Item>(prop: T): Item[T][];
    distinct(prop: string): unknown[];
    /**
     * Add a single item. Will fail when an item with the same id already exists.
     *
     * @param item - A new item to be added.
     * @returns Added item's id. An id is generated when it is not present in the item.
     */
    private _addItem;
    /**
     * Update a single item: merge with existing item.
     * Will fail when the item has no id, or when there does not exist an item with the same id.
     *
     * @param update - The new item
     * @returns The id of the updated item.
     */
    private _updateItem;
    /** @inheritDoc */
    stream(ids?: Iterable<Id>): DataStream<Item>;
    get testLeakData(): Map<Id, FullItem<Item, IdProp>>;
    get testLeakIdProp(): IdProp;
    get testLeakOptions(): DataSetInitialOptions<IdProp>;
    get testLeakQueue(): Queue<this> | null;
    set testLeakQueue(v: Queue<this> | null);
}
//# sourceMappingURL=data-set.d.ts.map