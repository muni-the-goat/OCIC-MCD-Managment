import Image from "next/image";
import { cn } from "@/lib/utils";

export function OcicLogo({
  className,
  width = 120,
  height = 51,
  priority = false,
}: {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/ocic-logo.png"
      alt="OCIC"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
