/** Vector base map — readable zones on 140×92 viewBox. */
export function SchematicCampus() {
  return (
    <g className="schematic-base">
      <rect width={140} height={92} fill="#0f1419" />
      <rect
        x={2}
        y={2}
        width={136}
        height={88}
        rx={1.5}
        fill="#121a22"
        stroke="#1e2a36"
        strokeWidth={0.35}
      />

      <ellipse cx={14} cy={42} rx={10} ry={15} fill="#142218" stroke="#1f3d2e" strokeWidth={0.35} />
      <text x={14} y={42} textAnchor="middle" className="fill-[#3d6b52] text-[3px] font-medium">
        Stadium
      </text>

      <rect x={6} y={4} width={18} height={12} rx={0.5} fill="#142218" stroke="#1f3d2e" strokeWidth={0.3} />
      <text x={15} y={11} textAnchor="middle" className="fill-[#3d6b52] text-[2.2px]">
        Fields
      </text>

      <rect
        x={44}
        y={44}
        width={22}
        height={16}
        rx={1}
        fill="#0c1218"
        stroke="#243044"
        strokeWidth={0.35}
        strokeDasharray="1.5 1"
      />
      <text x={55} y={53} textAnchor="middle" className="fill-[#4a5f73] text-[3px]">
        Main Quad
      </text>

      <rect
        x={38}
        y={28}
        width={18}
        height={12}
        rx={0.5}
        fill="#0c1218"
        stroke="#243044"
        strokeWidth={0.3}
        strokeDasharray="1 1"
      />
      <text x={47} y={35} textAnchor="middle" className="fill-[#4a5f73] text-[2.4px]">
        Lower Quad
      </text>

      <WingShell x={72} y={4} w={62} h={18} label="600" />
      <WingShell x={72} y={36} w={58} h={10} label="500" />
      <WingShell x={72} y={48} w={58} h={10} label="400" />
      <WingShell x={72} y={60} w={58} h={12} label="300" />
      <WingShell x={72} y={72} w={54} h={10} label="200" />

      <WingShell x={34} y={22} w={36} h={26} label="700" />
      <WingShell x={4} y={6} w={44} h={18} label="900" />
      <WingShell x={36} y={60} w={22} h={10} label="800" />

      <WingShell x={4} y={50} w={22} h={14} label="Theater" />
      <WingShell x={4} y={66} w={26} h={14} label="Library" />
      <WingShell x={102} y={76} w={32} h={12} label="Student Svc" />

      <WingShell x={40} y={4} w={24} h={14} label="Gym / Pool" accent />

      <Road y={2} label="North Access Road" />
      <Road y={88} label="South Access Road" />
      <text
        x={134}
        y={46}
        textAnchor="end"
        className="fill-[#3d4f63] text-[2.2px]"
        transform="rotate(90 134 46)"
      >
        East Access
      </text>

      <rect x={44} y={82} width={36} height={6} rx={0.4} fill="#1a222c" stroke="#2a3644" strokeWidth={0.25} />
      <text x={62} y={86} textAnchor="middle" className="fill-[#4a5f73] text-[2.2px]">
        Parking
      </text>
    </g>
  );
}

function WingShell({
  x,
  y,
  w,
  h,
  label,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={0.8}
        fill={accent ? "#16202e" : "#151d28"}
        stroke={accent ? "#2a4060" : "#243040"}
        strokeWidth={0.35}
      />
      <text x={x + 2} y={y + 3.5} className="fill-[#5c7088] text-[3px] font-semibold tracking-wide">
        {label}
      </text>
    </g>
  );
}

function Road({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <rect x={2} y={y} width={136} height={2.4} fill="#1a222c" />
      <text x={70} y={y + 1.6} textAnchor="middle" className="fill-[#475569] text-[2px]">
        {label}
      </text>
    </g>
  );
}
