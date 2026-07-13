import { notFound, redirect } from "next/navigation";
import { Package, MapPin, CreditCard, Truck, CalendarClock } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { DetailHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductThumb } from "@/components/ui/product-thumb";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getOrderDetail, type OrderLineDetail } from "@/server/orders";
import { getBacklogOrder } from "@/server/not-processed";

export const dynamic = "force-dynamic";

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** One key/value in a light info card. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value || "—"}</dd>
    </div>
  );
}

/** One product line as a rich card with its image and specs. */
function LineItemCard({ line }: { line: OrderLineDetail }) {
  const specs: { label: string; value: string }[] = [
    { label: "Quantity", value: `${formatNumber(line.quantity)} units` },
    { label: "Fabric", value: line.fabric || "—" },
    { label: "Dimension", value: line.dimension || "—" },
    { label: "Polish / Finish", value: line.polishFinish || "—" },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:flex-row sm:p-5">
      <div className="relative shrink-0">
        <ProductThumb
          imageUrl={line.imageUrl}
          name={line.productName}
          size={160}
          className="!h-40 !w-full rounded-xl sm:!w-40"
        />
        {line.productType ? (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {line.productType}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-ink">{line.productName ?? "Unnamed product"}</h3>
          <span className="shrink-0 text-lg font-extrabold text-brand-600 tnum">
            {formatCurrency(line.paymentAmount)}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          SKU: <code className="font-semibold text-ink">{line.sku || "—"}</code>
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {specs.map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                {s.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <CalendarClock className="h-3.5 w-3.5" />
            Committed:{" "}
            <span className="font-semibold text-ink">{fmtDate(line.committedDeliveryDate)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <Truck className="h-3.5 w-3.5" />
            Dispatched:{" "}
            <span className="font-semibold text-ink">{fmtDate(line.dispatchedDate)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: raw } = await params;
  const orderId = decodeURIComponent(raw);
  const f = await getFilters();

  const order = await getOrderDetail(f.storeId, orderId);

  if (!order) {
    // An order with a summary row but no line items isn't missing — it's the
    // "Not Processed" case, which has a page of its own that explains why.
    const backlog = await getBacklogOrder(f.storeId, orderId);
    if (backlog) redirect(`/not-processed/${encodeURIComponent(orderId)}`);
    notFound();
  }

  const billAddress = [order.billAddress, order.billCity, order.billState, order.billCountry, order.billZip]
    .filter(Boolean)
    .join(", ");
  const shipAddress = [order.shipAddress, order.shipCity, order.shipState, order.shipZip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/orders`}
        eyebrow={order.invoiceNo ? `Invoice ${order.invoiceNo}` : undefined}
        title={`Order ${order.orderId}`}
        subtitle={[fmtDate(order.orderDate), order.salesPerson].filter(Boolean).join("  ·  ")}
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Package className="h-5 w-5 text-brand-500" />
              Items in Order
              <span className="text-ink-soft">({order.lines.length})</span>
            </h2>
            <span className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Total qty: {formatNumber(order.totalQuantity)}
            </span>
          </div>
          {order.lines.map((l, i) => (
            <LineItemCard key={`${l.sku}-${i}`} line={l} />
          ))}
        </div>

        <div className="space-y-6">
          {/* Order Information — the reference's dark accent card. */}
          <Card className="border-0 bg-slate-900 text-white shadow-lg">
            <CardBody className="space-y-5">
              <h3 className="text-base font-bold text-white">Order Information</h3>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Payment Type
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">{order.paymentType || "—"}</p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Sales Person
                </p>
                <p className="mt-0.5 text-sm font-semibold text-brand-300">
                  {order.salesPerson || "Unattributed"}
                </p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Amount
                </p>
                <p className="mt-0.5 text-2xl font-extrabold text-emerald-400 tnum">
                  {formatCurrency(order.totalPayment)}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <CardTitle title="Billing Info" icon={<CreditCard className="h-5 w-5" />} />
              <InfoRow label="Customer Name" value={order.billingName || order.customerName || "—"} />
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Mobile" value={order.billMobile || order.mobile || "—"} />
                <InfoRow label="Email" value={order.billEmail || order.email || "—"} />
              </div>
              <InfoRow label="Address" value={billAddress || "—"} />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <CardTitle title="Shipping Info" icon={<MapPin className="h-5 w-5" />} />
              <InfoRow label="Recipient Name" value={order.customerName || "—"} />
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Mobile" value={order.mobile || "—"} />
                <InfoRow label="Email" value={order.email || "—"} />
              </div>
              <InfoRow label="Address" value={shipAddress || "—"} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
