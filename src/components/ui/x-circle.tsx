'use client';
import { cn } from "@/lib/utils";
import * as React from "react";

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
  className?: string;
}

export const XCircleIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className, size = 24, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("stroke-current", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
);

XCircleIcon.displayName = "XCircleIcon";

export default XCircleIcon;
