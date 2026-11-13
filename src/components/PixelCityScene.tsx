import { useEffect, useRef } from "react";

const WIDTH = 384;
const HEIGHT = 216;

type Block = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

function block(context: CanvasRenderingContext2D, item: Block) {
  context.fillStyle = item.color;
  context.fillRect(
    Math.round(item.x),
    Math.round(item.y),
    Math.max(1, Math.round(item.width)),
    Math.max(1, Math.round(item.height)),
  );
}

function cloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
) {
  const color = "#f4f4ce";
  const shade = "#c6ead0";
  block(context, {
    x,
    y: y + 5 * scale,
    width: 44 * scale,
    height: 9 * scale,
    color: shade,
  });
  block(context, {
    x: x + 7 * scale,
    y,
    width: 27 * scale,
    height: 8 * scale,
    color,
  });
  block(context, {
    x: x + 2 * scale,
    y: y + 4 * scale,
    width: 39 * scale,
    height: 7 * scale,
    color,
  });
  block(context, {
    x: x + 13 * scale,
    y: y + 10 * scale,
    width: 25 * scale,
    height: 3 * scale,
    color: shade,
  });
}

function building(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  windowColor: string,
  seed: number,
) {
  block(context, { x: x + 3, y: y + 3, width, height, color: "#314a55" });
  block(context, { x, y, width, height, color });
  block(context, {
    x: x + 2,
    y: y + 2,
    width: width - 4,
    height: 3,
    color: "#f4d493",
  });
  for (let row = y + 9; row < y + height - 7; row += 11) {
    for (let column = x + 5; column < x + width - 5; column += 9) {
      const lit = (row + column + seed) % 4 !== 0;
      block(context, {
        x: column,
        y: row,
        width: 4,
        height: 6,
        color: lit ? windowColor : "#365b67",
      });
    }
  }
  block(context, {
    x: x + 4,
    y: y + height - 8,
    width: width - 8,
    height: 8,
    color: "#253e4a",
  });
}

function tree(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
) {
  block(context, {
    x: x + 8 * scale,
    y: y + 18 * scale,
    width: 7 * scale,
    height: 25 * scale,
    color: "#7c503e",
  });
  block(context, {
    x,
    y: y + 12 * scale,
    width: 23 * scale,
    height: 13 * scale,
    color: "#238657",
  });
  block(context, {
    x: x + 5 * scale,
    y: y + 5 * scale,
    width: 16 * scale,
    height: 12 * scale,
    color: "#39a95d",
  });
  block(context, {
    x: x + 9 * scale,
    y,
    width: 8 * scale,
    height: 10 * scale,
    color: "#72c76a",
  });
  block(context, {
    x: x + 3 * scale,
    y: y + 23 * scale,
    width: 17 * scale,
    height: 3 * scale,
    color: "#175d4d",
  });
}

const glyphs: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  C: ["011", "100", "100", "100", "011"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["110", "101", "110", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  T: ["111", "010", "010", "010", "010"],
};

function pixelText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
) {
  [...text].forEach((character, characterIndex) => {
    const glyph = glyphs[character];
    if (!glyph) return;
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === "1") {
          block(context, {
            x: x + (characterIndex * 4 + columnIndex) * scale,
            y: y + rowIndex * scale,
            width: scale,
            height: scale,
            color,
          });
        }
      });
    });
  });
}

function drawCity(context: CanvasRenderingContext2D) {
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#62cbd4";
  context.fillRect(0, 0, WIDTH, HEIGHT);

  for (let y = 0; y < 62; y += 6) {
    block(context, {
      x: 0,
      y,
      width: WIDTH,
      height: 1,
      color: y < 28 ? "#71d2d7" : "#83d9d3",
    });
  }
  block(context, { x: 286, y: 20, width: 28, height: 28, color: "#ffe08a" });
  block(context, { x: 280, y: 26, width: 40, height: 16, color: "#ffe08a" });
  cloud(context, 28, 23, 1);
  cloud(context, 177, 14, 1.1);
  cloud(context, 320, 53, 0.8);
  cloud(context, 110, 53, 0.7);

  block(context, { x: 0, y: 87, width: WIDTH, height: 16, color: "#a4d5ae" });
  block(context, { x: 0, y: 99, width: WIDTH, height: 5, color: "#7bb58b" });

  const farBuildings: [number, number, number, string, string][] = [
    [104, 60, 29, "#e8c986", "#62b6c4"],
    [137, 45, 24, "#6e9fa8", "#d8dfb0"],
    [165, 54, 35, "#e5b97c", "#68b9c5"],
    [205, 37, 26, "#7398a5", "#f2d896"],
    [235, 49, 31, "#e4be83", "#5faab7"],
    [270, 31, 24, "#5e8b99", "#edd394"],
  ];
  farBuildings.forEach(([x, y, width, color, windows], index) => {
    building(context, x, y, width, 105 - y, color, windows, index * 7);
  });

  building(context, 0, 77, 101, 80, "#739b88", "#82cbd0", 8);
  block(context, { x: 0, y: 72, width: 108, height: 8, color: "#f4dfaa" });
  block(context, { x: 0, y: 119, width: 105, height: 11, color: "#e85e4f" });
  for (let x = 5; x < 97; x += 15) {
    block(context, { x, y: 119, width: 7, height: 11, color: "#ffe09a" });
  }
  block(context, { x: 10, y: 87, width: 32, height: 23, color: "#183e54" });
  block(context, { x: 14, y: 91, width: 24, height: 15, color: "#9de2d3" });
  block(context, { x: 51, y: 87, width: 40, height: 23, color: "#183e54" });
  block(context, { x: 55, y: 91, width: 32, height: 15, color: "#a7dce0" });
  block(context, { x: 16, y: 136, width: 31, height: 20, color: "#244e59" });
  block(context, { x: 21, y: 140, width: 21, height: 12, color: "#eed68d" });

  building(context, 282, 83, 102, 75, "#d77b51", "#85d5d0", 3);
  block(context, { x: 277, y: 77, width: 107, height: 8, color: "#f3d89a" });
  block(context, { x: 281, y: 116, width: 103, height: 12, color: "#e45c4d" });
  for (let x = 285; x < 380; x += 15) {
    block(context, { x, y: 116, width: 7, height: 12, color: "#ffe09a" });
  }
  block(context, { x: 294, y: 91, width: 35, height: 18, color: "#19465a" });
  block(context, { x: 299, y: 95, width: 25, height: 10, color: "#a8e1d3" });
  block(context, { x: 340, y: 91, width: 34, height: 18, color: "#19465a" });
  block(context, { x: 345, y: 95, width: 24, height: 10, color: "#f4d895" });

  block(context, { x: 4, y: 82, width: 92, height: 3, color: "#e8d5a2" });
  block(context, { x: 51, y: 132, width: 42, height: 15, color: "#17475a" });
  pixelText(context, "CAFE", 57, 136, "#fff0aa", 2);
  block(context, { x: 286, y: 132, width: 79, height: 14, color: "#18485a" });
  pixelText(context, "MARKET", 290, 136, "#fff0aa", 1);

  for (let x = 8; x < 97; x += 22) {
    block(context, { x, y: 111, width: 2, height: 7, color: "#d8e6bf" });
    block(context, { x: x - 2, y: 110, width: 6, height: 2, color: "#e8edcc" });
    block(context, { x, y: 130, width: 2, height: 22, color: "#e8d49a" });
  }
  for (let x = 286; x < 380; x += 19) {
    block(context, { x, y: 108, width: 2, height: 7, color: "#e3cf98" });
    block(context, { x: x - 2, y: 107, width: 6, height: 2, color: "#f2e3b2" });
  }

  tree(context, 23, 101, 1.3);
  tree(context, 67, 109, 1.05);
  tree(context, 334, 99, 1.25);
  tree(context, 365, 109, 0.95);

  for (const [x, y, width, color] of [
    [6, 90, 34, "#45ad63"],
    [17, 96, 29, "#2c9558"],
    [41, 91, 28, "#53b95f"],
    [325, 89, 39, "#40a85b"],
    [343, 96, 34, "#2c9354"],
    [359, 90, 25, "#55b960"],
  ] as const) {
    block(context, { x, y, width, height: 7, color });
  }

  block(context, { x: 110, y: 97, width: 2, height: 45, color: "#375d68" });
  block(context, { x: 105, y: 99, width: 12, height: 3, color: "#e7d49a" });
  block(context, { x: 272, y: 95, width: 2, height: 49, color: "#375d68" });
  block(context, { x: 267, y: 97, width: 12, height: 3, color: "#e7d49a" });

  block(context, { x: 121, y: 119, width: 2, height: 27, color: "#394f56" });
  block(context, { x: 116, y: 118, width: 12, height: 8, color: "#ef604f" });
  block(context, { x: 119, y: 119, width: 6, height: 4, color: "#ffed9f" });

  block(context, { x: 174, y: 149, width: 37, height: 10, color: "#e35e4e" });
  block(context, { x: 180, y: 143, width: 23, height: 9, color: "#f5d992" });
  block(context, { x: 178, y: 157, width: 6, height: 4, color: "#263e48" });
  block(context, { x: 201, y: 157, width: 6, height: 4, color: "#263e48" });
  block(context, { x: 183, y: 145, width: 7, height: 5, color: "#7ecfd2" });
  block(context, { x: 193, y: 145, width: 7, height: 5, color: "#7ecfd2" });

  for (let i = 0; i < 10; i += 1) {
    block(context, {
      x: 8 + i * 6,
      y: 171,
      width: 3,
      height: 5,
      color: i % 2 ? "#faf0ce" : "#e6a674",
    });
    block(context, {
      x: 317 + i * 6,
      y: 171,
      width: 3,
      height: 5,
      color: i % 2 ? "#faf0ce" : "#e6a674",
    });
  }
  block(context, { x: 84, y: 181, width: 3, height: 2, color: "#b3c5a5" });
  block(context, { x: 290, y: 195, width: 3, height: 2, color: "#b3c5a5" });
  block(context, { x: 240, y: 177, width: 17, height: 7, color: "#f6df9e" });
  block(context, { x: 243, y: 179, width: 6, height: 3, color: "#8eced0" });
  block(context, { x: 251, y: 179, width: 4, height: 3, color: "#8eced0" });

  block(context, { x: 0, y: 157, width: WIDTH, height: 7, color: "#e6a674" });
  block(context, { x: 0, y: 164, width: WIDTH, height: 52, color: "#4e6871" });
  block(context, { x: 0, y: 164, width: WIDTH, height: 3, color: "#f0d291" });
  block(context, { x: 0, y: 168, width: WIDTH, height: 2, color: "#304d59" });

  for (let i = 0; i < 9; i += 1) {
    const x = 191 + (i % 3) * 5;
    const y = 112 + Math.floor(i / 3) * 7;
    block(context, {
      x,
      y,
      width: 2,
      height: 3,
      color: i % 2 ? "#fff0b0" : "#df6852",
    });
  }

  block(context, { x: 28, y: 168, width: 49, height: 2, color: "#e9d8a2" });
  block(context, { x: 305, y: 168, width: 44, height: 2, color: "#e9d8a2" });
  block(context, { x: 173, y: 187, width: 36, height: 3, color: "#f4d98e" });
  block(context, { x: 142, y: 205, width: 85, height: 3, color: "#f4d98e" });
  block(context, { x: 0, y: 213, width: WIDTH, height: 3, color: "#344f58" });
}

export default function PixelCityScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    drawCity(context);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pixel-city-canvas"
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="A bright pixel-art city street with shops, trees, and office towers"
    />
  );
}
