import { makeProject } from "@motion-canvas/core";

import complexityPlot from "./scenes/complexity_plot?scene";
import dataTable from "./scenes/data_table?scene";
import functionPlot from "./scenes/function_plot?scene";

export default makeProject({
  scenes: [dataTable, complexityPlot, functionPlot],
});
