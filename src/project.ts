import { makeProject } from "@motion-canvas/core";

import binary from "./scenes/binary?scene";
import vector from "./scenes/vector?scene";

import "./global.css";

export default makeProject({
  scenes: [vector],
});
