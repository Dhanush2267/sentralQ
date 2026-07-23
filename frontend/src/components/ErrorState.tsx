import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import Button from "./Button";
import { cn } from "@/utils/cn";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Request Failed",
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center border border-destructive/20 rounded-xl bg-destructive/5 min-h-[300px]",
        className
      )}
    >
      <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-8 w-8 stroke-[2]" />
      </div>
      <h3 className="text-lg font-semibold text-destructive mb-1">{title}</h3>
      <p className="text-sm text-destructive-foreground/80 max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <Button variant="destructive" size="sm" onClick={onRetry} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
