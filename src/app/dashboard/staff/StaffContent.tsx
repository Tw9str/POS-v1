"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStaff } from "@/hooks/useLocalData";
import { StaffActions } from "./StaffActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { offlineFetch } from "@/lib/offline-fetch";
import { PageHeader } from "@/components/layout/PageHeader";
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
  const [editMode, setEditMode] = useState(false);
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
      setFeedback({ type: "success", text: `Deleted "${name}".` });
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
        text: `Deleted ${selectedIds.length} staff members.`,
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

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            id="staff-search"
            label={i.common.search}
            placeholder={i.staff.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setEditMode((prev) => !prev);
              if (editMode) setSelectedIds([]);
            }}
          >
            {editMode ? i.common.done : i.common.edit}
          </Button>
          {editMode && selectedIds.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setConfirmBulkDelete(true)}
            >
              {bulkDeleting
                ? i.common.deleting
                : `${i.common.deleteSelected} (${formatNumber(selectedIds.length, numberFormat)})`}
            </Button>
          )}
        </div>
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
              {editMode && (
                <th className="px-4 py-3.5 text-start">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredStaff.length === 0 ? (
              <tr>
                <td
                  colSpan={editMode ? 6 : 5}
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
                  {editMode && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggleSelected(s.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  )}
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
                    <button
                      type="button"
                      className="group flex items-center gap-2 cursor-pointer"
                      onClick={() =>
                        handleToggleActive(s.id, s.name, s.isActive)
                      }
                      title={
                        s.isActive
                          ? i.staff.clickToDeactivate
                          : i.staff.clickToActivate
                      }
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${s.isActive ? "bg-green-500" : "bg-slate-300"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${s.isActive ? "ltr:translate-x-4 rtl:-translate-x-4 ltr:ml-0.5 rtl:mr-0.5" : "ltr:translate-x-0.5 rtl:-translate-x-0.5"}`}
                        />
                      </span>
                      <span
                        className={`text-xs font-medium ${s.isActive ? "text-green-700" : "text-slate-500"}`}
                      >
                        {s.isActive ? i.common.active : i.common.inactive}
                      </span>
                    </button>
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
