import { notFound, redirect } from "next/navigation";
import { Package, MapPin, User, CreditCard } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { DetailHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductThumb } from "@/components/ui/product-thumb";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getOrderDetail } from "@/server/orders";
import { getBacklogOrder } from "@/server/not-processed";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orderId: raw } = await params;
  const orderId = decodeURIComponent(raw);
  const f = parseFilters(await searchParams);
  const query = filtersToQuery(f);

  const order = await getOrderDetail(f.storeId, orderId);

  if (!order) {
    // An order with a summary row but no line items isn't missing — it's the
    // "Not Processed" case, which has a page of its own that explains why.
    const backlog = await getBacklogOrder(f.storeId, orderId);
    if (backlog) redirect(`/not-processed/${encodeURIComponent(orderId)}?${query}`);
    notFound();
  }

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/orders?${query}`}
        eyebrow={order.invoiceNo ? `Invoice ${order.invoiceNo}` : undefined}
        title={`Order ${order.orderId}`}
        subtitle={[order.orderDate, order.salesPerson].filter(Boolean).join("  ·  ")}
        action={<StatusBadge status={order.status} />}
      />

      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Payment" value={formatCurrency(order.totalPayment)} accent />
        <StatTile label="Units" value={formatNumber(order.totalQuantity)} />
        <StatTile label="Line Items" value={formatNumber(order.lines.length)} />
        <StatTile label="Payment Type" value={order.paymentType || "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="p-5 sm:p-6 sm:pb-0">
              <CardTitle title="Line Items" icon={<Package className="h-5 w-5" />} />
            </div>
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-semibold sm:px-6">Product</th>
                    <th className="px-5 py-3 font-semibold">SKU</th>
                    <th className="px-5 py-3 text-right font-semibold">Qty</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l, i) => (
                    <tr key={`${l.sku}-${i}`} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 sm:px-6">
                        <span className="flex items-center gap-2.5">
                          <ProductThumb imageUrl={l.imageUrl} name={l.productName} size={36} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">
                              {l.productName ?? "Unnamed product"}
                            </span>
                            {l.productType ? (
                              <span className="block text-[11px] text-ink-soft">{l.productType}</span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs text-ink-soft">{l.sku || "—"}</code>
                      </td>
                      <td className="px-5 py-3 text-right text-ink tnum">{formatNumber(l.quantity)}</td>
                      <td className="px-5 py-3 text-right font-bold text-ink tnum">
                        {formatCurrency(l.paymentAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <CardTitle title="Customer" icon={<User className="h-5 w-5" />} />
              <dl>
                <Row label="Name" value={order.customerName || "—"} />
                <Row label="Email" value={order.email || "—"} />
                <Row label="Mobile" value={order.mobile || "—"} />
                <Row label="Salesperson" value={order.salesPerson || "Unattributed"} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle title="Shipping" icon={<MapPin className="h-5 w-5" />} />
              <dl>
                <Row label="Address" value={order.shipAddress || "—"} />
                <Row label="City" value={order.shipCity || "—"} />
                <Row label="State" value={order.shipState || "—"} />
                <Row label="PIN" value={order.shipZip || "—"} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle title="Payment" icon={<CreditCard className="h-5 w-5" />} />
              <dl>
                <Row label="Total" value={formatCurrency(order.totalPayment)} />
                <Row label="Method" value={order.paymentType || "—"} />
                <Row label="Status" value={order.status || "—"} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
