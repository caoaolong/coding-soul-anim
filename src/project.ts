import { makeProject } from "@motion-canvas/core";

import cube3d from "./scenes/cube3d?scene";

import "./global.css";

export default makeProject({
  scenes: [cube3d],
});
