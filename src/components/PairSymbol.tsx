import {
  Anchor,
  Apple,
  Bike,
  Bell,
  Briefcase,
  BookOpen,
  Camera,
  Carrot,
  Cherry,
  Cloud,
  Coffee,
  Compass,
  Crown,
  Flame,
  Flower2,
  Gem,
  Gift,
  Globe,
  Headphones,
  Heart,
  KeyRound,
  Leaf,
  Laptop,
  Lightbulb,
  Moon,
  Mountain,
  Music,
  Pizza,
  Puzzle,
  Plane,
  Rocket,
  Star,
  Sun,
  TreePine,
  Ticket,
  Trophy,
  Umbrella,
  Waves,
  Watch,
  Zap,
} from "lucide-react";
import { PAIR_SYMBOLS } from "../rooms";

const icons = {
  Star,
  Heart,
  Sun,
  Moon,
  Cloud,
  Umbrella,
  Lightning: Zap,
  Flame,
  Leaf,
  Flower: Flower2,
  Tree: TreePine,
  Mountain,
  Waves,
  Anchor,
  Apple,
  Cherry,
  Carrot,
  Coffee,
  Pizza,
  Music,
  Headphones,
  Camera,
  Gift,
  Key: KeyRound,
  Bicycle: Bike,
  Rocket,
  Plane,
  Crown,
  Diamond: Gem,
  Lightbulb,
  Book: BookOpen,
  Compass,
  Bell, Briefcase, Globe, Laptop, Puzzle, Ticket, Watch, Trophy,
} satisfies Record<(typeof PAIR_SYMBOLS)[number], typeof Star>;

export default function PairSymbol({
  symbol,
  className = "pair-symbol",
  number,
}: {
  symbol: string;
  className?: string;
  number?: number;
}) {
  const name = PAIR_SYMBOLS.find((item) => item === symbol) ?? "Star";
  const Icon = icons[name];
  return (
    <span
      className={`matching-symbol ${className}`}
      role="img"
      aria-label={`${name} icon${number ? `, person ${number}` : ""}`}
    >
      <Icon aria-hidden="true" strokeWidth={2} />
      <span aria-hidden="true">{name}{number ? ` · ${number}` : ""}</span>
    </span>
  );
}
