import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {CsvChart} from '../components/chart/csv_chart';
import {SceneTitle} from '../components/title/scene_title';
import lz77Csv from '../assets/data/LZ77.csv?raw';

const BG = '#0a0e14';
const RATIO_COLOR = '#3dd6c6';
const TIME_COLOR = '#7aa2ff';

/**
 * LZ77：同一文件在不同窗口大小下的压缩比与耗时（CSV → 双 Y 轴统计图）。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const chart = createRef<CsvChart>();

  view.add(<SceneTitle ref={title} text={'LZ77 压缩效果'} />);
  view.add(
    <CsvChart
      ref={chart}
      csv={lz77Csv}
      xColumn={'window_size'}
      xScale={'log2'}
      plotWidth={1120}
      plotHeight={520}
      xLabel={'w'}
      yLeftLabel={'ratio'}
      yRightLabel={'ms'}
      xTicks={8}
      yTicks={5}
      y={20}
    />,
  );

  chart().addSeries({
    id: 'ratio',
    yColumn: 'ratio',
    axis: 'left',
    type: 'area',
    color: RATIO_COLOR,
    showDots: true,
    label: '压缩比',
  });
  chart().addSeries({
    id: 'time',
    yColumn: 'time_ms',
    axis: 'right',
    type: 'bar',
    color: TIME_COLOR,
    barWidth: 0.45,
    label: '耗时 (ms)',
  });

  yield* title().show();
  yield* waitFor(0.25);
  yield* chart().showAxes(0.6);
  yield* waitFor(0.2);
  yield* chart().drawSeries('time', 1.1);
  yield* waitFor(0.25);
  yield* chart().drawSeries('ratio', 1.3);
  yield* waitFor(1.5);
});
