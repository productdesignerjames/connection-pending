import { useEffect, useRef, useState } from "react";

type Character = {
  kind:
    "casual" | "skirt" | "tie" | "wheelchair" | "beanie" | "blazer" | "punk";
  height: number;
  build: number;
  skin: string;
  hair: string;
  outfit: string;
  trousers: string;
};

const people: Character[] = [
  {
    kind: "casual",
    height: 48,
    build: 8,
    skin: "#edc9a0",
    hair: "#3d3035",
    outfit: "#252b35",
    trousers: "#454272",
  },
  {
    kind: "wheelchair",
    height: 34,
    build: 11,
    skin: "#b67e55",
    hair: "#292b35",
    outfit: "#367968",
    trousers: "#354a61",
  },
  {
    kind: "skirt",
    height: 37,
    build: 11,
    skin: "#d79e7d",
    hair: "#994b33",
    outfit: "#cc5d8a",
    trousers: "#303943",
  },
  {
    kind: "tie",
    height: 51,
    build: 10,
    skin: "#8e563d",
    hair: "#29252c",
    outfit: "#d4dec3",
    trousers: "#535653",
  },
  {
    kind: "beanie",
    height: 33,
    build: 13,
    skin: "#deb68c",
    hair: "#5c4539",
    outfit: "#777d70",
    trousers: "#34434c",
  },
  {
    kind: "blazer",
    height: 41,
    build: 14,
    skin: "#704430",
    hair: "#c2bbb3",
    outfit: "#b56b4f",
    trousers: "#343e50",
  },
  {
    kind: "punk",
    height: 44,
    build: 9,
    skin: "#ca906e",
    hair: "#df609b",
    outfit: "#354d69",
    trousers: "#644865",
  },
];

function drawPerson(
  context: CanvasRenderingContext2D,
  person: Character,
  originX: number,
  dance = 0,
  phase: number | null = null,
) {
  const ink = "#232c34";
  const floor = 52;
  const top = floor - person.height;
  const torsoTop = top + 12;
  const torsoHeight = person.kind === "beanie" ? 11 : 14;
  const waist = torsoTop + torsoHeight;
  const left = 12 - Math.floor(person.build / 2);
  const sway = dance * (person.kind === "wheelchair" ? 0.6 : 1.1);
  let leftLift = Math.max(0, dance) * 8;
  let rightLift = Math.max(0, -dance) * 8;
  let leftReach = 0;
  let rightReach = 0;
  if (phase !== null) {
    const wave = (Math.sin(phase * 1.2) + 1) / 2;
    const counterWave = (Math.sin(phase * 1.2 + Math.PI) + 1) / 2;
    switch (person.kind) {
      case "casual":
        leftLift = 18 + wave * 12;
        rightLift = counterWave * 4;
        leftReach = 1 + Math.sin(phase * 2.4);
        break;
      case "wheelchair":
        leftLift = 8 + wave * 14;
        rightLift = counterWave * 2;
        leftReach = 1 + Math.sin(phase * 1.8);
        break;
      case "skirt":
        leftLift = wave * 14;
        rightLift = 5 + counterWave * 13;
        rightReach = 1 + Math.sin(phase * 2);
        break;
      case "tie":
        leftLift = 5 + wave * 8;
        rightLift = 5 + wave * 8;
        leftReach = 1 + Math.sin(phase);
        rightReach = 1 + Math.sin(phase);
        break;
      case "beanie":
        leftLift = 3 + counterWave * 5;
        rightLift = 3 + wave * 5;
        leftReach = counterWave * 2;
        rightReach = wave * 2;
        break;
      case "blazer":
        leftLift = counterWave * 3;
        rightLift = 12 + wave * 10;
        rightReach = 1 + Math.sin(phase * 2.8);
        break;
      case "punk":
        leftLift = 20 + wave * 10;
        rightLift = 20 + counterWave * 10;
        leftReach = wave * 2;
        rightReach = counterWave * 2;
        break;
    }
  }
  const rect = (
    color: string,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
    grounded = false,
  ) => {
    context.save();
    if (!grounded) context.transform(1, 0, sway / person.height, 1, -floor * sway / person.height, 0);
    context.fillStyle = color;
    context.fillRect(originX + offsetX, offsetY, width, height);
    context.restore();
  };

  const drawArm = (shoulderX: number, side: number, lift: number, reach: number) => {
    const shoulderY = torsoTop + 3;
    const handX = shoulderX + side * reach;
    const handY = (person.kind === "wheelchair" ? torsoTop + 11 : waist + 1) - lift;
    const elbowX = shoulderX + side * (1.5 + reach * 0.5);
    const elbowY = (shoulderY + handY) / 2 + 1;
    context.save();
    context.transform(1, 0, sway / person.height, 1, -floor * sway / person.height, 0);
    context.lineWidth = 2;
    context.lineCap = "butt";
    context.lineJoin = "bevel";
    context.strokeStyle = person.outfit;
    context.beginPath();
    context.moveTo(originX + shoulderX, shoulderY);
    context.lineTo(originX + elbowX, elbowY);
    context.lineTo(originX + handX, handY);
    context.stroke();
    if (person.kind === "casual") {
      context.strokeStyle = person.skin;
      context.beginPath();
      context.moveTo(originX + elbowX, elbowY);
      context.lineTo(originX + handX, handY);
      context.stroke();
    }
    context.fillStyle = person.skin;
    context.fillRect(originX + handX - 1, handY - 1, 2, 3);
    context.restore();
  };

  if (person.kind === "wheelchair") {
    rect(ink, 4, 28, 2, 15, true);
    rect(person.outfit, 7, torsoTop, person.build, 11);
    rect("#f5f1e4", 11, torsoTop, 3, 6);
    drawArm(7, -1, leftLift, leftReach);
    drawArm(18, 1, rightLift, rightReach);
    rect(ink, 6, 37, 15, 2, true);
    rect(person.trousers, 10, 35, 10, 4, true);
    rect(person.trousers, 18, 38, 3, 10, true);
    rect(ink, 19, 48, 5, 2, true);
    rect("#779bab", 19, 41, 2, 8, true);
    const ring = (centerX: number, centerY: number, radius: number) => {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const distance = offsetX * offsetX + offsetY * offsetY;
          if (
            distance <= radius * radius &&
            distance >= (radius - 2) * (radius - 2)
          ) {
            rect(ink, centerX + offsetX, centerY + offsetY, 1, 1, true);
          }
        }
      }
    };
    ring(9, 45, 7);
    rect("#8ca9b5", 9, 40, 1, 11, true);
    rect("#8ca9b5", 4, 45, 11, 1, true);
    ring(22, 50, 2);
  } else {
    const legWidth = person.build >= 13 ? 4 : person.build <= 9 ? 2 : 3;
    if (person.kind === "skirt") {
      rect(person.skin, 8, waist + 5, 2, floor - waist - 7);
      rect(person.skin, 14, waist + 5, 2, floor - waist - 7);
      rect(person.outfit, left, waist - 1, person.build, 3);
      rect(person.outfit, left - 1, waist + 2, person.build + 2, 4);
      rect(ink, left - 1, waist + 6, person.build + 2, 1);
    } else {
      rect(person.trousers, 8, waist, legWidth, floor - waist - 2);
      rect(person.trousers, 14, waist, legWidth, floor - waist - 2);
    }
    rect(ink, 6, floor - 2, legWidth + 3, 2, true);
    rect(ink, 14, floor - 2, legWidth + 3, 2, true);
    if (person.kind === "casual") {
      rect("#eeeae1", 6, floor - 1, legWidth + 3, 1, true);
      rect("#eeeae1", 14, floor - 1, legWidth + 3, 1, true);
    }
    rect(person.outfit, left, torsoTop, person.build, torsoHeight);
    rect(person.outfit, left + 2, torsoTop - 1, person.build - 4, 1);
    rect(person.outfit, left - 2, torsoTop + 2, 2, 4);
    rect(person.outfit, left + person.build, torsoTop + 2, 2, 4);
    drawArm(left - 1, -1, leftLift, leftReach);
    drawArm(left + person.build, 1, rightLift, rightReach);
    if (person.kind === "casual") {
      rect("#d7e879", 9, torsoTop + 4, 2, 2);
      rect("#df609b", 13, torsoTop + 4, 2, 2);
      rect("#d7e879", 10, torsoTop + 6, 4, 1);
      rect("#df609b", 9, torsoTop + 8, 2, 2);
      rect("#d7e879", 13, torsoTop + 8, 2, 2);
    } else {
      rect("#f5f1e4", 11, torsoTop, 3, 7);
      rect(
        person.kind === "tie" ? "#b45f75" : "#467a8b",
        12,
        torsoTop + 3,
        1,
        6,
      );
      if (person.kind === "skirt") {
        rect(ink, left, torsoTop + 1, 3, torsoHeight - 1);
        rect(ink, left + person.build - 3, torsoTop + 1, 3, torsoHeight - 1);
      }
    }
    if (person.kind === "beanie" || person.kind === "blazer") {
      rect("#d8c46b", 16, torsoTop + 5, 1, 5);
      rect("#f5f1e4", 15, torsoTop + 9, 3, 3);
    }
  }

  rect(person.hair, 8, top, 8, 3);
  rect(person.hair, 7, top + 2, 10, 5);
  rect(person.skin, 9, top + 3, 7, 7);
  rect(person.skin, 11, top + 10, 3, 3);
  if (person.kind === "casual") {
    rect(person.hair, 7, top + 4, 2, 13);
    rect(person.hair, 16, top + 3, 2, 14);
    rect(person.hair, 9, top + 2, 5, 2);
  } else if (person.kind === "skirt") {
    rect(person.hair, 7, top + 4, 2, 8);
    rect(person.hair, 16, top + 4, 2, 8);
    rect(person.hair, 8, top + 11, 2, 1);
  } else if (person.kind === "punk") {
    rect(person.skin, 7, top + 3, 2, 5);
    rect(person.hair, 11, top - 3, 2, 6);
    rect(person.hair, 10, top - 1, 4, 4);
  } else if (person.kind === "beanie") {
    rect("#d3a34f", 8, top - 2, 9, 4);
    rect("#b88239", 7, top + 2, 11, 2);
    rect("#e1ba76", 10, top - 1, 2, 2);
  } else if (person.kind === "blazer") {
    rect(person.hair, 6, top + 2, 2, 7);
    rect(person.hair, 16, top + 1, 3, 8);
    rect(person.hair, 7, top - 1, 3, 2);
    rect(person.hair, 12, top - 1, 3, 2);
  } else if (person.kind === "tie") {
    rect(person.hair, 10, top - 1, 6, 2);
  }
  rect(ink, 10, top + 5, 1, 1);
  rect(ink, 14, top + 5, 1, 1);
  rect(ink, 12, top + 8, 2, 1);
}

export default function BusinessPeopleArt({ single = false }: { single?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [characterIndex] = useState(() => Math.floor(Math.random() * people.length));
  const logicalWidth = single ? 24 : 168;
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.setTransform(3, 0, 0, 3, 0, 0);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = (timestamp: number) => {
      context.clearRect(0, 0, logicalWidth, 64);
      const selectedPeople = single ? [people[characterIndex]] : people;
      selectedPeople.forEach((person, index) => {
        const phase = motionPreference.matches ? null : timestamp / 350 + index * 0.8;
        const dance = phase === null ? 0 : Math.sin(phase);
        context.fillStyle = "#1b2c2d18";
        context.beginPath();
        context.ellipse(index * 24 + 12, person.kind === "wheelchair" ? 59.4 : 58.4, person.kind === "wheelchair" ? 11 : 9, 1.1, 0, 0, Math.PI * 2);
        context.fill();
        context.save();
        context.translate(0, 6);
        drawPerson(context, person, index * 24, dance, phase);
        context.restore();
      });
    };
    const animate = (timestamp: number) => {
      paint(timestamp);
      frame = window.requestAnimationFrame(animate);
    };
    const start = () => {
      window.cancelAnimationFrame(frame);
      paint(0);
      if (!motionPreference.matches) frame = window.requestAnimationFrame(animate);
    };
    motionPreference.addEventListener("change", start);
    start();
    return () => {
      window.cancelAnimationFrame(frame);
      motionPreference.removeEventListener("change", start);
    };
  }, [single, characterIndex, logicalWidth]);
  return (
    <canvas
      ref={canvas}
      width={logicalWidth * 3}
      height={192}
      className={`business-people-art${single ? " single-person-art" : ""}`}
      role="img"
      aria-label={single ? `Dancing office character: ${people[characterIndex].kind}` : "Seven playful pixel-art office people of different heights and builds, including a wheelchair user, a pink skirt, a beanie wearer, a punk, and a long-haired person in a loud T-shirt"}
    >
      {single ? "One randomly selected dancing office character." : "A varied office group with suits, a skirt, a wheelchair, a pink mohawk, and a deliberately terrible patterned T-shirt."}
    </canvas>
  );
}
