interface Props {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const FILLED = new Set(["github"]);

const PATHS: Record<string, React.ReactNode> = {
  check: <path d="M3 8l3 3 7-7" />,
  plus: <><path d="M8 3v10M3 8h10" /></>,
  arrow_right: <><path d="M3 8h10M9 4l4 4-4 4" /></>,
  arrow_left: <><path d="M13 8H3M7 4L3 8l4 4" /></>,
  chevron_right: <path d="M6 4l4 4-4 4" />,
  chevron_down: <path d="M4 6l4 4 4-4" />,
  spark: <path d="M8 1L9.5 6 14 7l-4.5 1L8 13l-1.5-5L2 7l4.5-1z" />,
  paperplane: <path d="M2 8L14 2l-4 12-2-5z" />,
  download: <><path d="M8 2v9M4 7l4 4 4-4" /><path d="M2 14h12" /></>,
  edit: <path d="M2 14l1-4 9-9 3 3-9 9z" />,
  logout: <><path d="M10 12l3-4-3-4" /><path d="M13 8H6" /><path d="M6 3H3v10h3" /></>,
  key: <><circle cx="6" cy="10" r="3" /><path d="M8 9l6-6M11 4l2 2" /></>,
  bell: <><path d="M4 11V8a4 4 0 018 0v3l1 2H3z" /><path d="M6.5 13.5a1.5 1.5 0 003 0" /></>,
  x: <path d="M3 3l10 10M13 3L3 13" />,
  copy: <><rect x="5" y="3" width="8" height="10" rx="1" /><rect x="3" y="5" width="8" height="10" rx="1" /></>,
  github: <path fillRule="evenodd" d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8c0 2.88 1.87 5.32 4.47 6.18.33.06.45-.14.45-.31v-1.08c-1.8.39-2.18-.87-2.18-.87-.3-.75-.73-.95-.73-.95-.6-.41.04-.4.04-.4.66.05 1.01.68 1.01.68.59 1.01 1.54.72 1.92.55.06-.43.23-.72.42-.89-1.44-.16-2.95-.72-2.95-3.2 0-.71.25-1.28.67-1.74-.07-.16-.29-.82.06-1.71 0 0 .55-.18 1.8.67A6.27 6.27 0 018 4.91c.55 0 1.11.08 1.63.22 1.25-.85 1.8-.67 1.8-.67.35.89.13 1.55.06 1.71.42.46.67 1.03.67 1.74 0 2.49-1.52 3.04-2.96 3.2.23.2.44.59.44 1.19v1.77c0 .17.12.37.45.31A6.52 6.52 0 0014.5 8C14.5 4.41 11.59 1.5 8 1.5z" fill="currentColor" />,
};

export default function Icon({ name, size = 16, color = "currentColor", style }: Props) {
  const content = PATHS[name];
  if (!content) return null;
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {content}
    </svg>
  );
}
