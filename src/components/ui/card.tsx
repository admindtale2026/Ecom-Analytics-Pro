import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]",
        "transition-shadow duration-200 ease-out hover:shadow-[0_2px_6px_rgba(16,24,40,0.06),0_8px_20px_rgba(16,24,40,0.06)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-brand-500">{icon}</span> : null}
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
