import { makeProject } from "@motion-canvas/core";

import "./global.css";

import courseCover from "./scenes/course_cover?scene";
import floatScene from "./scenes/float?scene";
import bTree from "./scenes/b_tree?scene";
import formulaScene from "./scenes/formula?scene";
import nBytes from "./scenes/n_bytes?scene";
import buddySystem from "./scenes/buddy_system?scene";
import dataTable from "./scenes/data_table?scene";
import timeline from "./scenes/timeline?scene";

export default makeProject({
  scenes: [
    courseCover,
    floatScene,
    bTree,
    formulaScene,
    nBytes,
    buddySystem,
    dataTable,
    timeline,
  ],
});
