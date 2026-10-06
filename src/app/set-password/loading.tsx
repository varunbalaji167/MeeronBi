import Skeleton from "@/components/ui/Skeleton";

export default function CenteredPanelLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <div className="panel w-full max-w-md">
        <Skeleton className="mx-auto h-7 w-56" />
        <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
        <Skeleton className="mx-auto mt-6 h-10 w-full" />
      </div>
    </main>
  );
}
