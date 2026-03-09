import { useEffect, useState } from "preact/hooks";
import { formatCOP } from "../../lib/currency";
import { smartIncludes } from "../../lib/search";
import { getCurrentUsername, supabase } from "../../lib/supabase";

type Product = {
  id: number;
  name: string;
  price: number;
};

type CartItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
};

type Transaction = {
  id: number;
  type: "venta" | "compra";
  sale_type?: "productos" | "otros" | null;
  amount: number;
  description?: string | null;
  items?: CartItem[] | null;
  image_url?: string | null;
  added_by?: string | null;
  created_at: string;
};

function toInputDateString(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CO");
}

export default function CuentasIsland() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [type, setType] = useState<"venta" | "compra">("venta");
  const [saleType, setSaleType] = useState<"productos" | "otros">("productos");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    action: "delete" | "update" | null;
    title: string;
    message: string;
    itemId: number | null;
  }>({
    isOpen: false,
    action: null,
    title: "",
    message: "",
    itemId: null,
  });

  const clearForm = () => {
    setEditingId(null);
    setType("venta");
    setSaleType("productos");
    setAmount("");
    setDescription("");
    setSearchQuery("");
    setCart([]);
    setPickedFile(null);
    setExistingImageUrl(null);
  };

  const closeModal = () => {
    clearForm();
    setIsModalOpen(false);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("transactions")
      .select(
        "id, type, sale_type, amount, description, items, image_url, added_by, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setTransactions((data || []) as Transaction[]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error: fetchError } = await supabase
      .from("products")
      .select("id, name, price")
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setProducts((data || []) as Product[]);
  };

  useEffect(() => {
    fetchTransactions();
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) =>
    smartIncludes(searchQuery, product.name),
  );

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (!existing) {
        return [
          ...current,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            price: Number(product.price || 0),
            subtotal: Number(product.price || 0),
          },
        ];
      }

      return current.map((item) =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              subtotal: (item.quantity + 1) * item.price,
            }
          : item,
      );
    });
  };

  const updateQuantity = (productId: number, nextQuantity: number) => {
    setCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((item) => item.product_id !== productId);
      }

      return current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: nextQuantity,
              subtotal: nextQuantity * item.price,
            }
          : item,
      );
    });
  };

  const uploadImage = async () => {
    if (!pickedFile) {
      return existingImageUrl;
    }

    const extension = pickedFile.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, pickedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: pickedFile.type || undefined,
      });

    if (uploadError) {
      setError(uploadError.message);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(fileName);

    return publicUrl;
  };

  const openForCreate = () => {
    clearForm();
    setIsModalOpen(true);
  };

  const openForEdit = (item: Transaction) => {
    clearForm();
    setEditingId(item.id);
    setType(item.type);
    setSaleType(
      item.type === "venta" && item.sale_type === "productos"
        ? "productos"
        : "otros",
    );
    setAmount(String(item.amount || ""));
    setDescription(item.description || "");
    setExistingImageUrl(item.image_url || null);
    setCart(
      item.type === "venta" && Array.isArray(item.items) ? item.items : [],
    );
    setIsModalOpen(true);
  };

  const handleDelete = async (item: Transaction) => {
    setConfirmState({
      isOpen: true,
      action: "delete",
      title: "Eliminar movimiento",
      message: `¿Seguro que deseas eliminar este ${item.type === "venta" ? "movimiento de venta" : "gasto/compra"}?`,
      itemId: item.id,
    });
  };

  const executeDelete = async (id: number) => {
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Movimiento eliminado");
    fetchTransactions();
  };

  const executeSave = async () => {
    setSaving(true);
    const imageUrl = await uploadImage();

    if (pickedFile && !imageUrl) {
      setSaving(false);
      return;
    }

    const finalAmount =
      type === "venta" && saleType === "productos"
        ? calculateTotal()
        : Number.parseFloat(amount || "0");

    const payload = {
      type,
      sale_type: type === "venta" ? saleType : null,
      amount: finalAmount,
      description,
      image_url: imageUrl,
      added_by: getCurrentUsername(),
      items: type === "venta" && saleType === "productos" ? cart : null,
    };

    const result = editingId
      ? await supabase.from("transactions").update(payload).eq("id", editingId)
      : await supabase.from("transactions").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage(editingId ? "Movimiento actualizado" : "Movimiento guardado");
    closeModal();
    fetchTransactions();
  };

  const closeConfirmModal = () => {
    setConfirmState({
      isOpen: false,
      action: null,
      title: "",
      message: "",
      itemId: null,
    });
  };

  const handleConfirmAction = async () => {
    const action = confirmState.action;
    const itemId = confirmState.itemId;
    closeConfirmModal();

    if (action === "delete" && itemId) {
      await executeDelete(itemId);
      return;
    }

    if (action === "update") {
      await executeSave();
    }
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const username = getCurrentUsername();
    if (!username) {
      setError("Debes iniciar sesión");
      return;
    }

    if (type === "venta" && saleType === "productos" && cart.length === 0) {
      setError("Agrega productos a la venta");
      return;
    }

    if (type === "venta" && saleType === "otros") {
      if (!description.trim()) {
        setError("Describe qué se vendió");
        return;
      }

      if (!amount) {
        setError("Ingresa el monto");
        return;
      }
    }

    if (type === "compra" && !amount) {
      setError("Ingresa el monto");
      return;
    }

    if (editingId) {
      setConfirmState({
        isOpen: true,
        action: "update",
        title: "Confirmar cambios",
        message: "¿Confirmas guardar los cambios de este movimiento?",
        itemId: editingId,
      });
      return;
    }

    await executeSave();
  };

  return (
    <section class="panel-card">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">Cuentas</h1>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted hover:text-text"
            onClick={() => {
              fetchTransactions();
              fetchProducts();
            }}
            type="button"
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <button
            class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
            onClick={openForCreate}
            type="button"
          >
            Agregar
          </button>
        </div>
      </div>

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
        {transactions.map((item) => (
          <article
            class="rounded-xl border border-border bg-background p-4"
            key={item.id}
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p
                  class={`text-lg font-bold ${item.type === "venta" ? "text-green-400" : "text-pink-400"}`}
                >
                  {item.type === "venta" ? "+" : "-"} {formatCOP(item.amount)}
                </p>
                {item.sale_type === "productos" &&
                  item.items?.map((row, index) => (
                    <p class="text-xs text-muted" key={`${item.id}-${index}`}>
                      • {row.quantity}x {row.product_name} (
                      {formatCOP(row.subtotal)})
                    </p>
                  ))}
                {item.description && (
                  <p class="mt-1 text-sm text-muted">{item.description}</p>
                )}
                <p class="mt-1 text-xs text-muted">
                  {toInputDateString(item.created_at)} - {item.added_by || ""}
                </p>
              </div>

              <div class="flex items-center gap-2">
                {item.image_url && (
                  <a
                    class="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text"
                    href={item.image_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Foto
                  </a>
                )}
                <>
                  <button
                    class="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text"
                    onClick={() => openForEdit(item)}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    class="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                    onClick={() => handleDelete(item)}
                    type="button"
                  >
                    Eliminar
                  </button>
                </>
              </div>
            </div>
          </article>
        ))}

        {!loading && transactions.length === 0 && (
          <p class="text-sm text-muted">No hay movimientos recientes.</p>
        )}
      </div>

      {isModalOpen && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-text">
                {editingId ? "Editar Movimiento" : "Nueva Transacción"}
              </h2>
              <button
                class="text-muted hover:text-text"
                onClick={closeModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <form class="space-y-4" onSubmit={handleSubmit}>
              <div>
                <p class="mb-2 text-sm text-muted">Tipo de transacción</p>
                <div class="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1">
                  <button
                    class={`rounded-lg px-3 py-2 text-sm ${type === "venta" ? "bg-green-600 text-white" : "text-muted"}`}
                    onClick={() => setType("venta")}
                    type="button"
                  >
                    Venta
                  </button>
                  <button
                    class={`rounded-lg px-3 py-2 text-sm ${type === "compra" ? "bg-pink-600 text-white" : "text-muted"}`}
                    onClick={() => setType("compra")}
                    type="button"
                  >
                    Gasto / Compra
                  </button>
                </div>
              </div>

              {type === "venta" && (
                <div>
                  <p class="mb-2 text-sm text-muted">Tipo de venta</p>
                  <div class="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1">
                    <button
                      class={`rounded-lg px-3 py-2 text-sm ${saleType === "productos" ? "bg-primary text-white" : "text-muted"}`}
                      onClick={() => setSaleType("productos")}
                      type="button"
                    >
                      Productos
                    </button>
                    <button
                      class={`rounded-lg px-3 py-2 text-sm ${saleType === "otros" ? "bg-primary text-white" : "text-muted"}`}
                      onClick={() => setSaleType("otros")}
                      type="button"
                    >
                      Otros
                    </button>
                  </div>
                </div>
              )}

              {type === "venta" && saleType === "productos" && (
                <>
                  <div>
                    <label
                      class="mb-1 block text-sm text-muted"
                      for="product-search"
                    >
                      Buscar producto
                    </label>
                    <input
                      class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
                      id="product-search"
                      onInput={(event) => {
                        const target = event.target as HTMLInputElement;
                        setSearchQuery(target.value);
                      }}
                      placeholder="Buscar producto..."
                      value={searchQuery}
                    />
                    {searchQuery.trim().length > 0 && (
                      <div class="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-background">
                        {filteredProducts.map((product) => (
                          <button
                            class="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm text-text last:border-none"
                            key={product.id}
                            onClick={() => {
                              addToCart(product);
                              setSearchQuery("");
                            }}
                            type="button"
                          >
                            <span>{product.name}</span>
                            <span class="text-xs text-muted">
                              {formatCOP(product.price)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p class="mb-2 text-sm text-muted">
                      Productos seleccionados
                    </p>
                    <div class="space-y-2">
                      {cart.map((cartItem) => (
                        <article
                          class="rounded-xl border border-border bg-background p-3"
                          key={cartItem.product_id}
                        >
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p class="text-sm font-semibold text-text">
                                {cartItem.product_name}
                              </p>
                              <p class="text-xs text-muted">
                                {formatCOP(cartItem.price)} c/u
                              </p>
                            </div>
                            <div class="flex items-center gap-2">
                              <button
                                class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                                onClick={() =>
                                  updateQuantity(
                                    cartItem.product_id,
                                    cartItem.quantity - 1,
                                  )
                                }
                                type="button"
                              >
                                -
                              </button>
                              <span class="min-w-6 text-center text-sm font-semibold text-text">
                                {cartItem.quantity}
                              </span>
                              <button
                                class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                                onClick={() =>
                                  updateQuantity(
                                    cartItem.product_id,
                                    cartItem.quantity + 1,
                                  )
                                }
                                type="button"
                              >
                                +
                              </button>
                              <span class="ml-1 text-sm font-semibold text-text">
                                {formatCOP(cartItem.subtotal)}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    {cart.length === 0 && (
                      <p class="text-sm text-muted">
                        Aún no agregas productos.
                      </p>
                    )}
                    <div class="mt-3 rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">
                      Total: {formatCOP(calculateTotal())}
                    </div>
                  </div>

                  <div>
                    <label
                      class="mb-1 block text-sm text-muted"
                      for="products-note"
                    >
                      Nota (Opcional)
                    </label>
                    <input
                      class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
                      id="products-note"
                      onInput={(event) => {
                        const target = event.target as HTMLInputElement;
                        setDescription(target.value);
                      }}
                      value={description}
                    />
                  </div>
                </>
              )}

              {(type === "compra" ||
                (type === "venta" && saleType === "otros")) && (
                <>
                  <div>
                    <label
                      class="mb-1 block text-sm text-muted"
                      for="tx-amount"
                    >
                      Monto
                    </label>
                    <input
                      class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
                      id="tx-amount"
                      min="0"
                      onInput={(event) => {
                        const target = event.target as HTMLInputElement;
                        setAmount(target.value);
                      }}
                      step="0.01"
                      type="number"
                      value={amount}
                    />
                  </div>
                  <div>
                    <label
                      class="mb-1 block text-sm text-muted"
                      for="tx-description"
                    >
                      Descripción
                    </label>
                    <input
                      class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
                      id="tx-description"
                      onInput={(event) => {
                        const target = event.target as HTMLInputElement;
                        setDescription(target.value);
                      }}
                      value={description}
                    />
                  </div>
                </>
              )}

              <div>
                <label class="mb-1 block text-sm text-muted" for="tx-image">
                  Foto (Recibo/Factura)
                </label>
                <input
                  accept="image/*"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text"
                  id="tx-image"
                  onChange={(event) => {
                    const target = event.target as HTMLInputElement;
                    setPickedFile(target.files?.[0] || null);
                  }}
                  type="file"
                />
                {existingImageUrl && !pickedFile && (
                  <p class="mt-2 text-xs text-muted">
                    Esta venta ya tiene imagen guardada.
                  </p>
                )}
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
                  onClick={closeModal}
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
                    : editingId
                      ? "Actualizar"
                      : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <h3 class="text-lg font-semibold text-text">
              {confirmState.title}
            </h3>
            <p class="mt-2 text-sm text-muted">{confirmState.message}</p>
            <div class="mt-5 flex justify-end gap-2">
              <button
                class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
                onClick={closeConfirmModal}
                type="button"
              >
                Cancelar
              </button>
              <button
                class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={handleConfirmAction}
                type="button"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
