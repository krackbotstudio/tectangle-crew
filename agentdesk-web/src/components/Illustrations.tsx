interface IllustrationProps {
  className?: string;
}

export function EmptyAgentsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="80" cy="44" r="22" stroke="currentColor" strokeWidth="2" />
      <path
        d="M44 98c0-16 16-26 36-26s36 10 36 26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="128" cy="52" r="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      <path
        d="M112 96c0-10 10-16 22-16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <path d="M92 44h16M100 36v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AddAgentsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="8" y="12" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="30" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 52c0-6 5-10 12-10s12 4 12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="64" y="12" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M88 30v16M80 38h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M56 36h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyGroupsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="12" y="16" width="116" height="68" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M12 32h116" stroke="currentColor" strokeWidth="2" />
      <rect x="24" y="44" width="40" height="6" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="24" y="56" width="64" height="6" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="24" y="68" width="48" height="6" rx="2" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export function LoginIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="20" y="20" width="160" height="80" rx="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="52" r="14" stroke="currentColor" strokeWidth="2" />
      <path d="M40 88c0-10 9-18 20-18s20 8 20 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="96" y="44" width="68" height="8" rx="2" fill="currentColor" opacity="0.25" />
      <rect x="96" y="60" width="48" height="8" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="96" y="76" width="56" height="12" rx="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ChatEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 16h96a8 8 0 0 1 8 8v40a8 8 0 0 1-8 8H52l-20 16v-16H12a8 8 0 0 1-8-8V24a8 8 0 0 1 8-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28 36h64M28 52h40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
