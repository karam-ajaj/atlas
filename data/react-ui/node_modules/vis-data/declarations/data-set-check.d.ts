import { PartItem } from "./data-interface";
import { DataSet } from "./data-set";
/**
 * Check that given value is compatible with Vis Data Set interface.
 *
 * @param idProp - The expected property to contain item id.
 * @param v - The value to be tested.
 * @returns True if all expected values and methods match, false otherwise.
 */
export declare function isDataSetLike<Item extends PartItem<IdProp>, IdProp extends string = "id">(idProp: IdProp, v: any): v is DataSet<Item, IdProp>;
//# sourceMappingURL=data-set-check.d.ts.map