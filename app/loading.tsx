import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Container className="py-24 sm:py-32">
      <p className="sr-only" role="status">
        Loading the gallery…
      </p>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-12 w-full max-w-xl" />
      <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-14 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[4/5] w-full" />
            <Skeleton className="mt-5 h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </Container>
  );
}
