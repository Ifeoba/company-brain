interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function MiniSparkline({ data, width = 56, height = 20, color = "var(--accent)" }: Props) {
  if (!data.length) return <svg width={width} height={height} />;

  const max = Math.max(...data, 1);
  const count = data.length;
  const gap = 1;
  const barW = Math.max(2, Math.floor((width - gap * (count - 1)) / count));

  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      {data.map((v, i) => {
        const h = v > 0 ? Math.max(2, Math.round((v / max) * height)) : 2;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            fill={v > 0 ? color : "var(--border)"}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
