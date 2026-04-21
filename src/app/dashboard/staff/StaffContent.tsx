"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";
import { StaffActions } from "./StaffActions";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/ui/RowActions";
import { StatusToggle } from "@/components/ui/StatusToggle";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatNumber, type NumberFormat } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { toggleStaffActive } from "@/app/actions/merchant";

const PAGE_SIZE = 10;

function formatStaffRoleLabel(role: string, i: ReturnType<typeof t>) {
  const roleMap: Record<string, string> = {
    OWNER: i.staff.roleOwner,
    MANAGER: i.staff.roleManager,
    CASHIER: i.staff.roleCashier,
  };
  return (
    roleMap[role.toUpperCase()] ??
    role
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function StaffContent(props: {
  currentStaffId: string | null;
  numberFormat?: NumberFormat;
  language?: string;
  staff: {
    id: string;
    name: string;
    pin: string;
    role: string;
    isActive: boolean;
    isOwner: boolean;
    allowedPages: string[];
    maxDiscountPercent: number;
  }[];
}) {
  const { currentStaffId, numberFormat = "western", language = "en" } = props;
  const i = t(language as Locale);
  type StaffRow = (typeof props.staff)[number];
  const [staff, setStaff] = useOptimistic(
    props.staff,
    (
      current: StaffRow[],
      updater: StaffRow[] | ((prev: StaffRow[]) => StaffRow[]),
    ) =>
      typeof updater === "function"
        ? (updater as (prev: StaffRow[]) => StaffRow[])(current)
        : updater,
  );

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [editStaff, setEditStaff] = useState<{
    id: string;
    name: string;
    pin: string;
    role: string;
    isActive?: boolean;
  } | null>(null);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;

    return staff.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query) ||
        formatStaffRoleLabel(member.role, i).toLowerCase().includes(query),
    );
  }, [staff, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedStaff = filteredStaff.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  async function handleToggleActive(
    id: string,
    name: string,
    currentActive: boolean,
  ) {
    setFeedback(null);
    try {
      const result = await toggleStaffActive(id, !currentActive);

      if (result.error) {
        setFeedback({
          type: "error",
          text: result.error || i.staff.failedToUpdate,
        });
      } else {
        startTransition(() => {
          setStaff((prev) =>
            prev.map((member) =>
              member.id === id
                ? { ...member, isActive: !currentActive }
                : member,
            ),
          );
        });
        setFeedback({
          type: "success",
          text: `${name} ${currentActive ? i.staff.deactivated : i.staff.activated}.`,
        });
      }
    } catch {
      setFeedback({ type: "error", text: i.staff.failedToUpdate });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.staff.title}
        subtitle={`${formatNumber(staff.length, numberFormat)} ${i.staff.teamMembers}`}
      >
        <StaffActions
          language={language}
          onSaved={(savedStaff) => {
            const normalized = {
              ...savedStaff,
              isActive: savedStaff.isActive ?? true,
              isOwner: savedStaff.isOwner ?? false,
              allowedPages: savedStaff.allowedPages ?? [],
            };
            setStaff((prev) => {
              const next = prev.some((member) => member.id === normalized.id)
                ? prev.map((member) =>
                    member.id === normalized.id ? normalized : member,
                  )
                : [normalized, ...prev];

              return [...next].sort((a, b) => a.name.localeCompare(b.name));
            });
          }}
        />
      </PageHeader>

      <div className="w-full md:max-w-sm">
        <SearchInput
          id="staff-search"
          label={i.common.search}
          placeholder={i.staff.searchPlaceholder}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filteredStaff.length}
          totalCount={staff.length}
          numberFormat={numberFormat}
          language={language}
        />
      </div>

      {feedback && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.name}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.staff.role}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.staff.pin}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.status}
              </th>
              <th className="px-4 py-3.5 text-end font-semibold">
                {i.common.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredStaff.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {staff.length === 0
                    ? i.staff.noStaffYet
                    : i.staff.noStaffMatch}
                </td>
              </tr>
            ) : (
              pagedStaff.map((s) => (
                <tr
                  key={s.id}
                  className={`transition-colors ${
                    !s.isActive
                      ? "opacity-50"
                      : s.id === currentStaffId
                        ? "bg-indigo-50/60 hover:bg-indigo-50"
                        : "hover:bg-slate-50/50"
                  }`}
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      className="text-start cursor-pointer"
                      onClick={() => setEditStaff(s)}
                    >
                      <span className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 hover:decoration-indigo-300 transition-all">
                        {s.name}
                        {s.id === currentStaffId && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-400 no-underline">
                            ({i.common.you})
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatStaffRoleLabel(s.role, i)}
                  </td>
                  <td className="px-5 py-4 text-slate-400 font-mono text-xs">
                    {"••••"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusToggle
                      isActive={s.isActive}
                      activeLabel={i.common.active}
                      inactiveLabel={i.common.inactive}
                      onToggle={() =>
                        handleToggleActive(s.id, s.name, s.isActive)
                      }
                      disabled={s.isOwner}
                      title={
                        s.isOwner
                          ? ""
                          : s.isActive
                            ? i.staff.clickToDeactivate
                            : i.staff.clickToActivate
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <RowActions
                      actions={
                        s.isOwner
                          ? []
                          : [
                              {
                                icon: "edit",
                                label: i.common.edit,
                                onClick: () => setEditStaff(s),
                              },
                            ]
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredStaff.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * PAGE_SIZE + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * PAGE_SIZE, filteredStaff.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filteredStaff.length, numberFormat)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {i.common.previous}
            </Button>
            <span className="text-sm text-slate-500">
              {i.common.page} {formatNumber(currentPage, numberFormat)} /{" "}
              {formatNumber(totalPages, numberFormat)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              {i.common.next}
            </Button>
          </div>
        </div>
      )}

      {editStaff && (
        <StaffActions
          language={language}
          staff={editStaff}
          externalOpen
          onExternalClose={() => setEditStaff(null)}
          onSaved={(savedStaff) => {
            const normalized = {
              ...savedStaff,
              isActive: savedStaff.isActive ?? true,
              isOwner: savedStaff.isOwner ?? false,
              allowedPages: savedStaff.allowedPages ?? [],
            };
            setStaff((prev) =>
              prev
                .map((member) =>
                  member.id === normalized.id ? normalized : member,
                )
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          }}
        />
      )}
    </div>
  );
}
