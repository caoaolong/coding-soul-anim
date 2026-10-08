import { makeProject } from "@motion-canvas/core";

import cover from "./scenes/cover?scene";
import outro from "./scenes/outro?scene";
import byteInc from "./scenes/loop/byte_inc?scene";
import mindmap from "./scenes/mindmap?scene";
import transistorSwitch from "./scenes/transistor_switch?scene";
import logicGates from "./scenes/logic_gates?scene";
import lplPlayoffs from "./scenes/lpl_playoffs?scene";
import macWindowDemo from "./scenes/mac_window_demo?scene";
import logicOps from "./scenes/logic_ops?scene";
import formulaBoardDemo from "./scenes/formula_board_demo?scene";
import nodeTree from "./scenes/node_tree?scene";
import binaryTree from "./scenes/binary_tree?scene";
import propositionTree from "./scenes/proposition_tree?scene";
import progressTimeline from "./scenes/progress_timeline?scene";
import flowchart from "./scenes/flowchart?scene";
import paper from "./scenes/paper?scene";
import floatPrecision from "./scenes/loop/float_precision?scene";
import ieeeFloat from "./scenes/float?scene";
import binConvertDemo from "./scenes/bin_convert_demo?scene";
import formulaDerive from "./scenes/formula_derive?scene";

import "./global.css";

export default makeProject({
  scenes: [formulaDerive],
});
