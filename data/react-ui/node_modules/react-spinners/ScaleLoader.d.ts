import * as React from "react";
import { LoaderHeightWidthRadiusProps } from "./helpers/props";
declare function ScaleLoader({ loading, color, speedMultiplier, cssOverride, height, width, radius, margin, barCount, ...additionalprops }: LoaderHeightWidthRadiusProps & {
    barCount?: number;
}): React.JSX.Element | null;
export default ScaleLoader;
