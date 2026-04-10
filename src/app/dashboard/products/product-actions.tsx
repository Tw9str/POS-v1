"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { IconPlus, IconCamera, IconBarcode } from "@/components/icons";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

interface Category {
  id: string;
  name: string;
}

interface ProductActionsProps {
  categories: Category[];
  currency: string;
  merchantId: string;
}

export function ProductActions({
  categories,
  currency,
  merchantId,
}: ProductActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/products",
        method: "POST",
        body: {
          ...form,
          price: parseFloat(form.price),
          costPrice: parseFloat(form.costPrice || "0"),
          stock: parseInt(form.stock),
          lowStockAt: parseInt(form.lowStockAt),
          categoryId: form.categoryId || null,
        },
        entity: "product",
        merchantId,
      });

      if (!result.ok) {
        setError(result.error || "Failed to create product");
        return;
      }

      setOpen(false);
      setForm({
        name: "",
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
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setOpen(true)}>
          <IconPlus size={18} />
          Add Product
        </Button>
        <Button variant="secondary" onClick={() => setScannerOpen(true)}>
          <IconCamera size={18} />
          Scan to Add
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Product"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="name"
              label="Product name"
              placeholder="Enter product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Select
              id="categoryId"
              label="Category"
              value={form.categoryId}
              onChange={(e) => {
                const catId = e.target.value;
                setForm({ ...form, categoryId: catId });
                if (catId) generateSku(catId);
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
                  className="mt-6 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
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
                  className="mt-6 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
              label="Initial stock"
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
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="trackStock" className="text-sm text-gray-700">
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
              Create Product
            </Button>
          </div>
        </form>
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
