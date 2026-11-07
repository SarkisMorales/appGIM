export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg-food" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2fd087" />
          <stop offset="1" stopColor="#10b26c" />
        </linearGradient>
        <linearGradient id="lg-fit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8f4d" />
          <stop offset="1" stopColor="#ff4d6d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#0e1422" />
      <path d="M32 12 A20 20 0 0 0 32 52" fill="none" stroke="url(#lg-food)" strokeWidth="8" strokeLinecap="round" />
      <path d="M32 12 A20 20 0 0 1 32 52" fill="none" stroke="url(#lg-fit)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="32" cy="32" r="6" fill="#8f7bff" />
    </svg>
  );
}
