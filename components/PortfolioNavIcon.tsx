type PortfolioNavIconProps = {
  className?: string;
};

export function PortfolioNavIcon({ className = "size-5" }: PortfolioNavIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4a8 8 0 0 1 8 8h-8V4Z" fill="currentColor" opacity="0.28" stroke="none" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v8h8" />
      <path d="M12 12l5.65 5.65" opacity="0.72" />
    </svg>
  );
}
