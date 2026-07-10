import { Card, CardBody } from "@/components/ui/card";

/**
 * Route-level Suspense boundary. Every app page is dynamic (it reads
 * searchParams), so navigation always hits the server; this keeps the shell
 * responsive instead of freezing the previous page while the next one queries.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardBody>
          <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-slate-50" />
        </CardBody>
      </Card>
    </div>
  );
}
