import { makeProject } from "@motion-canvas/core";

import buddySystem from "./scenes/buddy_system?scene";
import nBytes from "./scenes/n_bytes?scene";

export default makeProject({
  scenes: [buddySystem, nBytes],
});
