"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { CreatableSelect } from "@/components/ui/CreatableSelect";
import { Modal } from "@/components/ui/Modal";
import {
  IconPlus,
  IconCamera,
  IconBarcode,
  IconSettings,
} from "@/components/Icons";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { t, type Locale } from "@/lib/i18n";

interface Category {
  id: string;
  name: string;
  color?: string | null;
  sortOrder?: number;
}

interface EditableProduct {
  id: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  price: number;
  costPrice: number;
  stock: number;
  lowStockAt?: number;
  unit?: string;
  trackStock: boolean;
}

interface ProductActionsProps {
  categories: Category[];
  currency: string;
  merchantId: string;
  product?: EditableProduct;
  prefillProduct?: Partial<EditableProduct>;
  initialBarcode?: string;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  language?: string;
}

export function ProductActions({
  categories,
  currency,
  merchantId,
  product,
  prefillProduct,
  initialBarcode,
  externalOpen,
  onExternalClose,
  language = "en",
}: ProductActionsProps) {
  const router = useRouter();
  const i = t(language as Locale);
  const isEdit = Boolean(product);
  const isVariantPrefill = !isEdit && Boolean(prefillProduct);
  const sourceProduct = product ?? prefillProduct;
  const [open, setOpen] = useState(false);
  const isModalOpen = externalOpen ?? open;
  const closeModal = () => {
    setOpen(false);
    onExternalClose?.();
  };
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [confirmCategoryDelete, setConfirmCategoryDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const defaultCategoryId =
    categories.find((c) => c.name === "Other")?.id ?? categories[0]?.id ?? "";

  const emptyForm = {
    name: sourceProduct?.name ?? "",
    variantName: isVariantPrefill ? "" : (sourceProduct?.variantName ?? ""),
    sku: isVariantPrefill ? "" : (sourceProduct?.sku ?? ""),
    barcode: isVariantPrefill
      ? ""
      : (sourceProduct?.barcode ?? initialBarcode ?? ""),
    categoryId: sourceProduct?.categoryId ?? defaultCategoryId,
    price: sourceProduct ? String(sourceProduct.price ?? "") : "",
    costPrice: sourceProduct ? String(sourceProduct.costPrice ?? "") : "",
    stock: isVariantPrefill
      ? ""
      : sourceProduct
        ? String(sourceProduct.stock ?? 0)
        : "",
    lowStockAt: sourceProduct ? String(sourceProduct.lowStockAt ?? 5) : "5",
    unit: sourceProduct?.unit ?? "piece",
    trackStock: sourceProduct?.trackStock ?? true,
  };

  const [form, setForm] = useState(emptyForm);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    color: "#4f46e5",
  });

  function resetProductForm() {
    setForm({
      name: sourceProduct?.name ?? "",
      variantName: isVariantPrefill ? "" : (sourceProduct?.variantName ?? ""),
      sku: isVariantPrefill ? "" : (sourceProduct?.sku ?? ""),
      barcode: isVariantPrefill
        ? ""
        : (sourceProduct?.barcode ?? initialBarcode ?? ""),
      categoryId: sourceProduct?.categoryId ?? defaultCategoryId,
      price: sourceProduct ? String(sourceProduct.price ?? "") : "",
      costPrice: sourceProduct ? String(sourceProduct.costPrice ?? "") : "",
      stock: isVariantPrefill
        ? ""
        : sourceProduct
          ? String(sourceProduct.stock ?? 0)
          : "",
      lowStockAt: sourceProduct ? String(sourceProduct.lowStockAt ?? 5) : "5",
      unit: sourceProduct?.unit ?? "piece",
      trackStock: sourceProduct?.trackStock ?? true,
    });
  }

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryError("");
    setCategoryForm({ name: "", color: "#4f46e5" });
  }

  async function generateSku(categoryId?: string) {
    setSkuLoading(true);
    try {
      const params = categoryId ? `?categoryId=${categoryId}` : "";
      const res = await fetch(`/api/merchant/products/generate-sku${params}`);
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, sku: data.sku }));
      }
    } catch {
      // silently fail · user can type SKU manually
    } finally {
      setSkuLoading(false);
    }
  }

  function handleBarcodeScan(barcode: string) {
    setScannerOpen(false);
    setForm((prev) => ({ ...prev, barcode }));
    setOpen(true);
  }

  function openProductModal() {
    setError("");
    resetProductForm();
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/products",
        method: isEdit ? "PUT" : "POST",
        body: {
          ...(isEdit ? { id: product?.id } : {}),
          ...form,
          variantName: form.variantName || null,
          price: parseFloat(form.price || "0"),
          costPrice: parseFloat(form.costPrice || "0"),
          stock: parseInt(form.stock || "0"),
          lowStockAt: parseInt(form.lowStockAt || "5"),
          categoryId:
            form.categoryId ||
            categories.find((c) => c.name === "Other")?.id ||
            categories[0]?.id,
        },
        entity: "product",
        merchantId,
      });

      if (!result.ok) {
        setError(result.error || i.products.somethingWentWrong);
        return;
      }

      closeModal();
      if (!isEdit) {
        setForm({
          name: "",
          variantName: "",
          sku: "",
          barcode: "",
          categoryId: defaultCategoryId,
          price: "",
          costPrice: "",
          stock: "",
          lowStockAt: "5",
          unit: "piece",
          trackStock: true,
        });
      }
      router.refresh();
    } catch {
      setError(i.products.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    setCategoryLoading(true);
    setCategoryError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/categories",
        method: editingCategoryId ? "PUT" : "POST",
        body: {
          ...(editingCategoryId ? { id: editingCategoryId } : {}),
          name: categoryForm.name,
          color: categoryForm.color,
          sortOrder:
            editingCategoryId &&
            categories.some((c) => c.id === editingCategoryId)
              ? (categories.find((c) => c.id === editingCategoryId)
                  ?.sortOrder ?? 0)
              : categories.length,
        },
        entity: "category",
        merchantId,
      });

      if (!result.ok) {
        setCategoryError(result.error || i.products.failedToSaveCategory);
        return;
      }

      resetCategoryForm();
      router.refresh();
    } catch {
      setCategoryError(i.products.somethingWentWrong);
    } finally {
      setCategoryLoading(false);
    }
  }

  function startEditCategory(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      color: category.color || "#4f46e5",
    });
    setCategoriesOpen(true);
  }

  async function handleDeleteCategory(id: string, name: string) {
    const result = await offlineFetch({
      url: "/api/merchant/categories",
      method: "DELETE",
      body: { id },
      entity: "category",
      merchantId,
    });

    if (!result.ok) {
      setCategoryError(result.error || i.products.failedToDeleteCategory);
      return;
    }

    if (editingCategoryId === id) resetCategoryForm();
    router.refresh();
  }

  return (
    <>
      {!externalOpen &&
        (isEdit ? (
          <Button onClick={openProductModal} variant="ghost" size="sm">
            {i.products.editBtn}
          </Button>
        ) : isVariantPrefill ? (
          <Button onClick={openProductModal} variant="secondary" size="sm">
            {i.products.addVariant}
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openProductModal}>
              <IconPlus size={18} />
              {i.products.addProduct}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                resetCategoryForm();
                setCategoriesOpen(true);
              }}
            >
              <IconSettings size={18} />
              {i.products.categories}
            </Button>
          </div>
        ))}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={
          isEdit
            ? i.products.editProduct
            : isVariantPrefill
              ? i.products.addVariant
              : i.products.addProduct
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Input
                id="name"
                label={i.products.productName}
                placeholder={i.products.productNamePlaceholder}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <p className="text-xs text-slate-500">
                {i.products.productNameHint}
              </p>
            </div>
            <div className="space-y-1">
              <Input
                id="variantName"
                label={i.products.variantOption}
                placeholder={i.products.variantPlaceholder}
                value={form.variantName}
                onChange={(e) =>
                  setForm({ ...form, variantName: e.target.value })
                }
              />
              <p className="text-xs text-slate-500">{i.products.variantHint}</p>
            </div>
            <CategorySelect
              label={i.products.category}
              value={form.categoryId}
              categories={categories}
              translateName={(n) =>
                n === "Other" ? i.products.categoryOther : n
              }
              onChange={(catId) => {
                setForm({ ...form, categoryId: catId });
                if (catId && !form.sku) generateSku(catId);
              }}
              onCreateCategory={async (name, color) => {
                const result = await offlineFetch({
                  url: "/api/merchant/categories",
                  method: "POST",
                  body: { name, color, sortOrder: categories.length },
                  entity: "category",
                  merchantId,
                });
                if (result.ok && result.data?.id) {
                  router.refresh();
                  return result.data.id as string;
                }
                return null;
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <Input
                  id="sku"
                  label="SKU"
                  placeholder={i.products.skuPlaceholder}
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => generateSku(form.categoryId || undefined)}
                  disabled={skuLoading}
                  className="mt-6 p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
                  title={i.products.autoGenerateSku}
                >
                  <IconBarcode size={18} />
                </button>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Input
                  id="barcode"
                  label="Barcode"
                  placeholder={i.products.barcodePlaceholder}
                  value={form.barcode}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="mt-6 p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  title={i.products.scanBarcode}
                >
                  <IconCamera size={18} />
                </button>
              </div>
            </div>
            <Input
              id="price"
              label={`${i.products.price} (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
            <Input
              id="costPrice"
              label={`${i.products.costPriceLabel} (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            />
            <div>
              <Input
                id="stock"
                label={isEdit ? i.products.stock : i.products.initialStock}
                type="number"
                min="0"
                placeholder="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
              {!isEdit && (
                <div className="flex gap-1.5 mt-2">
                  {[0, 5, 10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm({ ...form, stock: String(n) })}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                        form.stock === String(n)
                          ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              id="lowStockAt"
              label={`${i.products.lowStockAlertAt}`}
              type="number"
              min="0"
              value={form.lowStockAt}
              onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })}
            />
            <CreatableSelect
              label={i.products.selectUnit.replace("...", "")}
              value={form.unit}
              onChange={(val) => setForm({ ...form, unit: val })}
              placeholder={i.products.selectUnit}
              formatOption={(opt) => {
                const unitMap: Record<string, string> = {
                  piece: i.products.unitPiece,
                  kg: i.products.unitKg,
                  g: i.products.unitG,
                  liter: i.products.unitLiter,
                  ml: i.products.unitMl,
                  box: i.products.unitBox,
                  pack: i.products.unitPack,
                  dozen: i.products.unitDozen,
                  meter: i.products.unitMeter,
                };
                return unitMap[opt] || opt;
              }}
              options={[
                "piece",
                "kg",
                "g",
                "liter",
                "ml",
                "box",
                "pack",
                "dozen",
                "meter",
              ]}
            />
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="trackStock"
                checked={form.trackStock}
                onChange={(e) =>
                  setForm({ ...form, trackStock: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="trackStock"
                className="text-sm text-slate-700 font-medium"
              >
                {i.products.trackStock}
              </label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" type="button" onClick={closeModal}>
              {i.products.cancel}
            </Button>
            <Button type="submit" loading={loading}>
              {isEdit
                ? i.products.saveChanges
                : isVariantPrefill
                  ? i.products.createVariant
                  : i.products.createProduct}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title={i.products.manageCategories}
        size="md"
      >
        <div className="space-y-4">
          <form
            onSubmit={handleCategorySubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Input
              id="categoryName"
              label={i.products.categoryName}
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, name: e.target.value })
              }
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {i.products.color}
              </label>
              <input
                type="color"
                value={categoryForm.color}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, color: e.target.value })
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              {editingCategoryId && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={resetCategoryForm}
                >
                  {i.products.cancelEdit}
                </Button>
              )}
              <Button type="submit" loading={categoryLoading}>
                {editingCategoryId
                  ? i.products.saveCategory
                  : i.products.addCategory}
              </Button>
            </div>
          </form>

          {categoryError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {categoryError}
            </p>
          )}

          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-slate-400">
                {i.products.noCategoriesYet}
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: category.color || "#4f46e5" }}
                    />
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {category.name === "Other"
                        ? i.products.categoryOther
                        : category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditCategory(category)}
                    >
                      {i.products.editBtn}
                    </Button>
                    {category.name !== "Other" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setConfirmCategoryDelete({
                            id: category.id,
                            name: category.name,
                          })
                        }
                      >
                        {i.products.deleteBtn}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {scannerOpen && (
        <BarcodeScanner
          language={language}
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmCategoryDelete)}
        onClose={() => setConfirmCategoryDelete(null)}
        onConfirm={() => {
          if (confirmCategoryDelete) {
            handleDeleteCategory(
              confirmCategoryDelete.id,
              confirmCategoryDelete.name,
            );
            setConfirmCategoryDelete(null);
          }
        }}
        title={i.products.deleteCategory}
        message={i.products.deleteCategoryMessage}
        confirmLabel={i.products.deleteBtn}
      />
    </>
  );
}
