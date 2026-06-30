import { Link } from "react-router-dom";
import { LOGO_WORDMARK, PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/brand";
import { cn } from "../lib/utils";

interface AppLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  linkToHome?: boolean;
  homeHref?: string;
}

const sizeClass = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

export function AppLogo({
  size = "md",
  showWordmark = false,
  subtitle = PRODUCT_TAGLINE,
  className,
  linkToHome = false,
  homeHref = "/dashboard",
}: AppLogoProps) {
  const logo = (
    <img
      src="/favicon.svg"
      alt={PRODUCT_NAME}
      className={cn("shrink-0 rounded-xl object-contain", sizeClass[size])}
    />
  );

  const content = showWordmark ? (
    <div className={cn("flex items-center gap-3", className)}>
      {linkToHome ? <Link to={homeHref}>{logo}</Link> : logo}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-text-strong">{LOGO_WORDMARK}</div>
        {subtitle && <div className="truncate text-xs text-text-faint">{subtitle}</div>}
      </div>
    </div>
  ) : (
    <div className={className}>{linkToHome ? <Link to={homeHref}>{logo}</Link> : logo}</div>
  );

  return content;
}
