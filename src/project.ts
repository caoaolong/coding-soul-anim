import { makeProject } from "@motion-canvas/core";

import "./global.css";

import poemIntro from "./scenes/poem_intro?scene";
import slideshow from "./scenes/slideshow?scene";
import complexityPlot from "./scenes/complexity_plot?scene";
import dataTable from "./scenes/data_table?scene";
import functionPlot from "./scenes/function_plot?scene";

export default makeProject({
  scenes: [slideshow, poemIntro, dataTable, complexityPlot, functionPlot],
});
