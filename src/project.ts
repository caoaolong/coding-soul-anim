import { makeProject } from "@motion-canvas/core";

import "./global.css";

import courseCover from "./scenes/course_cover?scene";
import formulaScene from "./scenes/formula?scene";
import floatScene from "./scenes/float?scene";
import bTree from "./scenes/b_tree?scene";

export default makeProject({
  scenes: [courseCover, formulaScene, floatScene, bTree],
});
