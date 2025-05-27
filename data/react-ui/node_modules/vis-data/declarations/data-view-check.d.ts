import { DataView } from "./data-view";
import { PartItem } from "./data-interface";
/**
 * Check that given value is compatible with Vis Data View interface.
 *
 * @param idProp - The expected property to contain item id.
 * @param v - The value to be tested.
 * @returns True if all expected values and methods match, false otherwise.
 */
export declare function isDataViewLike<Item extends PartItem<IdProp>, IdProp extends string = "id">(idProp: IdProp, v: any): v is DataView<Item, IdProp>;
//# sourceMappingURL=data-view-check.d.ts.map