const COLORS: [string, string][] = [
  ["#c89b3c", "#e8b452"],
  ["#3b7bbf", "#5797d6"],
  ["#8e3bbf", "#a865d6"],
  ["#3bbf7e", "#4dd498"],
  ["#bf3b5e", "#d65979"],
  ["#3bb6bf", "#56cdd4"],
  ["#bf5e3b", "#d67a56"],
  ["#3b5ebf", "#5979d6"],
];

export function avatarColors(seed: string | number): [string, string] {
  const s = String(seed);
  const sum = s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[Math.abs(sum) % COLORS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  name: string;
  size?: "lg";
}

export default function Avatar({ name, size }: Props) {
  const [a, b] = avatarColors(name);
  return (
    <div
      className={`avatar${size === "lg" ? " lg" : ""}`}
      title={name}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {initials(name)}
    </div>
  );
}
