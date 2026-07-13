import Link from "next/link";
import {
  Database,
  Table2,
  Users,
  Fingerprint,
  Trash2,
  Info,
  UserCheck,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SyncButtons } from "./sync-buttons";
import { DatasetConnectionForm } from "./dataset-connection-form";
import { AddMemberForm } from "./add-member-form";
import { ResetPasswordControl } from "./reset-password-control";
import { CANONICAL_FIELDS } from "@/lib/ingest/mapping";
import { deleteTeamMember, saveSchemaMapping, setIdentityMode } from "@/lib/admin-actions";
import { getDataSource, getTeam, resolveMapping } from "@/server/admin";
import { getIdentityMode, type IdentityMode } from "@/server/customers";
import type { StoreId } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";

export const ADMIN_TABS = [
  { id: "dataset", label: "Dataset Connection", icon: Database },
  { id: "schema", label: "Schema Mapping", icon: Table2 },
  { id: "team", label: "Team Access", icon: Users },
  { id: "identity", label: "Identity Logic", icon: Fingerprint },
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

const IDENTITY_CHOICES: { id: IdentityMode; label: string }[] = [
  { id: "email", label: "Match by email" },
  { id: "phone", label: "Match by phone" },
  { id: "both", label: "Match by both" },
];

export async function AdminPanel({
  tab,
  storeId,
  basePath,
}: {
  tab: AdminTab;
  storeId: StoreId;
  basePath: string;
}) {
  const [source, mapping, team, identityMode] = await Promise.all([
    getDataSource(storeId),
    resolveMapping(storeId),
    getTeam(),
    getIdentityMode(),
  ]);

  const kind: "sheets" | "upload" = source?.kind === "upload" ? "upload" : "sheets";

  return (
    <div className="space-y-6 anim-rise">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Admin Control Panel</h2>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            Data pipeline &amp; access management
          </p>
        </div>
        {tab === "team" || tab === "identity" ? null : (
          <SyncButtons
            store={storeId}
            showCommit={tab === "schema"}
            showSaveConnection={tab === "dataset"}
          />
        )}
      </div>

      {/* Tabs are links, not client state — each tab is a plain server render. */}
      <nav className="flex gap-1 overflow-x-auto border-b border-line scroll-slim">
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`${basePath}?tab=${t.id}`}
              scroll={false}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors duration-150",
                active
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "dataset" && (
        <Card>
          <CardBody>
            <DatasetConnectionForm
              storeId={storeId}
              kind={kind}
              endpointUrl={source?.endpointUrl ?? ""}
              lastSyncedLabel={
                source?.lastSyncedAt
                  ? `Last ${source.lastSyncMode ?? "sync"}: ${new Date(
                      source.lastSyncedAt,
                    ).toLocaleString("en-IN")} · ${source.rowCount} rows`
                  : null
              }
            />
          </CardBody>
        </Card>
      )}

      {tab === "schema" && (
        <Card>
          <CardBody>
            <p className="mb-5 text-sm text-ink-soft">
              Map each canonical field to the column header in your sheet. Blank means &ldquo;use the
              default&rdquo;. Press <strong className="font-semibold text-ink">Commit Changes</strong>{" "}
              above to save.
            </p>
            <form id="schema-mapping-form" action={saveSchemaMapping}>
              <input type="hidden" name="store" value={storeId} />
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                {CANONICAL_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label
                      htmlFor={`map-${field.key}`}
                      className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`map-${field.key}`}
                      name={field.key}
                      defaultValue={mapping[field.key] ?? field.defaultColumn}
                      placeholder={field.defaultColumn}
                      className="w-full rounded-xl border border-line bg-slate-50/60 px-3.5 py-2.5 text-sm font-semibold text-ink outline-none transition-colors duration-150 focus:border-brand-400 focus:bg-card"
                    />
                  </div>
                ))}
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {tab === "team" && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Add team member
              </p>
              <AddMemberForm />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0 sm:p-0">
              <div className="flex items-center justify-between px-5 py-4 sm:px-6">
                <h3 className="font-bold text-ink">Team access</h3>
                <span className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  Total authorized: {team.length}
                </span>
              </div>
              <div className="overflow-x-auto scroll-slim">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                      <th className="px-5 py-3 font-semibold sm:px-6">User identity</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m) => (
                      <tr key={m.id} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                        <td className="px-5 py-3.5 sm:px-6">
                          <span className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-xs font-bold text-white">
                              {initials(m.name)}
                            </span>
                            <span>
                              <span className="block font-semibold text-ink">{m.name}</span>
                              <span className="block text-xs text-ink-soft">{m.email}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                              m.role === "admin"
                                ? "bg-brand-50 text-brand-600"
                                : "bg-slate-100 text-ink-soft",
                            )}
                          >
                            {m.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-start justify-end gap-2">
                            <ResetPasswordControl userId={m.id} userName={m.name} />
                            <form action={deleteTeamMember} className="inline">
                              <input type="hidden" name="id" value={m.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-neg transition-colors duration-150 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "identity" && (
        <Card>
          <CardBody className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              Identity matching priority
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {IDENTITY_CHOICES.map((choice) => (
                <form action={setIdentityMode} key={choice.id}>
                  <input type="hidden" name="mode" value={choice.id} />
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full flex-col items-center gap-2 rounded-2xl border-2 px-4 py-8 transition-colors duration-150",
                      identityMode === choice.id
                        ? "border-brand-400 bg-brand-50/40 text-brand-600"
                        : "border-line text-ink-soft hover:border-brand-200",
                    )}
                  >
                    <UserCheck className="h-5 w-5" />
                    <span className="text-sm font-bold uppercase tracking-wide">{choice.label}</span>
                  </button>
                </form>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
              <p className="text-sm text-ink-soft">
                <strong className="font-semibold text-ink">Matching intelligence.</strong> Chooses how a
                buyer is deduplicated when computing lifetime value.{" "}
                <em className="font-medium text-ink">Both</em> prefers email and falls back to phone,
                which merges someone who ordered once on mobile and once on the web.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
