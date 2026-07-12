import type { ReactNode } from "react";

type MobilePageHeaderProps = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function MobilePageHeader({
  title,
  left,
  right,
  className = "",
}: MobilePageHeaderProps) {
  return (
    <header
      className={`grid min-h-11 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 px-[max(0px,env(safe-area-inset-left))] lg:hidden ${className}`}
    >
      <div className="grid size-11 place-items-center">{left}</div>
      <h1 className="min-w-0 truncate text-center font-sans text-[21px] font-extrabold leading-none tracking-[-0.025em] text-[#faf6f0]">
        {title}
      </h1>
      <div className="grid size-11 place-items-center justify-self-end">{right}</div>
    </header>
  );
}
