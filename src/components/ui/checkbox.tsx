import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
      props.onChange?.(e);
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className={cn(
            "h-4 w-4 appearance-none rounded border border-[#E8E3DF] bg-white cursor-pointer transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F64E8] focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "checked:bg-[#5F64E8] checked:border-[#5F64E8]",
            className
          )}
          {...props}
        />
        {checked && (
          <Check className="absolute h-3 w-3 text-white pointer-events-none left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox"

export { Checkbox }
export type { CheckboxProps }

