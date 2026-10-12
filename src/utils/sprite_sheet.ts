import {ThreadGenerator, Vector2} from '@motion-canvas/core';

export interface SpriteSheetOptions {
  /** 精灵图地址（import 得到的 url 或网络地址） */
  src: string;
  /** 列数（横向格子数） */
  cols: number;
  /** 行数（纵向格子数） */
  rows: number;
}

export interface SpriteCellRect {
  /** 源图像素 x（左上） */
  x: number;
  /** 源图像素 y（左上） */
  y: number;
  width: number;
  height: number;
  /** 列索引（从 0 起） */
  col: number;
  /** 行索引（从 0 起） */
  row: number;
}

/**
 * 精灵图切割工具：按行列均分整图，再按坐标取出某一格。
 *
 * 坐标约定：`(col, row)`，左上为 `(0, 0)`，向右 / 向下递增。
 *
 * @example
 * ```ts
 * import sheetUrl from '../assets/sheet.png';
 * const sheet = new SpriteSheet({src: sheetUrl, cols: 4, rows: 2});
 * yield* sheet.waitLoad();
 * const src = sheet.getSrc(1, 0); // 第 0 行第 1 列
 * view.add(<Img src={src} width={64} />);
 * ```
 */
export class SpriteSheet {
  private readonly src: string;
  private readonly cols: number;
  private readonly rows: number;
  private readonly image: HTMLImageElement;
  private readonly cache = new Map<string, string>();
  private loaded = false;

  public constructor(options: SpriteSheetOptions) {
    const {src, cols, rows} = options;
    if (cols < 1 || rows < 1) {
      throw new Error(`SpriteSheet: cols/rows 必须 ≥ 1，收到 cols=${cols}, rows=${rows}`);
    }
    this.src = src;
    this.cols = cols;
    this.rows = rows;
    this.image = new Image();
    this.image.decoding = 'async';
    this.image.src = src;
  }

  /** 列数 */
  public get columnCount(): number {
    return this.cols;
  }

  /** 行数 */
  public get rowCount(): number {
    return this.rows;
  }

  /** 原始整图地址 */
  public get source(): string {
    return this.src;
  }

  /** 是否已加载完成 */
  public get isLoaded(): boolean {
    return this.loaded;
  }

  /** 单格像素宽（需已 load） */
  public get cellWidth(): number {
    this.assertLoaded();
    return this.image.naturalWidth / this.cols;
  }

  /** 单格像素高（需已 load） */
  public get cellHeight(): number {
    this.assertLoaded();
    return this.image.naturalHeight / this.rows;
  }

  /** 单格尺寸 */
  public cellSize(): Vector2 {
    return new Vector2(this.cellWidth, this.cellHeight);
  }

  /** 整图像素尺寸 */
  public naturalSize(): Vector2 {
    this.assertLoaded();
    return new Vector2(this.image.naturalWidth, this.image.naturalHeight);
  }

  /**
   * 等待图片解码完成（场景里用 `yield* sheet.waitLoad()`）。
   */
  public *waitLoad(): ThreadGenerator {
    yield this.load();
  }

  /** Promise 版加载，可在非 generator 上下文使用 */
  public async load(): Promise<this> {
    if (this.loaded) return this;

    if (!this.image.complete || this.image.naturalWidth === 0) {
      try {
        await this.image.decode();
      } catch {
        await new Promise<void>((resolve, reject) => {
          this.image.onload = () => resolve();
          this.image.onerror = () =>
            reject(new Error(`SpriteSheet: 无法加载图像 ${this.src}`));
        });
      }
    }

    if (this.image.naturalWidth === 0 || this.image.naturalHeight === 0) {
      throw new Error(`SpriteSheet: 图像尺寸无效 ${this.src}`);
    }

    this.loaded = true;
    return this;
  }

  /**
   * 取某一格在源图上的像素矩形。
   * @param col 列，从 0 起
   * @param row 行，从 0 起
   */
  public getRect(col: number, row: number): SpriteCellRect {
    this.assertLoaded();
    this.assertIndex(col, row);
    const w = this.cellWidth;
    const h = this.cellHeight;
    return {
      x: col * w,
      y: row * h,
      width: w,
      height: h,
      col,
      row,
    };
  }

  /**
   * 按线性帧号取格（从左到右、从上到下）。
   * `index = row * cols + col`
   */
  public getRectByIndex(index: number): SpriteCellRect {
    this.assertLoaded();
    const total = this.cols * this.rows;
    if (index < 0 || index >= total) {
      throw new Error(
        `SpriteSheet: 帧索引越界 index=${index}，合法范围 0..${total - 1}`,
      );
    }
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    return this.getRect(col, row);
  }

  /**
   * 切出某一格，返回 data URL，可直接作为 `<Img src={...} />`。
   * @param col 列，从 0 起
   * @param row 行，从 0 起
   */
  public getSrc(col: number, row: number): string {
    const key = `${col},${row}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const canvas = this.getCanvas(col, row);
    const url = canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  }

  /** 按线性帧号取切图 data URL */
  public getSrcByIndex(index: number): string {
    const rect = this.getRectByIndex(index);
    return this.getSrc(rect.col, rect.row);
  }

  /**
   * 切出某一格到独立 canvas（像素尺寸 = 单格尺寸）。
   */
  public getCanvas(col: number, row: number): HTMLCanvasElement {
    this.assertLoaded();
    const rect = this.getRect(col, row);
    const canvas = document.createElement('canvas');
    // 用整像素，避免亚像素采样发糊
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('SpriteSheet: 无法创建 2D canvas context');
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.image,
      Math.round(rect.x),
      Math.round(rect.y),
      w,
      h,
      0,
      0,
      w,
      h,
    );
    return canvas;
  }

  /** 清空切图缓存（一般无需调用） */
  public clearCache() {
    this.cache.clear();
  }

  private assertLoaded() {
    if (!this.loaded) {
      throw new Error(
        'SpriteSheet: 图像尚未加载，请先 `yield* sheet.waitLoad()` 或 `await sheet.load()`',
      );
    }
  }

  private assertIndex(col: number, row: number) {
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      col < 0 ||
      row < 0 ||
      col >= this.cols ||
      row >= this.rows
    ) {
      throw new Error(
        `SpriteSheet: 坐标越界 (col=${col}, row=${row})，合法范围 col=0..${this.cols - 1}, row=0..${this.rows - 1}`,
      );
    }
  }
}
