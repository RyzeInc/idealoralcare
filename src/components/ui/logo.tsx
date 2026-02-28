"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
}

// SVG representation of the prismatic aperture logo
export function LogoMark({ size = "md", className, animate = false }: LogoMarkProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
    xl: "w-20 h-20",
  };
  const sizePx = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  }[size];

  return (
    <div className={cn(sizes[size], "relative", className)}>
      <Image
        src="/logo.png"
        alt="Ideal logo"
        width={sizePx}
        height={sizePx}
        className={cn("w-full h-full object-contain", animate && "animate-slow-spin")}
        priority
      />
    </div>
  );
}

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export function Logo({ size = "md", showText = true, className, textClassName }: LogoProps) {
  const markSizes = {
    sm: "sm" as const,
    md: "md" as const,
    lg: "lg" as const,
  };
  
  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={markSizes[size]} />
      {showText && (
        <span className={cn(
          "font-[family-name:var(--font-playfair)] font-medium tracking-tight text-[#0F1320]",
          textSizes[size],
          textClassName
        )}>
          Ideal
        </span>
      )}
    </div>
  );
}
