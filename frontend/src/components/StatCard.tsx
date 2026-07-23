import React from "react";
import { Card, CardContent } from "./Card";
import { cn } from "@/utils/cn";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
}) => {
  return (
    <Card className={cn("overflow-hidden group", className)} hoverEffect>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </p>
          <div className="p-2 rounded-lg bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {value}
          </h3>
          {(trend || description) && (
            <div className="flex items-center mt-2 gap-2 text-xs">
              {trend && (
                <span
                  className={cn(
                    "font-semibold flex items-center gap-0.5",
                    trend.positive ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {trend.positive ? "+" : ""}
                  {trend.value}
                </span>
              )}
              {description && (
                <span className="text-muted-foreground font-medium">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
