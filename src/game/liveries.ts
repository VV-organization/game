import * as THREE from 'three';
import { liveryDesigns, type LiveryDesign } from '../shared/livery-designs';

type Point = readonly [number, number];
type DrawPath = (context: CanvasRenderingContext2D) => void;

/** Artwork is authored at 100 units high; the side is a separate 400-unit-wide composition. */
class Painter {
  constructor(
    readonly c: CanvasRenderingContext2D,
    readonly colors: LiveryDesign,
  ) {}

  shape(color: string, draw: DrawPath, outline = true) {
    const c = this.c;
    c.beginPath();
    draw(c);
    c.closePath();
    c.fillStyle = color;
    c.fill();
    if (outline) {
      c.lineJoin = 'round';
      c.strokeStyle = this.colors.accent;
      c.lineWidth = 3.1;
      c.stroke();
      c.strokeStyle = this.colors.ink;
      c.lineWidth = 1.35;
      c.stroke();
    }
  }

  polygon(color: string, points: readonly Point[], outline = true) {
    this.shape(
      color,
      (c) => {
        points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      },
      outline,
    );
  }

  line(color: string, width: number, draw: DrawPath, outline = true) {
    const c = this.c;
    c.beginPath();
    draw(c);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (outline) {
      c.strokeStyle = this.colors.accent;
      c.lineWidth = width + 3;
      c.stroke();
      c.strokeStyle = this.colors.ink;
      c.lineWidth = width + 1.6;
      c.stroke();
    }
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }

  circle(color: string, x: number, y: number, r: number, outline = true) {
    this.shape(color, (c) => c.arc(x, y, r, 0, Math.PI * 2), outline);
  }

  ellipse(color: string, x: number, y: number, rx: number, ry: number, angle = 0) {
    this.shape(color, (c) => c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2));
  }

  star(color: string, x: number, y: number, r: number, points = 4) {
    this.polygon(
      color,
      Array.from({ length: points * 2 }, (_, i) => {
        const a = (i * Math.PI) / points - Math.PI / 2,
          radius = i % 2 ? r * 0.27 : r;
        return [x + Math.cos(a) * radius, y + Math.sin(a) * radius] as Point;
      }),
    );
  }

  swoosh(
    color: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    bend: number,
    width: number,
  ) {
    const span = x1 - x0;
    this.shape(color, (c) => {
      c.moveTo(x0, y0);
      c.bezierCurveTo(x0 + span * 0.33, y0 + bend, x1 - span * 0.27, y1 - bend, x1, y1);
      c.lineTo(x1, y1 + width * 0.3);
      c.bezierCurveTo(
        x1 - span * 0.3,
        y1 - bend + width,
        x0 + span * 0.3,
        y0 + bend + width,
        x0,
        y0 + width,
      );
    });
  }
}

function flower(p: Painter, x: number, y: number, radius: number, angle: number) {
  const { primary, secondary, accent } = p.colors;
  for (let petal = 0; petal < 5; petal++) {
    const a = angle + (petal * Math.PI * 2) / 5;
    p.ellipse(
      primary,
      x + Math.cos(a) * radius * 0.44,
      y + Math.sin(a) * radius * 0.44,
      radius * 0.56,
      radius * 0.35,
      a,
    );
  }
  p.circle(secondary, x, y, radius * 0.19);
  p.circle(accent, x, y, radius * 0.075, false);
}

function crescent(p: Painter, x: number, y: number, radius: number) {
  p.shape(p.colors.primary, (c) => {
    c.moveTo(x + radius * 0.4, y - radius * 0.91);
    c.bezierCurveTo(
      x - radius * 1.25,
      y - radius * 0.9,
      x - radius * 1.25,
      y + radius * 0.9,
      x + radius * 0.4,
      y + radius * 0.91,
    );
    c.bezierCurveTo(
      x - radius * 0.48,
      y + radius * 0.45,
      x - radius * 0.48,
      y - radius * 0.45,
      x + radius * 0.4,
      y - radius * 0.91,
    );
  });
}

function bolt(p: Painter, x: number, y: number, scale: number, color: string) {
  p.polygon(color, [
    [x + 7 * scale, y - 32 * scale],
    [x - 15 * scale, y + 4 * scale],
    [x - 1 * scale, y + 4 * scale],
    [x - 7 * scale, y + 33 * scale],
    [x + 18 * scale, y - 8 * scale],
    [x + 3 * scale, y - 8 * scale],
  ]);
}

function wave(p: Painter, x: number, y: number, scale: number, color: string) {
  const c = p.c;
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  p.shape(color, (ctx) => {
    ctx.moveTo(-37, 26);
    ctx.bezierCurveTo(-14, 24, -28, -24, 3, -30);
    ctx.bezierCurveTo(28, -35, 38, -8, 17, 1);
    ctx.bezierCurveTo(29, -16, 10, -25, 6, -11);
    ctx.bezierCurveTo(-2, 13, 14, 23, 39, 20);
    ctx.bezierCurveTo(14, 39, -16, 39, -37, 26);
  });
  p.line(
    p.colors.accent,
    3.2,
    (ctx) => {
      ctx.moveTo(-17, 11);
      ctx.bezierCurveTo(-13, -20, 6, -29, 19, -16);
    },
    false,
  );
  c.restore();
}

function skyline(p: Painter, x: number, baseline: number, width: number, heights: number[]) {
  const step = width / heights.length;
  const points: Point[] = [[x, baseline]];
  heights.forEach((height, i) => {
    points.push([x + i * step, baseline - height], [x + (i + 1) * step - 1.5, baseline - height]);
    if (i < heights.length - 1) points.push([x + (i + 1) * step - 1.5, baseline]);
  });
  points.push([x + width, baseline]);
  p.polygon(p.colors.primary, points);
  heights.forEach((height, i) => {
    if (height > 22)
      p.line(
        p.colors.accent,
        1.8,
        (c) => {
          c.moveTo(x + i * step + step * 0.45, baseline - height + 6);
          c.lineTo(x + i * step + step * 0.45, baseline - 8);
        },
        false,
      );
  });
}

function mountains(p: Painter, x: number, baseline: number, width: number, pro: boolean) {
  const peaks = pro ? [0.16, 0.34, 0.53, 0.7, 0.87] : [0.23, 0.51, 0.78];
  peaks.forEach((position, i) => {
    const peakX = x + position * width,
      peakY = baseline - (pro ? [29, 46, 61, 43, 31][i] : [36, 58, 40][i]),
      half = width * (pro ? 0.22 : 0.28);
    p.polygon(p.colors.primary, [
      [peakX - half, baseline],
      [peakX, peakY],
      [peakX + half, baseline],
    ]);
    p.polygon(
      p.colors.accent,
      [
        [peakX - half * 0.3, peakY + (baseline - peakY) * 0.3],
        [peakX, peakY],
        [peakX + half * 0.43, peakY + (baseline - peakY) * 0.43],
        [peakX + half * 0.09, peakY + (baseline - peakY) * 0.29],
        [peakX - half * 0.06, peakY + (baseline - peakY) * 0.43],
      ],
      false,
    );
    if (pro)
      p.polygon(
        p.colors.ink,
        [
          [peakX, peakY + 5],
          [peakX + half * 0.35, baseline - 4],
          [peakX + half * 0.08, baseline - 4],
        ],
        false,
      );
  });
}

function checker(
  p: Painter,
  x: number,
  y: number,
  width: number,
  rows: number,
  columns: number,
  angle: number,
) {
  const c = p.c,
    cell = width / columns;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const top = (u: number) => Math.sin((u / width) * Math.PI * 1.5) * cell * 0.35;
  p.shape(p.colors.ink, (ctx) => {
    ctx.moveTo(0, top(0));
    for (let col = 1; col <= columns; col++) ctx.lineTo(col * cell, top(col * cell));
    for (let col = columns; col >= 0; col--) ctx.lineTo(col * cell, top(col * cell) + rows * cell);
  });
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      if ((row + col) % 2) continue;
      const u = col * cell;
      p.polygon(
        p.colors.accent,
        [
          [u, top(u) + row * cell],
          [u + cell, top(u + cell) + row * cell],
          [u + cell, top(u + cell) + (row + 1) * cell],
          [u, top(u) + (row + 1) * cell],
        ],
        false,
      );
    }
  c.restore();
}

function drawArtwork(p: Painter, theme: number, pro: boolean, side: boolean) {
  const { primary: a, secondary: b, accent: light, ink } = p.colors,
    c = p.c,
    w = side ? 400 : 100,
    cx = side ? 242 : 50;

  if (theme === 0) {
    if (pro) {
      // The sun is split into broad bands rather than an opaque badge background.
      const sunX = side ? 249 : 55;
      for (let row = 0; row < 5; row++) {
        const y = 12 + row * 7,
          half = Math.sqrt(Math.max(0, 29 ** 2 - (y - 37) ** 2));
        p.polygon(
          b,
          [
            [sunX - half, y],
            [sunX + half, y],
            [sunX + half, y + 4],
            [sunX - half, y + 4],
          ],
          false,
        );
      }
      skyline(p, side ? 145 : 14, 68, side ? 190 : 73, [19, 33, 26, 46, 35, 22, 32]);
      p.swoosh(b, 8, 83, w - 9, 51, -13, 8);
      p.swoosh(a, 12, 47, w - 15, 82, 18, 5);
    } else {
      p.polygon(b, [
        [8, 79],
        [w * 0.74, 16],
        [w - 7, 30],
        [w * 0.28, 89],
      ]);
      skyline(p, side ? 120 : 14, 74, side ? 228 : 73, [23, 40, 32, 57, 27, 44]);
      p.line(
        light,
        2.6,
        (ctx) => {
          ctx.moveTo(16, 85);
          ctx.lineTo(w - 14, 48);
        },
        false,
      );
    }
  } else if (theme === 1) {
    if (pro) {
      p.swoosh(b, 8, 83, w - 9, 25, -34, 9);
      p.swoosh(a, 12, 69, w - 18, 35, 14, 7);
      p.circle(a, cx, 43, 26);
      p.circle(ink, cx + 6, 40, 21, false);
      p.line(b, 3.2, (ctx) => ctx.ellipse(cx, 46, side ? 55 : 39, 16, -0.4, 0.15, Math.PI * 1.85));
      p.star(light, cx - 22, 24, 12);
      p.star(b, side ? 344 : 82, 71, 8);
    } else {
      p.swoosh(b, 8, 78, w - 10, 55, 17, 7);
      crescent(p, cx - 5, 43, 28);
      p.star(b, cx + 26, 28, 11);
      p.star(light, cx + 24, 57, 7);
      p.star(a, side ? 110 : 20, 24, 6);
    }
  } else if (theme === 2) {
    if (pro) {
      p.circle(b, cx + 3, 33, 24);
      mountains(p, side ? 95 : 10, 80, side ? 250 : 80, true);
      p.swoosh(b, 9, 84, w - 9, 64, 12, 5);
    } else {
      p.polygon(b, [
        [8, 83],
        [w - 8, 72],
        [w - 11, 84],
        [14, 90],
      ]);
      mountains(p, side ? 105 : 13, 78, side ? 225 : 76, false);
    }
  } else if (theme === 3) {
    if (pro) {
      p.swoosh(b, 9, 76, w - 10, 25, -44, 6);
      p.swoosh(b, 16, 20, w - 13, 80, 32, 4);
      flower(p, cx, 49, 29, -Math.PI / 2);
      [
        [side ? 118 : 15, 58, -0.7],
        [side ? 333 : 82, 23, 0.7],
        [side ? 353 : 81, 77, -0.4],
        [side ? 80 : 23, 22, 0.3],
      ].forEach(([x, y, angle]) => p.ellipse(a, x, y, 8, 4.5, angle));
    } else {
      p.line(ink, 5, (ctx) => {
        ctx.moveTo(12, 88);
        ctx.bezierCurveTo(w * 0.25, 63, w * 0.7, 72, w - 12, 15);
      });
      p.ellipse(b, side ? 150 : 24, 66, 12, 5, -0.6);
      p.ellipse(b, side ? 313 : 75, 37, 12, 5, -0.9);
      flower(p, side ? 216 : 43, 58, 22, -0.3);
      flower(p, side ? 285 : 68, 29, 17, -0.8);
      p.ellipse(a, side ? 90 : 17, 28, 7, 3.5, -0.4);
      p.ellipse(a, side ? 355 : 86, 74, 7, 3.5, 0.6);
    }
  } else if (theme === 4) {
    p.circle(a, cx, pro ? 32 : 36, pro ? 23 : 26);
    if (pro) {
      p.polygon(b, [
        [w * 0.12, 76],
        [w * 0.15, 43],
        [w * 0.21, 43],
        [w * 0.21, 25],
        [w * 0.35, 25],
        [w * 0.35, 42],
        [w * 0.42, 42],
        [w * 0.46, 78],
      ]);
      p.polygon(b, [
        [w * 0.52, 80],
        [w * 0.59, 38],
        [w * 0.66, 38],
        [w * 0.66, 29],
        [w * 0.78, 29],
        [w * 0.78, 51],
        [w * 0.85, 51],
        [w * 0.91, 79],
      ]);
      p.swoosh(a, 9, 86, w - 8, 70, -8, 7);
      p.line(light, 3, (ctx) => {
        ctx.moveTo(w * 0.4, 90);
        ctx.bezierCurveTo(w * 0.85, 78, w * 0.34, 66, w * 0.56, 51);
      });
    } else {
      p.swoosh(b, 9, 62, w - 9, 49, -20, 21);
      p.swoosh(a, 8, 78, w - 8, 64, -18, 13);
      p.swoosh(b, 17, 86, w - 16, 81, -7, 6);
    }
  } else if (theme === 5) {
    p.swoosh(b, 8, pro ? 79 : 84, w - 8, 63, 11, 9);
    if (pro) {
      p.swoosh(b, 12, 61, w - 11, 82, -8, 5);
      p.shape(a, (ctx) => {
        ctx.moveTo(cx, 22);
        ctx.bezierCurveTo(cx - 9, 37, cx - 23, 29, cx - 42, 20);
        ctx.bezierCurveTo(cx - 36, 42, cx - 27, 61, cx - 8, 58);
        ctx.quadraticCurveTo(cx - 4, 77, cx - 14, 86);
        ctx.quadraticCurveTo(cx + 7, 74, cx + 5, 58);
        ctx.bezierCurveTo(cx + 27, 60, cx + 39, 38, cx + 42, 20);
        ctx.bezierCurveTo(cx + 25, 31, cx + 11, 35, cx, 22);
      });
      p.line(
        light,
        2.3,
        (ctx) => {
          ctx.moveTo(cx - 27, 36);
          ctx.quadraticCurveTo(cx, 57, cx + 27, 36);
        },
        false,
      );
    } else {
      wave(p, cx, 46, side ? 1 : 0.95, a);
      p.circle(light, cx + 31, 36, 3.5);
      p.circle(a, cx + 39, 24, 2.5);
    }
  } else if (theme === 6) {
    if (pro) {
      p.polygon(a, [
        [8, 17],
        [cx + 12, 34],
        [cx + 20, 57],
        [w * 0.35, 49],
      ]);
      p.polygon(a, [
        [12, 49],
        [cx + 17, 46],
        [cx + 20, 66],
        [w * 0.24, 69],
      ]);
      p.polygon(a, [
        [28, 85],
        [cx + 9, 56],
        [cx + 14, 71],
        [w * 0.44, 88],
      ]);
      p.circle(b, cx + 13, 51, 22);
      p.circle(light, cx + 18, 46, 7, false);
      p.line(b, 3, (ctx) => ctx.ellipse(cx, 52, side ? 65 : 42, 29, -0.5, -0.7, Math.PI * 0.85));
      p.star(light, side ? 350 : 81, 18, 6);
    } else {
      p.swoosh(b, 9, 84, w - 10, 23, -8, 6);
      p.circle(a, cx, 48, 26);
      p.line(b, 8, (ctx) => ctx.ellipse(cx, 49, side ? 54 : 40, 12, -0.35, 0.1, Math.PI * 1.86));
      p.line(
        light,
        2,
        (ctx) => {
          ctx.moveTo(cx - 12, 31);
          ctx.quadraticCurveTo(cx, 24, cx + 10, 31);
        },
        false,
      );
      p.star(light, side ? 120 : 17, 24, 7);
      p.star(b, side ? 344 : 83, 77, 6);
    }
  } else if (theme === 7) {
    if (pro) {
      for (let i = 0; i < 5; i++)
        p.polygon(i % 2 ? b : a, [
          [8 + i * w * 0.085, 85],
          [15 + i * w * 0.085, 42 - i * 4],
          [22 + i * w * 0.085, 42 - i * 4],
          [15 + i * w * 0.085, 85],
        ]);
      const left = side ? 185 : 25,
        right = side ? 320 : 87;
      p.polygon(a, [
        [left, 29],
        [right - 5, 29],
        [right, 35],
        [right, 75],
        [left, 75],
      ]);
      p.polygon(b, [
        [left + 7, 40],
        [right - 7, 40],
        [right - 7, 59],
        [left + 7, 59],
      ]);
      p.circle(ink, left + (right - left) * 0.26, 50, 9);
      p.circle(ink, left + (right - left) * 0.74, 50, 9);
      p.circle(light, left + (right - left) * 0.26, 50, 3, false);
      p.circle(light, left + (right - left) * 0.74, 50, 3, false);
      p.polygon(b, [
        [left + 14, 75],
        [left + 21, 65],
        [right - 21, 65],
        [right - 14, 75],
      ]);
    } else {
      const sunX = side ? 250 : 52;
      for (let row = 0; row < 7; row++) {
        const y = 13 + row * 8,
          dy = y + 3 - 41,
          half = Math.sqrt(Math.max(0, 29 ** 2 - dy ** 2));
        p.polygon(row < 3 ? a : b, [
          [sunX - half, y],
          [sunX + half, y],
          [sunX + half, y + 5],
          [sunX - half, y + 5],
        ]);
      }
      p.swoosh(a, 8, 83, w - 8, 69, -2, 5);
      p.swoosh(b, 12, 93, w - 12, 79, -2, 4);
      if (side)
        p.polygon(a, [
          [18, 62],
          [128, 24],
          [167, 24],
          [43, 62],
        ]);
    }
  } else if (theme === 8) {
    if (pro) {
      const columns = side ? 6 : 3,
        start = side ? 69 : 23,
        step = side ? 48 : 26;
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < columns; col++) {
          const x = start + col * step + (row % 2 ? step * 0.23 : 0),
            y = 32 + row * 34;
          p.polygon(a, [
            [x - 13, y - 15],
            [x + 9, y - 15],
            [x + 18, y],
            [x + 9, y + 15],
            [x - 13, y + 15],
            [x - 21, y],
          ]);
        }
      p.polygon(b, [
        [8, 81],
        [w * 0.48, 47],
        [w * 0.43, 63],
        [w - 8, 20],
        [w * 0.69, 65],
        [w * 0.7, 48],
        [23, 89],
      ]);
    } else {
      const count = side ? 7 : 3;
      for (let i = 0; i < count; i++) {
        const x = side ? 20 + i * 50 : 9 + i * 28;
        p.polygon(a, [
          [x, 35],
          [x + 18, 19],
          [x + 31, 36],
          [x + 10, 63],
        ]);
        p.polygon(ink, [
          [x + 4, 64],
          [x + 26, 42],
          [x + 37, 60],
          [x + 17, 83],
        ]);
        p.polygon(
          b,
          [
            [x + 7, 64],
            [x + 21, 51],
            [x + 25, 56],
            [x + 11, 70],
          ],
          false,
        );
      }
    }
  } else if (theme === 9) {
    if (pro) {
      p.shape(a, (ctx) => {
        ctx.moveTo(w * 0.15, 85);
        ctx.bezierCurveTo(w * 0.58, 98, w * 0.95, 54, w * 0.72, 19);
        ctx.bezierCurveTo(w * 0.76, 48, w * 0.59, 24, w * 0.68, 9);
        ctx.bezierCurveTo(w * 0.28, 26, w * 0.31, 43, w * 0.42, 57);
        ctx.bezierCurveTo(w * 0.2, 62, w * 0.28, 32, w * 0.16, 24);
        ctx.bezierCurveTo(w * 0.2, 50, w * 0.03, 61, w * 0.15, 85);
      });
      p.shape(b, (ctx) => {
        ctx.moveTo(w * 0.27, 78);
        ctx.bezierCurveTo(w * 0.72, 91, w * 0.77, 57, w * 0.59, 42);
        ctx.bezierCurveTo(w * 0.63, 70, w * 0.37, 43, w * 0.45, 30);
        ctx.bezierCurveTo(w * 0.23, 44, w * 0.48, 63, w * 0.27, 78);
      });
      p.ellipse(a, w * 0.87, 35, side ? 14 : 5, 9, -0.5);
      p.ellipse(b, w * 0.1, 13, side ? 9 : 3, 6, 0.6);
    } else {
      c.save();
      if (!side) {
        c.translate(0, 100);
        c.rotate(-Math.PI / 2);
      }
      for (let i = 0; i < 3; i++) {
        const y = 26 + i * 23,
          end = w * [0.78, 0.94, 0.84][i];
        p.shape(a, (ctx) => {
          ctx.moveTo(9, y + 10);
          ctx.bezierCurveTo(w * 0.28, y - 22, end * 0.75, y + 12, end, y - 16);
          ctx.bezierCurveTo(end * 0.9, y + 19, w * 0.3, y + 6, 9, y + 22);
        });
        p.swoosh(b, 11, y + 13, end * 0.8, y + 1, -7, 4);
      }
      c.restore();
    }
  } else if (theme === 10) {
    if (pro) {
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(cx, 48);
        c.rotate((i * Math.PI * 2) / 3);
        p.shape(a, (ctx) => {
          ctx.moveTo(-5, -8);
          ctx.bezierCurveTo(-43, -25, -42, 31, -9, 35);
          ctx.bezierCurveTo(-24, 16, -7, 28, 8, 8);
        });
        c.restore();
      }
      p.circle(b, cx, 48, 9);
      bolt(p, side ? 123 : 17, 57, 0.55, b);
      bolt(p, side ? 337 : 84, 44, 0.48, light);
      if (side) p.swoosh(b, 10, 84, 383, 70, -25, 5);
    } else {
      p.swoosh(b, 8, 74, w - 10, 50, -30, 7);
      p.shape(a, (ctx) => {
        ctx.moveTo(cx - 32, 55);
        ctx.bezierCurveTo(cx - 43, 38, cx - 22, 29, cx - 13, 35);
        ctx.bezierCurveTo(cx - 10, 9, cx + 22, 12, cx + 24, 35);
        ctx.bezierCurveTo(cx + 44, 32, cx + 44, 56, cx + 27, 57);
      });
      bolt(p, cx + 1, 65, 0.67, light);
      p.swoosh(b, 14, 86, w - 12, 72, -5, 3);
    }
  } else if (theme === 11) {
    c.save();
    if (!side) {
      c.translate(0, 100);
      c.rotate(-Math.PI / 2);
    }
    if (pro) {
      p.polygon(b, [
        [8, 78],
        [w * 0.81, 13],
        [w - 9, 50],
        [w * 0.81, 87],
        [w * 0.47, 75],
        [w * 0.7, 50],
      ]);
      for (let i = 0; i < 3; i++) {
        const x = w * (0.17 + i * 0.23),
          step = w * 0.22;
        p.polygon(a, [
          [x, 22],
          [x + step, 50],
          [x, 78],
          [x + step * 0.46, 50],
        ]);
      }
      p.line(light, 3, (ctx) => {
        ctx.moveTo(8, 14);
        ctx.lineTo(w * 0.38, 14);
      });
    } else {
      for (let i = 0; i < 3; i++)
        p.polygon(b, [
          [9, 24 + i * 23],
          [w * (0.57 + i * 0.06), 17 + i * 23],
          [w * (0.5 + i * 0.06), 26 + i * 23],
          [9, 32 + i * 23],
        ]);
      p.polygon(a, [
        [w * 0.42, 16],
        [w - 8, 50],
        [w * 0.42, 84],
        [w * 0.62, 50],
      ]);
    }
    c.restore();
  } else if (theme === 12) {
    c.save();
    if (!side) {
      c.translate(0, 100);
      c.rotate(-Math.PI / 2);
    }
    if (pro) {
      p.polygon(a, [
        [8, 70],
        [w * 0.31, 20],
        [w * 0.45, 47],
        [w * 0.67, 12],
        [w - 8, 48],
        [w * 0.76, 83],
        [w * 0.8, 50],
        [w * 0.67, 37],
        [w * 0.46, 77],
        [w * 0.3, 49],
        [w * 0.14, 85],
      ]);
      p.polygon(b, [
        [w * 0.07, 40],
        [w * 0.22, 14],
        [w * 0.29, 26],
        [w * 0.16, 49],
      ]);
      p.polygon(b, [
        [w * 0.5, 83],
        [w * 0.63, 62],
        [w * 0.7, 74],
        [w * 0.61, 90],
      ]);
    } else {
      p.polygon(a, [
        [8, 31],
        [w * 0.3, 15],
        [w * 0.48, 39],
        [w * 0.7, 18],
        [w - 7, 38],
        [w - 14, 55],
        [w * 0.69, 39],
        [w * 0.48, 62],
        [w * 0.28, 37],
        [12, 49],
      ]);
      p.polygon(b, [
        [9, 64],
        [w * 0.3, 49],
        [w * 0.49, 73],
        [w * 0.73, 52],
        [w - 8, 70],
        [w - 16, 87],
        [w * 0.72, 73],
        [w * 0.48, 92],
        [w * 0.29, 71],
        [13, 81],
      ]);
    }
    c.restore();
  } else if (theme === 13) {
    if (pro) {
      for (let i = 0; i < 3; i++) {
        const x = side ? 93 + i * 116 : 24 + i * 27,
          y = 65 - i * 12;
        wave(p, x, y, side ? 0.8 : 0.51, i % 2 ? a : b);
      }
      p.swoosh(a, 8, 86, w - 9, 73, -2, 5);
    } else {
      p.swoosh(a, 8, 25, w - 8, 75, 65, 13);
      p.swoosh(b, 9, 73, w - 9, 24, -57, 13);
      p.line(
        light,
        2,
        (ctx) => {
          ctx.moveTo(w * 0.2, 36);
          ctx.bezierCurveTo(w * 0.48, 87, w * 0.75, 79, w * 0.88, 75);
        },
        false,
      );
    }
  } else if (theme === 14) {
    c.save();
    if (!side) {
      c.translate(0, 100);
      c.rotate(-Math.PI / 2);
    }
    if (pro) {
      p.polygon(a, [
        [8, 29],
        [w * 0.6, 29],
        [w * 0.82, 11],
        [w - 7, 11],
        [w * 0.68, 44],
        [8, 44],
      ]);
      p.polygon(a, [
        [8, 56],
        [w * 0.68, 56],
        [w - 7, 89],
        [w * 0.82, 89],
        [w * 0.6, 71],
        [8, 71],
      ]);
      p.polygon(b, [
        [w * 0.29, 18],
        [w * 0.39, 18],
        [w * 0.53, 82],
        [w * 0.43, 82],
      ]);
      p.polygon(b, [
        [w * 0.76, 43],
        [w - 9, 43],
        [w - 9, 57],
        [w * 0.76, 57],
      ]);
    } else {
      for (const y of [27, 59]) {
        p.polygon(b, [
          [8, y + 6],
          [w - 9, y - 4],
          [w - 9, y + 15],
          [8, y + 25],
        ]);
        p.polygon(a, [
          [8, y],
          [w - 9, y - 10],
          [w - 9, y + 6],
          [8, y + 16],
        ]);
      }
    }
    c.restore();
  } else if (theme === 15) {
    if (pro) {
      for (let ring = 0; ring < 4; ring++) {
        const rx = (side ? 110 : 38) - ring * (side ? 20 : 8),
          ry = 39 - ring * 8;
        p.line(ring % 2 ? b : a, 2.6, (ctx) => {
          for (let i = 0; i <= 40; i++) {
            const angle = (i / 40) * Math.PI * 2,
              swell = 1 + 0.14 * Math.sin(angle * 3 + ring * 0.3);
            const x = cx + Math.cos(angle) * rx * swell,
              y = 50 + Math.sin(angle) * ry * swell;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
        });
      }
      p.circle(b, cx + 4, 49, 5);
    } else {
      for (let ring = 0; ring < 3; ring++) {
        const margin = 12 + ring * (side ? 25 : 10);
        p.line(ring % 2 ? b : a, 3.2, (ctx) => {
          ctx.moveTo(margin, 53);
          ctx.bezierCurveTo(w * 0.31, 6 + ring * 12, w * 0.77, 8 + ring * 12, w - margin, 43);
          ctx.bezierCurveTo(w * 0.82, 83 - ring * 9, w * 0.31, 95 - ring * 8, margin, 53);
        });
      }
      p.polygon(b, [
        [w * 0.44, 52],
        [w * 0.55, 39],
        [w * 0.62, 52],
        [w * 0.52, 65],
      ]);
      p.circle(a, w * 0.52, 52, 3, false);
    }
  } else if (theme === 16) {
    if (pro) {
      const blocks: [number, number, number, number][] = [
        [0.1, 20, 0.2, 29],
        [0.31, 44, 0.23, 35],
        [0.53, 17, 0.21, 32],
        [0.73, 48, 0.18, 34],
      ];
      blocks.forEach(([x, y, width, height], i) => {
        p.polygon(i % 2 ? a : b, [
          [w * x, y + height],
          [w * x, y + 10],
          [w * (x + width * 0.33), y + 10],
          [w * (x + width * 0.33), y],
          [w * (x + width), y],
          [w * (x + width), y + height * 0.55],
          [w * (x + width * 0.7), y + height * 0.55],
          [w * (x + width * 0.7), y + height],
        ]);
      });
      p.polygon(a, [
        [8, 83],
        [w * 0.39, 22],
        [w * 0.35, 57],
        [w * 0.22, 84],
      ]);
      p.polygon(ink, [
        [w * 0.55, 64],
        [w * 0.8, 27],
        [w * 0.77, 62],
        [w * 0.65, 85],
      ]);
    } else {
      p.polygon(a, [
        [w * 0.09, 34],
        [w * 0.28, 14],
        [w * 0.46, 24],
        [w * 0.39, 49],
        [w * 0.18, 56],
      ]);
      p.polygon(b, [
        [w * 0.47, 18],
        [w * 0.77, 12],
        [w * 0.9, 31],
        [w * 0.77, 49],
        [w * 0.53, 44],
      ]);
      p.polygon(b, [
        [w * 0.09, 66],
        [w * 0.28, 51],
        [w * 0.45, 65],
        [w * 0.38, 87],
        [w * 0.15, 84],
      ]);
      p.polygon(a, [
        [w * 0.49, 57],
        [w * 0.65, 48],
        [w * 0.89, 61],
        [w * 0.83, 85],
        [w * 0.59, 87],
      ]);
      p.polygon(ink, [
        [w * 0.31, 35],
        [w * 0.47, 43],
        [w * 0.54, 62],
        [w * 0.43, 72],
        [w * 0.31, 57],
      ]);
    }
  } else if (theme === 17) {
    if (pro) {
      const flagWidth = side ? 138 : 47;
      checker(p, side ? 54 : 8, 23, flagWidth, 3, 5, 0.35);
      checker(p, side ? 215 : 44, 40, flagWidth, 3, 5, -0.35);
      p.polygon(a, [
        [cx, 30],
        [cx + 15, 50],
        [cx, 75],
        [cx - 15, 50],
      ]);
      p.polygon(
        b,
        [
          [cx, 40],
          [cx + 7, 50],
          [cx, 61],
          [cx - 7, 50],
        ],
        false,
      );
    } else {
      p.swoosh(b, 8, 79, w - 8, 44, -14, 11);
      checker(
        p,
        side ? 52 : 12,
        side ? 29 : 37,
        side ? 289 : 77,
        side ? 2 : 3,
        side ? 11 : 6,
        -0.12,
      );
      p.polygon(a, [
        [w * 0.13, 80],
        [w * 0.48, 69],
        [w * 0.52, 76],
        [w * 0.17, 88],
      ]);
    }
  } else if (theme === 18) {
    if (pro) {
      p.line(b, 7, (ctx) => ctx.ellipse(cx, 49, side ? 68 : 34, 30, -0.4, 0, Math.PI * 1.8));
      bolt(p, cx - 2, 48, 1.13, a);
      p.polygon(a, [
        [cx - 2, 43],
        [side ? 121 : 14, 31],
        [side ? 156 : 24, 51],
        [side ? 77 : 8, 72],
        [side ? 183 : 37, 59],
      ]);
      p.polygon(a, [
        [cx + 4, 52],
        [side ? 342 : 84, 69],
        [side ? 323 : 76, 48],
        [side ? 384 : 92, 27],
        [side ? 294 : 65, 42],
      ]);
      p.star(b, side ? 78 : 13, 17, 5);
    } else {
      p.swoosh(b, 9, 86, w - 9, 20, -15, 9);
      bolt(p, cx + 2, 50, 1.13, a);
      bolt(p, side ? 130 : 18, 34, 0.4, b);
      bolt(p, side ? 335 : 82, 74, 0.4, a);
    }
  } else {
    if (pro) {
      const unit = side ? 10 : 7,
        center = side ? 247 : 53;
      const points: Point[] = [
        [-1, -5],
        [1, -5],
        [1, -3],
        [2, -3],
        [2, -2],
        [4, -2],
        [4, 0],
        [2, 0],
        [2, 2],
        [3, 2],
        [3, 4],
        [1, 4],
        [1, 3],
        [-1, 3],
        [-1, 4],
        [-3, 4],
        [-3, 2],
        [-2, 2],
        [-2, 0],
        [-4, 0],
        [-4, -2],
        [-2, -2],
        [-2, -3],
        [-1, -3],
      ];
      p.polygon(b, [
        [9, 51],
        [w * 0.24, 51],
        [w * 0.24, 34],
        [w * 0.42, 34],
        [w * 0.42, 52],
        [w * 0.29, 52],
        [w * 0.29, 70],
        [9, 70],
      ]);
      p.polygon(
        a,
        points.map(([x, y]) => [center + x * unit, 50 + y * (side ? 7 : 7)]),
      );
      p.polygon(
        light,
        [
          [center - unit, 43],
          [center + unit, 43],
          [center + unit, 57],
          [center - unit, 57],
        ],
        false,
      );
      for (const [x, y, size] of [
        [w * 0.1, 22, 6],
        [w * 0.85, 18, 7],
        [w * 0.89, 77, 5],
      ])
        p.polygon(b, [
          [x, y],
          [x + size, y],
          [x + size, y + size],
          [x, y + size],
        ]);
    } else {
      const head = side ? 290 : 67,
        unit = side ? 14 : 8;
      p.polygon(a, [
        [head - 3 * unit, 23],
        [head + unit, 23],
        [head + unit, 35],
        [head + 2 * unit, 35],
        [head + 2 * unit, 65],
        [head, 65],
        [head, 78],
        [head - 3 * unit, 78],
        [head - 3 * unit, 65],
        [head - 5 * unit, 65],
        [head - 5 * unit, 37],
        [head - 3 * unit, 37],
      ]);
      p.polygon(b, [
        [head - unit, 37],
        [head + unit, 37],
        [head + unit, 61],
        [head - 2 * unit, 61],
        [head - 2 * unit, 49],
        [head - unit, 49],
      ]);
      for (const [x, y, size] of [
        [side ? 70 : 10, 22, 10],
        [side ? 112 : 24, 49, 9],
        [side ? 53 : 13, 76, 8],
        [side ? 173 : 36, 13, 7],
      ])
        p.polygon(a, [
          [x, y],
          [x + size, y],
          [x + size, y + size],
          [x, y + size],
        ]);
      if (side)
        p.polygon(b, [
          [22, 45],
          [155, 45],
          [155, 57],
          [22, 57],
        ]);
    }
  }
}

/** Each car owns its textures; construct once, then dispose with the car materials. */
export function createLiveryTextures(variant: number): {
  hood: THREE.CanvasTexture;
  side: THREE.CanvasTexture;
} {
  const edition = Number.isInteger(variant) && variant >= 1 && variant <= 40 ? variant : 1,
    design = liveryDesigns[edition - 1];
  const makeTexture = (side: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = side ? 1024 : 512;
    canvas.height = side ? 256 : 512;
    const context = canvas.getContext('2d');
    if (context) {
      context.scale(canvas.height / 100, canvas.height / 100);
      drawArtwork(new Painter(context, design), (edition - 1) % 20, edition > 20, side);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = `livery-${edition}-${side ? 'side' : 'hood'}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  return { hood: makeTexture(false), side: makeTexture(true) };
}
