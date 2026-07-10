import { notFound } from "next/navigation";
import { AlertCircle, Calendar, User, CreditCard } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { DetailHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { formatCurrency } from "@/lib/utils";
import { getBacklogOrder } from "@/server/not-processed";

export const dynamic = "force-dynamic";

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200/60 py-2.5 last:border-0">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={accent ? "text-sm font-bold text-brand-600 tnum" : "text-sm font-bold text-ink tnum"}>
        {value}
      </dd>
    </div>
  );
}

export default async function BacklogOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orderId: raw } = await params;
  const orderId = decodeURIComponent(raw);
  const f = parseFilters(await searchParams);

  const order = await getBacklogOrder(f.storeId, orderId);
  if (!order) notFound();

  const query = filtersToQuery(f);

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/not-processed?${query}`}
        title={`Order ${order.orderId}`}
        subtitle={[order.orderDate, order.salesPerson, formatCurrency(order.paymentAmount)]
          .filter(Boolean)
          .join("  ·  ")}
        action={<StatusBadge status="Not Processed" />}
      />

      {/*
        A warning surface, not an error: the order is real and the money is
        real — only the fulfilment rows are missing. Amber, not red.
      */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardBody className="flex flex-col items-center gap-5 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertCircle className="h-8 w-8" />
          </span>
          <div className="max-w-md space-y-2">
            <h2 className="text-lg font-bold text-amber-900">This order is not processed yet.</h2>
            <p className="text-sm leading-relaxed text-amber-800">
              We found the basic record in the Order Summary sheet, but detailed product, billing and
              shipping information is not currently available for this order ID.
            </p>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-card p-5 text-left">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Available summary data
            </p>
            <dl>
              <Field label="Order ID" value={order.orderId} />
              <Field label="Date" value={order.orderDate ?? "—"} />
              <Field label="Customer" value={order.customerName || "—"} />
              <Field label="Payment" value={formatCurrency(order.paymentAmount)} accent />
              <Field label="Sales Person" value={order.salesPerson || "—"} />
            </dl>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-amber-700">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {order.orderDate ?? "No date"}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {order.salesPerson || "Unattributed"}
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              {formatCurrency(order.paymentAmount)}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
