// Plot wrapper using plotly.js-dist-min (browser-safe, no Node.js deps)
// All components should import Plot from this file, NOT from 'react-plotly.js' directly
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-ignore - plotly.js-dist-min has no types
import Plotly from 'plotly.js-dist-min';

const Plot = createPlotlyComponent(Plotly);
export default Plot;
