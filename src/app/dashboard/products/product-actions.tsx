"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import {
  IconPlus,
  IconCamera,
  IconBarcode,
  IconSettings,
} from "@/components/icons";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

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
}

export function ProductActions({
  categories,
  currency,
  merchantId,
  product,
  prefillProduct,
}: ProductActionsProps) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const isVariantPrefill = !isEdit && Boolean(prefillProduct);
  const sourceProduct = product ?? prefillProduct;
  const [open, setOpen] = useState(false);
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

  const emptyForm = {
    name: sourceProduct?.name ?? "",
    variantName: isVariantPrefill ? "" : (sourceProduct?.variantName ?? ""),
    sku: isVariantPrefill ? "" : (sourceProduct?.sku ?? ""),
    barcode: isVariantPrefill ? "" : (sourceProduct?.barcode ?? ""),
    categoryId: sourceProduct?.categoryId ?? "",
    price: sourceProduct ? String(sourceProduct.price ?? "") : "",
    costPrice: sourceProduct ? String(sourceProduct.costPrice ?? "") : "",
    stock: isVariantPrefill
      ? "0"
      : sourceProduct
        ? String(sourceProduct.stock ?? 0)
        : "0",
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
      barcode: isVariantPrefill ? "" : (sourceProduct?.barcode ?? ""),
      categoryId: sourceProduct?.categoryId ?? "",
      price: sourceProduct ? String(sourceProduct.price ?? "") : "",
      costPrice: sourceProduct ? String(sourceProduct.costPrice ?? "") : "",
      stock: isVariantPrefill
        ? "0"
        : sourceProduct
          ? String(sourceProduct.stock ?? 0)
          : "0",
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
      // silently fail — user can type SKU manually
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
          categoryId: form.categoryId || null,
        },
        entity: "product",
        merchantId,
      });

      if (!result.ok) {
        setError(
          result.error || `Failed to ${isEdit ? "update" : "create"} product`,
        );
        return;
      }

      setOpen(false);
      if (!isEdit) {
        setForm({
          name: "",
          variantName: "",
          sku: "",
          barcode: "",
          categoryId: "",
          price: "",
          costPrice: "",
          stock: "0",
          lowStockAt: "5",
          unit: "piece",
          trackStock: true,
        });
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
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
        setCategoryError(result.error || "Failed to save category");
        return;
      }

      resetCategoryForm();
      router.refresh();
    } catch {
      setCategoryError("Something went wrong");
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
    if (
      !window.confirm(
        `Delete category "${name}"? Products will be uncategorized.`,
      )
    ) {
      return;
    }

    const result = await offlineFetch({
      url: "/api/merchant/categories",
      method: "DELETE",
      body: { id },
      entity: "category",
      merchantId,
    });

    if (!result.ok) {
      setCategoryError(result.error || "Failed to delete category");
      return;
    }

    if (editingCategoryId === id) resetCategoryForm();
    router.refresh();
  }

  return (
    <>
      {isEdit ? (
        <Button onClick={openProductModal} variant="ghost" size="sm">
          Edit
        </Button>
      ) : isVariantPrefill ? (
        <Button onClick={openProductModal} variant="secondary" size="sm">
          Add Variant
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={openProductModal}>
            <IconPlus size={18} />
            Add Product
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              resetCategoryForm();
              setCategoriesOpen(true);
            }}
          >
            <IconSettings size={18} />
            Categories
          </Button>
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <IconCamera size={18} />
            Scan to Add
          </Button>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          isEdit
            ? "Edit Product"
            : isVariantPrefill
              ? "Add Variant"
              : "Add Product"
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Input
                id="name"
                label="Product name"
                placeholder="Example: Pepsi, T-shirt, Rice"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <p className="text-xs text-slate-500">
                Keep the same name for all sizes or colors of the same product.
              </p>
            </div>
            <div className="space-y-1">
              <Input
                id="variantName"
                label="Variant / option"
                placeholder="Optional: 330ml, Large, Red..."
                value={form.variantName}
                onChange={(e) =>
                  setForm({ ...form, variantName: e.target.value })
                }
              />
              <p className="text-xs text-slate-500">
                Use this for size, color, pack, flavor, or similar variations.
                Each variant gets its own SKU, barcode, price, and stock.
              </p>
            </div>
            <Select
              id="categoryId"
              label="Category"
              value={form.categoryId}
              onChange={(e) => {
                const catId = e.target.value;
                setForm({ ...form, categoryId: catId });
                if (catId && !form.sku) generateSku(catId);
              }}
              options={[
                { value: "", label: "No category" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <div>
              <div className="flex items-center gap-2">
                <Input
                  id="sku"
                  label="SKU"
                  placeholder="Auto-generated or type manually"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => generateSku(form.categoryId || undefined)}
                  disabled={skuLoading}
                  className="mt-6 p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
                  title="Auto-generate SKU"
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
                  placeholder="Scan or enter barcode"
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
                  title="Scan barcode with camera"
                >
                  <IconCamera size={18} />
                </button>
              </div>
            </div>
            <Input
              id="price"
              label={`Price (${currency})`}
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
              label={`Cost price (${currency})`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            />
            <Input
              id="stock"
              label={isEdit ? "Stock" : "Initial stock"}
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
            <Input
              id="lowStockAt"
              label="Low stock alert at"
              type="number"
              min="0"
              value={form.lowStockAt}
              onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })}
            />
            <Input
              id="unit"
              label="Unit"
              placeholder="piece, kg, box..."
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
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
                Track stock
              </label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {isEdit
                ? "Save Changes"
                : isVariantPrefill
                  ? "Create Variant"
                  : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title="Manage Categories"
        size="md"
      >
        <div className="space-y-4">
          <form
            onSubmit={handleCategorySubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Input
              id="categoryName"
              label="Category name"
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, name: e.target.value })
              }
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Color
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
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" loading={categoryLoading}>
                {editingCategoryId ? "Save Category" : "Add Category"}
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
              <p className="text-sm text-slate-400">No categories yet</p>
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
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditCategory(category)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() =>
                        handleDeleteCategory(category.id, category.name)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
