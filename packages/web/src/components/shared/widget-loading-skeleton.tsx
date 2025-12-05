import { LoadingIndicator } from "@openai/apps-sdk-ui/components/Indicator";
import { cn } from "@/lib/utils/cn";

interface WidgetLoadingSkeletonProps {
  className?: string;
}

export function WidgetLoadingSkeleton({ className }: WidgetLoadingSkeletonProps = {}) {
  return (
    <div
      className={cn(
        "w-full h-full min-h-[400px] flex flex-col items-center justify-center p-6",
        className
      )}
    >
      <LoadingIndicator size={24} className="text-secondary" />
    </div>
  );
}
