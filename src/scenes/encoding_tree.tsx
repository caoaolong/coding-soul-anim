import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {
  EncodingIntroCard,
  type EncodingIntroInfo,
} from '../components/encoding/encoding_intro_card';
import {SceneTitle} from '../components/title/scene_title';
import {TreeBoard} from '../components/tree/tree_board';

const BG = '#0a0e14';

const INTROS: Record<string, EncodingIntroInfo> = {
  ASCII: {
    short: 'ASCII',
    full: 'American Standard Code for Information Interchange',
    chinese: '美国信息交换标准代码',
    by: 'ASA / ANSI（美国）',
    trait: '7-bit，128 个码位；兼容为后世编码的公共子集',
    accent: '#3dd6c6',
  },
  GB2312: {
    short: 'GB2312',
    full: 'GB 2312-80',
    chinese: '信息交换用汉字编码字符集 · 基本集',
    by: '中国国家标准总局（1980）',
    trait: '收录约 6763 个简体汉字；双字节，兼容 ASCII',
    accent: '#f0a060',
  },
  GBK: {
    short: 'GBK',
    full: 'Chinese Internal Code Specification',
    chinese: '汉字内码扩展规范',
    by: '全国信标委 / 微软等',
    trait: '在 GB2312 之上扩展，覆盖更多汉字与符号',
    accent: '#f0a060',
  },
  Unicode: {
    short: 'Unicode',
    full: 'The Unicode Standard',
    chinese: '统一码 / 万国码',
    by: 'Unicode Consortium',
    trait: '统一码点空间；本身不规定字节存法（需 UTF-*）',
    accent: '#7aa2ff',
  },
};

/**
 * 左侧编码体系树；依次高亮 ASCII → GB2312 → GBK → Unicode，
 * 右侧淡入介绍卡片（简称 / 全称 / 中文 / 提出方 / 核心特点）。
 */
export default makeScene2D(function* (view) {
  view.fill(BG);

  const title = createRef<SceneTitle>();
  const tree = createRef<TreeBoard>();
  const card = createRef<EncodingIntroCard>();

  view.add(<SceneTitle ref={title} text={'字符编码体系'} />);

  view.add(
    <TreeBoard
      ref={tree}
      x={-420}
      y={-200}
      nodeStyle={'circle'}
      edgeStyle={'straight'}
      circleSize={128}
      hGap={40}
      vGap={36}
      fontSize={22}
      tree={{
        label: '字符编码',
        children: [
          {
            label: 'ASCII',
            color: '#3dd6c6',
            year: 1963,
          },
          {
            label: 'GB 系列',
            color: '#f0a060',
            children: [
              {
                label: 'GB2312',
                year: 1980,
                children: [{label: 'GBK', year: 1995}],
              },
            ],
          },
          {
            label: 'Unicode',
            color: '#7aa2ff',
            year: 1991,
            children: [
              {label: 'UTF-8', dashed: true},
              {label: 'UTF-16', dashed: true},
              {label: 'UTF-32', dashed: true},
            ],
          },
        ],
      }}
    />,
  );

  view.add(
    <EncodingIntroCard ref={card} width={640} x={400} y={40} />,
  );

  yield* title().show();
  yield* waitFor(0.15);
  yield* tree().reveal();
  yield* waitFor(0.45);

  const sequence = ['ASCII', 'GB2312', 'GBK', 'Unicode'] as const;
  for (const key of sequence) {
    yield* tree().highlight(key, 0.4);
    yield* card().showInfo(INTROS[key], 0.45);
    yield* waitFor(1.1);
    yield* tree().clearHighlight(0.3);
    yield* waitFor(0.15);
  }

  yield* card().hide(0.35);
  yield* waitFor(1.0);
});
