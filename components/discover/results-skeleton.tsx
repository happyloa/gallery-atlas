import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder wall shown while results load. */
export function ResultsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div>
      <p className="sr-only" role="status">
        Loading artworks…
      </p>
      <Skeleton className="mt-14 h-12 w-full" />
      <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[4/5] w-full" />
            <Skeleton className="mt-5 h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
