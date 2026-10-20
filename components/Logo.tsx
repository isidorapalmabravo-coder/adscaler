export function LogoMark({ dark = false }: { dark?: boolean }) {
  const bg = dark ? "#0B1B3A" : "#FFFFFF";
  const fg = dark ? "#FFFFFF" : "#0B1B3A";
  return (
    <svg className="logo-mark" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="4" fill={bg} />
      <rect x="6" y="18" width="5" height="8" fill={fg} />
      <rect x="13.5" y="12" width="5" height="14" fill={fg} />
      <rect x="21" y="6" width="5" height="20" fill={fg} />
    </svg>
  );
}
