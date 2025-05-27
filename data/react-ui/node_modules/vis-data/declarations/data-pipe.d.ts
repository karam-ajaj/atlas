import { DataInterface, PartItem } from "./data-interface";
import { DataSet } from "./data-set";
/**
 * This interface is used to control the pipe.
 */
export interface DataPipe {
    /**
     * Take all items from the source data set or data view, transform them as
     * configured and update the target data set.
     */
    all(): this;
    /**
     * Start observing the source data set or data view, transforming the items
     * and updating the target data set.
     *
     * @remarks
     * The current content of the source data set will be ignored. If you for
     * example want to process all the items that are already there use:
     * `pipe.all().start()`.
     */
    start(): this;
    /**
     * Stop observing the source data set or data view, transforming the items
     * and updating the target data set.
     */
    stop(): this;
}
/**
 * This interface is used to construct the pipe.
 */
export declare type DataPipeFactory = InstanceType<typeof DataPipeUnderConstruction>;
/**
 * Create new data pipe.
 *
 * @param from - The source data set or data view.
 * @remarks
 * Example usage:
 * ```typescript
 * interface AppItem {
 *   whoami: string;
 *   appData: unknown;
 *   visData: VisItem;
 * }
 * interface VisItem {
 *   id: number;
 *   label: string;
 *   color: string;
 *   x: number;
 *   y: number;
 * }
 *
 * const ds1 = new DataSet<AppItem, "whoami">([], { fieldId: "whoami" });
 * const ds2 = new DataSet<VisItem, "id">();
 *
 * const pipe = createNewDataPipeFrom(ds1)
 *   .filter((item): boolean => item.enabled === true)
 *   .map<VisItem, "id">((item): VisItem => item.visData)
 *   .to(ds2);
 *
 * pipe.start();
 * ```
 * @returns A factory whose methods can be used to configure the pipe.
 */
export declare function createNewDataPipeFrom<SI extends PartItem<SP>, SP extends string = "id">(from: DataInterface<SI, SP>): DataPipeUnderConstruction<SI, SP>;
/**
 * Internal implementation of the pipe factory. This should be accessible
 * only through `createNewDataPipeFrom` from the outside.
 *
 * @typeParam TI - Target item type.
 * @typeParam TP - Target item type's id property name.
 */
declare class DataPipeUnderConstruction<SI extends PartItem<SP>, SP extends string = "id"> {
    private readonly _source;
    /**
     * Array transformers used to transform items within the pipe. This is typed
     * as any for the sake of simplicity.
     */
    private readonly _transformers;
    /**
     * Create a new data pipe factory. This is an internal constructor that
     * should never be called from outside of this file.
     *
     * @param _source - The source data set or data view for this pipe.
     */
    constructor(_source: DataInterface<SI, SP>);
    /**
     * Filter the items.
     *
     * @param callback - A filtering function that returns true if given item
     * should be piped and false if not.
     * @returns This factory for further configuration.
     */
    filter(callback: (item: SI) => boolean): DataPipeUnderConstruction<SI, SP>;
    /**
     * Map each source item to a new type.
     *
     * @param callback - A mapping function that takes a source item and returns
     * corresponding mapped item.
     * @typeParam TI - Target item type.
     * @typeParam TP - Target item type's id property name.
     * @returns This factory for further configuration.
     */
    map<TI extends PartItem<TP>, TP extends string = "id">(callback: (item: SI) => TI): DataPipeUnderConstruction<TI, TP>;
    /**
     * Map each source item to zero or more items of a new type.
     *
     * @param callback - A mapping function that takes a source item and returns
     * an array of corresponding mapped items.
     * @typeParam TI - Target item type.
     * @typeParam TP - Target item type's id property name.
     * @returns This factory for further configuration.
     */
    flatMap<TI extends PartItem<TP>, TP extends string = "id">(callback: (item: SI) => TI[]): DataPipeUnderConstruction<TI, TP>;
    /**
     * Connect this pipe to given data set.
     *
     * @param target - The data set that will receive the items from this pipe.
     * @returns The pipe connected between given data sets and performing
     * configured transformation on the processed items.
     */
    to(target: DataSet<SI, SP>): DataPipe;
}
export {};
//# sourceMappingURL=data-pipe.d.ts.map