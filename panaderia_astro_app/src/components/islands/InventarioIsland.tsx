import { useEffect, useMemo, useState } from "preact/hooks";
import { formatCOP } from "../../lib/currency";
import { smartIncludes } from "../../lib/search";
import { getCurrentUsername, supabase } from "../../lib/supabase";

type Product = {
  id: number;
  name: string;
  price: number;
  description: string | null;
};

export default function InventarioIsland() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: number | null;
    name: string;
  }>({
    isOpen: false,
    id: null,
    name: "",
  });

  const filtered = useMemo(
    () =>
      products.filter((item) =>
        smartIncludes(search, item.name, item.description),
      ),
    [products, search],
  );

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("products")
      .select("id, name, price, description")
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setProducts((data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setEditingProductId(null);
    setName("");
    setPrice("");
    setDescription("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProductId(product.id);
    setName(product.name || "");
    setPrice(String(product.price || ""));
    setDescription(product.description || "");
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    resetForm();
    setIsFormModalOpen(false);
  };

  const handleSave = async (event: Event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim() || !price.trim()) {
      setError("Ingresa nombre y precio del producto");
      return;
    }

    const parsedPrice = Number.parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Ingresa un precio válido mayor a 0");
      return;
    }

    const username = getCurrentUsername();
    if (!username) {
      setError("Debes iniciar sesión");
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      price: parsedPrice,
      description: description.trim(),
      added_by: username,
    };

    const result = editingProductId
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProductId)
      : await supabase.from("products").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage(editingProductId ? "Producto actualizado" : "Producto agregado");
    closeFormModal();
    fetchProducts();
  };

  const requestDelete = (product: Product) => {
    setConfirmDelete({
      isOpen: true,
      id: product.id,
      name: product.name,
    });
  };

  const closeDeleteModal = () => {
    setConfirmDelete({
      isOpen: false,
      id: null,
      name: "",
    });
  };

  const confirmDeleteProduct = async () => {
    if (!confirmDelete.id) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", confirmDelete.id);

    if (deleteError) {
      setError(deleteError.message);
      closeDeleteModal();
      return;
    }

    setMessage("Producto eliminado");
    closeDeleteModal();
    fetchProducts();
  };

  return (
    <section class="panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">Productos</h1>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted hover:text-text"
            onClick={fetchProducts}
            type="button"
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <button
            class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
            onClick={openCreateModal}
            type="button"
          >
            Agregar
          </button>
        </div>
      </div>

      <input
        class="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
        onInput={(event) =>
          setSearch((event.currentTarget as HTMLInputElement).value)
        }
        placeholder="Buscar producto..."
        type="text"
        value={search}
      />

      {!!error && (
        <p class="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!!message && (
        <p class="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <div class="mt-4 space-y-3">
        {filtered.map((item) => (
          <article
            class="rounded-xl border border-border bg-background p-4"
            key={item.id}
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-semibold text-text">{item.name}</h3>
                <p class="mt-1 text-sm text-muted">
                  {item.description || "Sin descripción"}
                </p>
              </div>
              <span class="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white">
                {formatCOP(item.price)}
              </span>
            </div>
            <div class="mt-4 flex justify-end gap-2">
              <button
                class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                onClick={() => openEditModal(item)}
                type="button"
              >
                Editar
              </button>
              <button
                class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => requestDelete(item)}
                type="button"
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}

        {!loading && filtered.length === 0 && (
          <p class="text-sm text-muted">No hay productos para mostrar.</p>
        )}
      </div>

      {isFormModalOpen && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-lg rounded-2xl border border-border bg-surface p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-text">
                {editingProductId ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button
                class="text-muted hover:text-text"
                onClick={closeFormModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <form class="space-y-3" onSubmit={handleSave}>
              <div>
                <label class="mb-1 block text-sm text-muted" for="product-name">
                  Nombre
                </label>
                <input
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="product-name"
                  onInput={(event) =>
                    setName((event.currentTarget as HTMLInputElement).value)
                  }
                  required
                  type="text"
                  value={name}
                />
              </div>

              <div>
                <label
                  class="mb-1 block text-sm text-muted"
                  for="product-price"
                >
                  Precio
                </label>
                <input
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="product-price"
                  min="0"
                  onInput={(event) =>
                    setPrice((event.currentTarget as HTMLInputElement).value)
                  }
                  required
                  step="0.01"
                  type="number"
                  value={price}
                />
              </div>

              <div>
                <label
                  class="mb-1 block text-sm text-muted"
                  for="product-description"
                >
                  Descripción (Opcional)
                </label>
                <textarea
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="product-description"
                  onInput={(event) =>
                    setDescription(
                      (event.currentTarget as HTMLTextAreaElement).value,
                    )
                  }
                  rows={3}
                  value={description}
                />
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
                  onClick={closeFormModal}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? "Guardando..."
                    : editingProductId
                      ? "Guardar cambios"
                      : "Agregar producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete.isOpen && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <h3 class="text-lg font-semibold text-text">Eliminar producto</h3>
            <p class="mt-2 text-sm text-muted">
              ¿Seguro que deseas eliminar "{confirmDelete.name}"?
            </p>
            <div class="mt-5 flex justify-end gap-2">
              <button
                class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
                onClick={closeDeleteModal}
                type="button"
              >
                Cancelar
              </button>
              <button
                class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                onClick={confirmDeleteProduct}
                type="button"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
