import { Zap } from "lucide-react";

type BrandProps = {
  href?: string;
};

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Zap
      className={`logo-mark ${className}`.trim()}
      aria-hidden="true"
      strokeWidth={2.75}
    />
  );
}

export function Brand({ href = "/" }: BrandProps) {
  return (
    <a className="brand" href={href}>
      <LogoMark />
      <span>Spark</span>
    </a>
  );
}
