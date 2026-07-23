import React from "react";
import { cn } from "@/utils/cn";

interface LayoutWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "max-w-7xl mx-auto w-full px-4 py-6 md:px-6 lg:px-8 flex-1 animate-fade-in",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default LayoutWrapper;
