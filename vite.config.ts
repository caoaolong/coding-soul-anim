import { defineConfig, loadEnv } from "vite";
import motionCanvas from "@motion-canvas/vite-plugin";
import ffmpeg from "@motion-canvas/ffmpeg";

export default defineConfig(({ mode }) => {
  // 不同设备输出目录不同：读环境变量（shell 或项目根 .env 文件），未设置时回退默认。
  // 空前缀 '' 表示不过滤，所有变量都可见（含 shell 环境变量）。
  const env = loadEnv(mode, ".", "");
  const output = env.MOTION_CANVAS_OUTPUT;

  return {
    plugins: [
      motionCanvas({
        output,
      }),
      ffmpeg(),
    ],
  };
});
