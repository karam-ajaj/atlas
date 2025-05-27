import { DataInterface, DataInterfaceForEachOptions, DataInterfaceGetIdsOptions, DataInterfaceGetOptions, DataInterfaceGetOptionsArray, DataInterfaceGetOptionsObject, DataInterfaceMapOptions, FullItem, Id, PartItem } from "./data-interface";
import { DataSet } from "./data-set";
import { DataSetPart } from "./data-set-part";
import { DataStream } from "./data-stream";
/**
 * Data view options.
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export interface DataViewOptions<Item, IdProp extends string> {
    /**
     * The name of the field containing the id of the items. When data is fetched from a server which uses some specific field to identify items, this field name can be specified in the DataSet using the option `fieldId`. For example [CouchDB](http://couchdb.apache.org/) uses the field `'_id'` to identify documents.
     */
    fieldId?: IdProp;
    /** Items can be filtered on specific properties by providing a filter function. A filter function is executed for each of the items in the DataSet, and is called with the item as parameter. The function must return a boolean. All items for which the filter function returns true will be emitted. */
    filter?: (item: Item) => boolean;
}
/**
 * DataView
 *
 * A DataView offers a filtered and/or formatted view on a DataSet. One can subscribe to changes in a DataView, and easily get filtered or formatted data without having to specify filters and field types all the time.
 *
 * ## Example
 * ```javascript
 * // create a DataSet
 * var data = new vis.DataSet();
 * data.add([
 *   {id: 1, text: 'item 1', date: new Date(2013, 6, 20), group: 1, first: true},
 *   {id: 2, text: 'item 2', date: '2013-06-23', group: 2},
 *   {id: 3, text: 'item 3', date: '2013-06-25', group: 2},
 *   {id: 4, text: 'item 4'}
 * ]);
 *
 * // create a DataView
 * // the view will only contain items having a property group with value 1,
 * // and will only output fields id, text, and date.
 * var view = new vis.DataView(data, {
 *   filter: function (item) {
 *     return (item.group == 1);
 *   },
 *   fields: ['id', 'text', 'date']
 * });
 *
 * // subscribe to any change in the DataView
 * view.on('*', function (event, properties, senderId) {
 *   console.log('event', event, properties);
 * });
 *
 * // update an item in the data set
 * data.update({id: 2, group: 1});
 *
 * // get all ids in the view
 * var ids = view.getIds();
 * console.log('ids', ids); // will output [1, 2]
 *
 * // get all items in the view
 * var items = view.get();
 * ```
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export declare class DataView<Item extends PartItem<IdProp>, IdProp extends string = "id"> extends DataSetPart<Item, IdProp> implements DataInterface<Item, IdProp> {
    /** @inheritDoc */
    length: number;
    /** @inheritDoc */
    get idProp(): IdProp;
    private readonly _listener;
    private _data;
    private readonly _ids;
    private readonly _options;
    /**
     * Create a DataView.
     *
     * @param data - The instance containing data (directly or indirectly).
     * @param options - Options to configure this data view.
     */
    constructor(data: DataInterface<Item, IdProp>, options?: DataViewOptions<Item, IdProp>);
    /**
     * Set a data source for the view.
     *
     * @param data - The instance containing data (directly or indirectly).
     * @remarks
     * Note that when the data view is bound to a data set it won't be garbage
     * collected unless the data set is too. Use `dataView.setData(null)` or
     * `dataView.dispose()` to enable garbage collection before you lose the last
     * reference.
     */
    setData(data: DataInterface<Item, IdProp>): void;
    /**
     * Refresh the DataView.
     * Useful when the DataView has a filter function containing a variable parameter.
     */
    refresh(): void;
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
    forEach(callback: (item: Item, id: Id) => void, options?: DataInterfaceForEachOptions<Item>): void;
    /** @inheritDoc */
    map<T>(callback: (item: Item, id: Id) => T, options?: DataInterfaceMapOptions<Item, T>): T[];
    /** @inheritDoc */
    getDataSet(): DataSet<Item, IdProp>;
    /** @inheritDoc */
    stream(ids?: Iterable<Id>): DataStream<Item>;
    /**
     * Render the instance unusable prior to garbage collection.
     *
     * @remarks
     * The intention of this method is to help discover scenarios where the data
     * view is being used when the programmer thinks it has been garbage collected
     * already. It's stricter version of `dataView.setData(null)`.
     */
    dispose(): void;
    /**
     * Event listener. Will propagate all events from the connected data set to the subscribers of the DataView, but will filter the items and only trigger when there are changes in the filtered data set.
     *
     * @param event - The name of the event.
     * @param params - Parameters of the event.
     * @param senderId - Id supplied by the sender.
     */
    private _onEvent;
}
//# sourceMappingURL=data-view.d.ts.map