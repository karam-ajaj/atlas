import { Assignable } from "vis-util/esnext";
import { DataSet } from "./data-set";
import { DataStream } from "./data-stream";
declare type ValueOf<T> = T[keyof T];
/** Valid id type. */
export declare type Id = number | string;
/** Nullable id type. */
export declare type OptId = undefined | null | Id;
/**
 * Determine whether a value can be used as an id.
 *
 * @param value - Input value of unknown type.
 * @returns True if the value is valid id, false otherwise.
 */
export declare function isId(value: unknown): value is Id;
/**
 * Make an object deeply partial.
 */
export declare type DeepPartial<T> = T extends any[] | Function | Node ? T : T extends object ? {
    [key in keyof T]?: DeepPartial<T[key]>;
} : T;
/**
 * An item that may ({@link Id}) or may not (absent, undefined or null) have an id property.
 *
 * @typeParam IdProp - Name of the property that contains the id.
 */
export declare type PartItem<IdProp extends string> = Partial<Record<IdProp, OptId>>;
/**
 * An item that has a property containing an id and all other required properties of given item type.
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export declare type FullItem<Item extends PartItem<IdProp>, IdProp extends string> = Item & Record<IdProp, Id>;
/**
 * An item that has a property containing an id and optionally other properties of given item type.
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export declare type UpdateItem<Item extends PartItem<IdProp>, IdProp extends string> = Assignable<FullItem<Item, IdProp>> & Record<IdProp, Id>;
/**
 * Test whether an item has an id (is a {@link FullItem}).
 *
 * @param item - The item to be tested.
 * @param idProp - Name of the id property.
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 * @returns True if this value is a {@link FullItem}, false otherwise.
 */
export declare function isFullItem<Item extends PartItem<IdProp>, IdProp extends string>(item: Item, idProp: IdProp): item is FullItem<Item, IdProp>;
/** Add event payload. */
export interface AddEventPayload {
    /** Ids of added items. */
    items: Id[];
}
/** Update event payload. */
export interface UpdateEventPayload<Item extends PartItem<IdProp>, IdProp extends string> {
    /** Ids of updated items. */
    items: Id[];
    /** Items as they were before this update. */
    oldData: FullItem<Item, IdProp>[];
    /**
     * Items as they are now.
     *
     * @deprecated Just get the data from the data set or data view.
     */
    data: FullItem<Item, IdProp>[];
}
/** Remove event payload. */
export interface RemoveEventPayload<Item extends PartItem<IdProp>, IdProp extends string> {
    /** Ids of removed items. */
    items: Id[];
    /** Items as they were before their removal. */
    oldData: FullItem<Item, IdProp>[];
}
/**
 * Map of event payload types (event name → payload).
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export interface EventPayloads<Item extends PartItem<IdProp>, IdProp extends string> {
    add: AddEventPayload;
    update: UpdateEventPayload<Item, IdProp>;
    remove: RemoveEventPayload<Item, IdProp>;
}
/**
 * Map of event payload types including any event (event name → payload).
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export interface EventPayloadsWithAny<Item extends PartItem<IdProp>, IdProp extends string> extends EventPayloads<Item, IdProp> {
    "*": ValueOf<EventPayloads<Item, IdProp>>;
}
/**
 * Map of event callback types (event name → callback).
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export interface EventCallbacks<Item extends PartItem<IdProp>, IdProp extends string> {
    /**
     * @param name - The name of the event ({@link EventName}).
     * @param payload - Data about the items affected by this event.
     * @param senderId - A senderId, optionally provided by the application code which triggered the event. If senderId is not provided, the argument will be `null`.
     */
    add(name: "add", payload: AddEventPayload | null, senderId?: Id | null): void;
    /**
     * @param name - The name of the event ({@link EventName}).
     * @param payload - Data about the items affected by this event.
     * @param senderId - A senderId, optionally provided by the application code which triggered the event. If senderId is not provided, the argument will be `null`.
     */
    update(name: "update", payload: UpdateEventPayload<Item, IdProp> | null, senderId?: Id | null): void;
    /**
     * @param name - The name of the event ({@link EventName}).
     * @param payload - Data about the items affected by this event.
     * @param senderId - A senderId, optionally provided by the application code which triggered the event. If senderId is not provided, the argument will be `null`.
     */
    remove(name: "remove", payload: RemoveEventPayload<Item, IdProp> | null, senderId?: Id | null): void;
}
/**
 * Map of event callback types including any event (event name → callback).
 *
 * @typeParam Item - Item type that may or may not have an id.
 * @typeParam IdProp - Name of the property that contains the id.
 */
export interface EventCallbacksWithAny<Item extends PartItem<IdProp>, IdProp extends string> extends EventCallbacks<Item, IdProp> {
    /**
     * @param name - The name of the event ({@link EventName}).
     * @param payload - Data about the items affected by this event.
     * @param senderId - A senderId, optionally provided by the application code which triggered the event. If senderId is not provided, the argument will be `null`.
     */
    "*"<N extends keyof EventCallbacks<Item, IdProp>>(name: N, payload: EventPayloads<Item, IdProp>[N], senderId?: Id | null): void;
}
/** Available event names. */
export declare type EventName = keyof EventPayloads<never, "">;
/** Available event names and '*' to listen for all. */
export declare type EventNameWithAny = keyof EventPayloadsWithAny<never, "">;
/**
 * Data interface order parameter.
 * - A string value determines which property will be used for sorting (using < and > operators for numeric comparison).
 * - A function will be used the same way as in Array.sort.
 *
 * @typeParam Item - Item type that may or may not have an id.
 */
export declare type DataInterfaceOrder<Item> = keyof Item | ((a: Item, b: Item) => number);
/**
 * Data interface get options (return type independent).
 *
 * @typeParam Item - Item type that may or may not have an id.
 */
export interface DataInterfaceGetOptionsBase<Item> {
    /**
     * An array with field names, or an object with current field name and new field name that the field is returned as. By default, all properties of the items are emitted. When fields is defined, only the properties whose name is specified in fields will be included in the returned items.
     *
     * @remarks
     * Warning**: There is no TypeScript support for this.
     */
    fields?: string[] | Record<string, string>;
    /** Items can be filtered on specific properties by providing a filter function. A filter function is executed for each of the items in the DataSet, and is called with the item as parameter. The function must return a boolean. All items for which the filter function returns true will be emitted. */
    filter?: (item: Item) => boolean;
    /** Order the items by a field name or custom sort function. */
    order?: DataInterfaceOrder<Item>;
}
/**
 * Data interface get options (returns a single item or an array).
 *
 * @remarks
 * Whether an item or and array of items is returned is determined by the type of the id(s) argument.
 * If an array of ids is requested an array of items will be returned.
 * If a single id is requested a single item (or null if the id doesn't correspond to any item) will be returned.
 * @typeParam Item - Item type that may or may not have an id.
 */
export interface DataInterfaceGetOptionsArray<Item> extends DataInterfaceGetOptionsBase<Item> {
    /** Items will be returned as a single item (if invoked with an id) or an array of items (if invoked with an array of ids). */
    returnType?: undefined | "Array";
}
/**
 * Data interface get options (returns an object).
 *
 * @remarks
 * The returned object has ids as keys and items as values of corresponding ids.
 * @typeParam Item - Item type that may or may not have an id.
 */
export interface DataInterfaceGetOptionsObject<Item> extends DataInterfaceGetOptionsBase<Item> {
    /** Items will be returned as an object map (id → item). */
    returnType: "Object";
}
/**
 * Data interface get options (returns single item, an array or object).
 *
 * @typeParam Item - Item type that may or may not have an id.
 */
export declare type DataInterfaceGetOptions<Item> = DataInterfaceGetOptionsArray<Item> | DataInterfaceGetOptionsObject<Item>;
/**
 * Data interface get ids options.
 *
 * @typeParam Item - Item type that may or may not have an id.
 */
export interface DataInterfaceGetIdsOptions<Item> {
    /** Items can be filtered on specific properties by providing a filter function. A filter function is executed for each of the items in the DataSet, and is called with the item as parameter. The function must return a boolean. All items for which the filter function returns true will be emitted. */
    filter?: (item: Item) => boolean;
    /** Order the items by a field name or custom sort function. */
    order?: DataInterfaceOrder<Item>;
}
/**
 * Data interface for each options.
 *
 * @typeParam Item - Item type that may or may not have an id.
 */
export interface DataInterfaceForEachOptions<Item> {
    /** An array with field names, or an object with current field name and new field name that the field is returned as. By default, all properties of the items are emitted. When fields is defined, only the properties whose name is specified in fields will be included in the returned items. */
    fields?: string[] | Record<string, string>;
    /** Items can be filtered on specific properties by providing a filter function. A filter function is executed for each of the items in the DataSet, and is called with the item as parameter. The function must return a boolean. All items for which the filter function returns true will be emitted. */
    filter?: (item: Item) => boolean;
    /** Order the items by a field name or custom sort function. */
    order?: DataInterfaceOrder<Item>;
}
/**
 * Data interface map oprions.
 *
 * @typeParam Original - The original item type in the data.
 * @typeParam Mapped - The type after mapping.
 */
export interface DataInterfaceMapOptions<Original, Mapped> {
    /** An array with field names, or an object with current field name and new field name that the field is returned as. By default, all properties of the items are emitted. When fields is defined, only the properties whose name is specified in fields will be included in the returned items. */
    fields?: string[] | Record<string, string>;
    /** Items can be filtered on specific properties by providing a filter function. A filter function is executed for each of the items in the DataSet, and is called with the item as parameter. The function must return a boolean. All items for which the filter function returns true will be emitted. */
    filter?: (item: Original) => boolean;
    /** Order the items by a field name or custom sort function. */
    order?: DataInterfaceOrder<Mapped>;
}
/**
 * Common interface for data sets and data view.
 *
 * @typeParam Item - Item type that may or may not have an id (missing ids will be generated upon insertion).
 * @typeParam IdProp - Name of the property on the Item type that contains the id.
 */
export interface DataInterface<Item extends PartItem<IdProp>, IdProp extends string = "id"> {
    /** The number of items. */
    length: number;
    /** The key of id property. */
    idProp: IdProp;
    /**
     * Add a universal event listener.
     *
     * @remarks The `*` event is triggered when any of the events `add`, `update`, and `remove` occurs.
     * @param event - Event name.
     * @param callback - Callback function.
     */
    on(event: "*", callback: EventCallbacksWithAny<Item, IdProp>["*"]): void;
    /**
     * Add an `add` event listener.
     *
     * @remarks The `add` event is triggered when an item or a set of items is added, or when an item is updated while not yet existing.
     * @param event - Event name.
     * @param callback - Callback function.
     */
    on(event: "add", callback: EventCallbacksWithAny<Item, IdProp>["add"]): void;
    /**
     * Add a `remove` event listener.
     *
     * @remarks The `remove` event is triggered when an item or a set of items is removed.
     * @param event - Event name.
     * @param callback - Callback function.
     */
    on(event: "remove", callback: EventCallbacksWithAny<Item, IdProp>["remove"]): void;
    /**
     * Add an `update` event listener.
     *
     * @remarks The `update` event is triggered when an existing item or a set of existing items is updated.
     * @param event - Event name.
     * @param callback - Callback function.
     */
    on(event: "update", callback: EventCallbacksWithAny<Item, IdProp>["update"]): void;
    /**
     * Remove a universal event listener.
     *
     * @param event - Event name.
     * @param callback - Callback function.
     */
    off(event: "*", callback: EventCallbacksWithAny<Item, IdProp>["*"]): void;
    /**
     * Remove an `add` event listener.
     *
     * @param event - Event name.
     * @param callback - Callback function.
     */
    off(event: "add", callback: EventCallbacksWithAny<Item, IdProp>["add"]): void;
    /**
     * Remove a `remove` event listener.
     *
     * @param event - Event name.
     * @param callback - Callback function.
     */
    off(event: "remove", callback: EventCallbacksWithAny<Item, IdProp>["remove"]): void;
    /**
     * Remove an `update` event listener.
     *
     * @param event - Event name.
     * @param callback - Callback function.
     */
    off(event: "update", callback: EventCallbacksWithAny<Item, IdProp>["update"]): void;
    /**
     * Get all the items.
     *
     * @returns An array containing all the items.
     */
    get(): FullItem<Item, IdProp>[];
    /**
     * Get all the items.
     *
     * @param options - Additional options.
     * @returns An array containing requested items.
     */
    get(options: DataInterfaceGetOptionsArray<Item>): FullItem<Item, IdProp>[];
    /**
     * Get all the items.
     *
     * @param options - Additional options.
     * @returns An object map of items (may be an empty object if there are no items).
     */
    get(options: DataInterfaceGetOptionsObject<Item>): Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get all the items.
     *
     * @param options - Additional options.
     * @returns An array containing requested items or if requested an object map of items (may be an empty object if there are no items).
     */
    get(options: DataInterfaceGetOptions<Item>): FullItem<Item, IdProp>[] | Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get one item.
     *
     * @param id - The id of the item.
     * @returns The item or null if the id doesn't correspond to any item.
     */
    get(id: Id): null | FullItem<Item, IdProp>;
    /**
     * Get one item.
     *
     * @param id - The id of the item.
     * @param options - Additional options.
     * @returns The item or null if the id doesn't correspond to any item.
     */
    get(id: Id, options: DataInterfaceGetOptionsArray<Item>): null | FullItem<Item, IdProp>;
    /**
     * Get one item.
     *
     * @param id - The id of the item.
     * @param options - Additional options.
     * @returns An object map of items (may be an empty object if no item was found).
     */
    get(id: Id, options: DataInterfaceGetOptionsObject<Item>): Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get one item.
     *
     * @param id - The id of the item.
     * @param options - Additional options.
     * @returns The item if found or null otherwise. If requested an object map with 0 to 1 items.
     */
    get(id: Id, options: DataInterfaceGetOptions<Item>): null | FullItem<Item, IdProp> | Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get multiple items.
     *
     * @param ids - An array of requested ids.
     * @returns An array of found items (ids that do not correspond to any item are omitted).
     */
    get(ids: Id[]): FullItem<Item, IdProp>[];
    /**
     * Get multiple items.
     *
     * @param ids - An array of requested ids.
     * @param options - Additional options.
     * @returns An array of found items (ids that do not correspond to any item are omitted).
     */
    get(ids: Id[], options: DataInterfaceGetOptionsArray<Item>): FullItem<Item, IdProp>[];
    /**
     * Get multiple items.
     *
     * @param ids - An array of requested ids.
     * @param options - Additional options.
     * @returns An object map of items (may be an empty object if no item was found).
     */
    get(ids: Id[], options: DataInterfaceGetOptionsObject<Item>): Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get multiple items.
     *
     * @param ids - An array of requested ids.
     * @param options - Additional options.
     * @returns An array of found items (ids that do not correspond to any item are omitted).
     * If requested an object map of items (may be an empty object if no item was found).
     */
    get(ids: Id[], options: DataInterfaceGetOptions<Item>): FullItem<Item, IdProp>[] | Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get items.
     *
     * @param ids - Id or ids to be returned.
     * @param options - Options to specify iteration details.
     * @returns The items (format is determined by ids (single or array) and the options.
     */
    get(ids: Id | Id[], options?: DataInterfaceGetOptions<Item>): null | FullItem<Item, IdProp> | FullItem<Item, IdProp>[] | Record<Id, FullItem<Item, IdProp>>;
    /**
     * Get the DataSet to which the instance implementing this interface is connected.
     * In case there is a chain of multiple DataViews, the root DataSet of this chain is returned.
     *
     * @returns The data set that actually contains the data.
     */
    getDataSet(): DataSet<Item, IdProp>;
    /**
     * Get ids of items.
     *
     * @remarks
     * No guarantee is given about the order of returned ids unless an ordering function is supplied.
     * @param options - Additional configuration.
     * @returns An array of requested ids.
     */
    getIds(options?: DataInterfaceGetIdsOptions<Item>): Id[];
    /**
     * Execute a callback function for each item.
     *
     * @remarks
     * No guarantee is given about the order of iteration unless an ordering function is supplied.
     * @param callback - Executed in similar fashion to Array.forEach callback, but instead of item, index, array receives item, id.
     * @param options - Options to specify iteration details.
     */
    forEach(callback: (item: Item, id: Id) => void, options?: DataInterfaceForEachOptions<Item>): void;
    /**
     * Map each item into different item and return them as an array.
     *
     * @remarks
     * No guarantee is given about the order of iteration even if ordering function is supplied (the items are sorted after the mapping).
     * @param callback - Array.map-like callback, but only with the first two params.
     * @param options - Options to specify iteration details.
     * @returns The mapped items.
     */
    map<T>(callback: (item: Item, id: Id) => T, options?: DataInterfaceMapOptions<Item, T>): T[];
    /**
     * Stream.
     *
     * @param ids - Ids of the items to be included in this stream (missing are ignored), all if omitted.
     * @returns The data stream for this data set.
     */
    stream(ids?: Iterable<Id>): DataStream<Item>;
}
export {};
//# sourceMappingURL=data-interface.d.ts.map