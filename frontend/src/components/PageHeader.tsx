import React from "react";
import { cn } from "@/utils/cn";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  className,
  title,
  subtitle,
  action,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 mb-6 border-b border-border/40",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 self-start md:self-auto">{action}</div>}
    </div>
  );
};

export default PageHeader;
