import * as XLSX from "xlsx";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { getCurrentUser } from "@/lib/session";
import { getOrders } from "@/server/orders";

export const runtime = "nodejs";

/** Cap the export so one click can't try to serialize a million rows. */
const MAX_ROWS = 10_000;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * "Export to Excel" on the Orders page. Honours exactly the filters currently
 * applied in the UI — the query string is passed straight through to the same
 * `parseFilters` / `getOrders` the table itself uses, so the file always
 * matches what the user is looking at.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user.storeAccess.length && user.role !== "admin") {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const sp: SearchParams = Object.fromEntries(url.searchParams.entries());
  const f = parseFilters(sp);

  const { rows } = await getOrders(f, {
    q: one(sp.q),
    state: one(sp.state),
    status: one(sp.status),
    page: 1,
    pageSize: MAX_ROWS,
  });

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      "Order ID": r.orderId,
      "Order Date": r.orderDate ?? "",
      Customer: r.userName ?? "",
      City: r.billCity ?? "",
      State: r.billState ?? "",
      "Total Items": r.totalItems,
      "Order Quantity": r.orderQuantity,
      "Payment Amount": r.paymentAmount,
      "Sales Person": r.salesPerson ?? "",
      Status: r.status ?? "",
    })),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Orders");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-${f.storeId}-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
