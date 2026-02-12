/// <reference types="vite/client" />

declare module 'react-plotly.js' {
    import * as React from 'react';
    import { PlotlyHTMLElement } from 'plotly.js';

    export interface PlotParams {
        data: any[];
        layout?: any;
        frames?: any[];
        config?: any;
        onInitialized?: (figure: Readonly<Figure>, graphDiv: Readonly<PlotlyHTMLElement>) => void;
        onUpdate?: (figure: Readonly<Figure>, graphDiv: Readonly<PlotlyHTMLElement>) => void;
        onPurge?: (figure: Readonly<Figure>, graphDiv: Readonly<PlotlyHTMLElement>) => void;
        onError?: (err: Error) => void;
        divId?: string;
        className?: string;
        style?: React.CSSProperties;
        useResizeHandler?: boolean;
        debug?: boolean;
        revision?: number;
    }

    export interface Figure {
        data: any[];
        layout: any;
        frames: any[] | null;
    }

    const Plot: React.ComponentType<PlotParams>;
    export default Plot;
}
