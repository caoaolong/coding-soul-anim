import {makeProject} from '@motion-canvas/core';

import cover from './scenes/cover?scene';
import byteInc from './scenes/byte_inc?scene';
import mindmap from './scenes/mindmap?scene';
import transistorSwitch from './scenes/transistor_switch?scene';
import logicGates from './scenes/logic_gates?scene';
import lplPlayoffs from './scenes/lpl_playoffs?scene';
import macWindowDemo from './scenes/mac_window_demo?scene';

import './global.css';

export default makeProject({
  scenes: [macWindowDemo],
});
