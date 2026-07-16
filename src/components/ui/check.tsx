import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
  className?: string;
}

export const CheckIcon = React.forwardRef<SVGSVGElement, CheckProps>(
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
);

CheckIcon.displayName = "CheckIcon";

export default CheckIcon;