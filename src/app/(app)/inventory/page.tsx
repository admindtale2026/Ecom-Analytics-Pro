import { Card, CardBody } from "@/components/ui/card";
import { ProductControls } from "@/components/inventory/product-controls";
import { ProductsTable } from "@/components/inventory/products-table";
import { type SearchParams } from "@/lib/filters";
import { getFilters } from "@/lib/filters-server";
import { getProductCategories, getProducts } from "@/server/inventory";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = await getFilters();
  const q = one(sp.q);
  const category = one(sp.category);

  const [products, categories] = await Promise.all([
    getProducts(f, { q, category }),
    getProductCategories(f),
  ]);
  const maxUnits = Math.max(1, ...products.map((p) => p.units));

  return (
    <div className="space-y-6 anim-rise">
      <Card>
        <CardBody>
          <ProductControls categories={categories} />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0 sm:p-0">
          <ProductsTable products={products} maxUnits={maxUnits} hasFilters={!!(q || category)} />
        </CardBody>
      </Card>
    </div>
  );
}
