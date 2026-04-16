"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStaff } from "@/hooks/useLocalData";
import { StaffActions } from "./StaffActions";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/ui/RowActions";
import { FloatingActionBar } from "@/components/ui/FloatingActionBar";
import { StatusToggle } from "@/components/ui/StatusToggle";
import { offlineFetch } from "@/lib/offline-fetch";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatNumber, type NumberFormat } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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

export function StaffContent({
  merchantId,
  numberFormat = "western",
  language = "en",
}: {
  merchantId: string;
  numberFormat?: NumberFormat;
  language?: string;
}) {
  const i = t(language as Locale);
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [editStaff, setEditStaff] = useState<{
    id: string;
    name: string;
    pin: string;
    role: string;
    isActive?: boolean;
  } | null>(null);
  const staff = useLocalStaff(merchantId);

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
  const pageIds = pagedStaff.map((member) => member.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectPage() {
    setSelectedIds((prev) =>
      allPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds])),
    );
  }

  async function handleDeleteStaff(id: string, name: string) {
    setDeletingId(id);
    setFeedback(null);
    const result = await offlineFetch({
      url: "/api/merchant/staff",
      method: "DELETE",
      body: { id },
      entity: "staff",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text: result.error || i.staff.failedToDelete,
      });
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setFeedback({
        type: "success",
        text: i.common.deleted.replace("{name}", name),
      });
      router.refresh();
    }
    setDeletingId(null);
  }

  async function handleToggleActive(
    id: string,
    name: string,
    currentActive: boolean,
  ) {
    setFeedback(null);
    const result = await offlineFetch({
      url: "/api/merchant/staff",
      method: "PUT",
      body: { id, isActive: !currentActive },
      entity: "staff",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text: result.error || i.staff.failedToUpdate,
      });
    } else {
      setFeedback({
        type: "success",
        text: `${name} ${currentActive ? i.staff.deactivated : i.staff.activated}.`,
      });
      router.refresh();
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    setBulkDeleting(true);
    setFeedback(null);
    const failures: string[] = [];

    for (const id of selectedIds) {
      const result = await offlineFetch({
        url: "/api/merchant/staff",
        method: "DELETE",
        body: { id },
        entity: "staff",
        merchantId,
      });

      if (!result.ok) failures.push(result.error || i.common.deleteFailed);
    }

    if (failures.length > 0) {
      setFeedback({ type: "error", text: failures[0] });
    } else {
      setFeedback({
        type: "success",
        text: i.common.deletedCount.replace(
          "{count}",
          String(selectedIds.length),
        ),
      });
      setSelectedIds([]);
      router.refresh();
    }

    setBulkDeleting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.staff.title}
        subtitle={`${formatNumber(staff.length, numberFormat)} ${i.staff.teamMembers}`}
      >
        <StaffActions merchantId={merchantId} language={language} />
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
              <th className="px-4 py-3.5 text-start w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
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
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSelected(s.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      className="text-start cursor-pointer"
                      onClick={() => setEditStaff(s)}
                    >
                      <span className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 hover:decoration-indigo-300 transition-all">
                        {s.name}
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
                      title={
                        s.isActive
                          ? i.staff.clickToDeactivate
                          : i.staff.clickToActivate
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <RowActions
                      actions={[
                        {
                          icon: "edit",
                          label: i.common.edit,
                          onClick: () => setEditStaff(s),
                        },
                        {
                          icon: "delete",
                          label: i.common.delete,
                          variant: "danger",
                          onClick: () =>
                            setConfirmDelete({ id: s.id, name: s.name }),
                        },
                      ]}
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

      <FloatingActionBar
        selectedCount={selectedIds.length}
        onDelete={() => setConfirmBulkDelete(true)}
        onCancel={() => setSelectedIds([])}
        deleting={bulkDeleting}
        numberFormat={numberFormat}
        language={language}
      />

      {editStaff && (
        <StaffActions
          merchantId={merchantId}
          language={language}
          staff={editStaff}
          externalOpen
          onExternalClose={() => setEditStaff(null)}
          onDelete={() => {
            const { id, name } = editStaff;
            setEditStaff(null);
            setConfirmDelete({ id, name });
          }}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteStaff(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        title={i.staff.deleteStaff}
        message={i.staff.deleteStaffConfirm.replace(
          "{name}",
          confirmDelete?.name ?? "",
        )}
        confirmLabel={i.common.delete}
        loading={Boolean(deletingId)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          handleBulkDelete();
        }}
        title={i.staff.deleteSelectedStaff}
        message={i.staff.deleteSelectedConfirm.replace(
          "{count}",
          formatNumber(selectedIds.length, numberFormat),
        )}
        confirmLabel={i.common.delete}
      />
    </div>
  );
}
