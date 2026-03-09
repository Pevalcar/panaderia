import { useEffect, useMemo, useState } from "preact/hooks";
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

type OrderStatus =
  | "pendiente"
  | "en_proceso"
  | "terminado"
  | "en_entrega"
  | "completado"
  | "cancelado";

type Order = {
  id: number;
  customer_name: string;
  customer_phone?: string | null;
  total: number;
  status: OrderStatus;
  delivery_date: string;
  notes?: string | null;
  items?: CartItem[] | null;
  transaction_id?: number | null;
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; badge: string }> = {
  pendiente: { label: "Pendiente", badge: "bg-yellow-500/20 text-yellow-400" },
  en_proceso: { label: "En Proceso", badge: "bg-blue-500/20 text-blue-400" },
  terminado: { label: "Terminado", badge: "bg-purple-500/20 text-purple-400" },
  en_entrega: {
    label: "En Entrega",
    badge: "bg-orange-500/20 text-orange-400",
  },
  completado: { label: "Completado", badge: "bg-green-500/20 text-green-400" },
  cancelado: { label: "Cancelado", badge: "bg-red-500/20 text-red-400" },
};

const STATUS_FLOW: OrderStatus[] = [
  "pendiente",
  "en_proceso",
  "terminado",
  "en_entrega",
  "completado",
  "cancelado",
];

function toDateInput(value?: string | null) {
  if (!value) return new Date().toISOString().split("T")[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    return new Date().toISOString().split("T")[0];
  return parsed.toISOString().split("T")[0];
}

export default function PedidosIsland() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    orderId: number | null;
    current: OrderStatus | null;
  }>({
    isOpen: false,
    orderId: null,
    current: null,
  });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    order: Order | null;
  }>({
    isOpen: false,
    order: null,
  });

  const filteredProducts = useMemo(
    () => products.filter((p) => smartIncludes(searchQuery, p.name)),
    [products, searchQuery],
  );

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(
        "id, customer_name, customer_phone, total, status, delivery_date, notes, items, transaction_id",
      )
      .order("delivery_date", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setOrders((data || []) as Order[]);
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
    fetchOrders();
    fetchProducts();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setSearchQuery("");
    setCart([]);
  };

  const closeFormModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const openForCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openForEdit = (order: Order) => {
    setEditingId(order.id);
    setCustomerName(order.customer_name || "");
    setCustomerPhone(order.customer_phone || "");
    setDeliveryDate(toDateInput(order.delivery_date));
    setNotes(order.notes || "");
    setCart(Array.isArray(order.items) ? order.items : []);
    setSearchQuery("");
    setIsModalOpen(true);
  };

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

  const updateQuantity = (productId: number, quantity: number) => {
    setCart((current) => {
      if (quantity <= 0) {
        return current.filter((item) => item.product_id !== productId);
      }

      return current.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, subtotal: quantity * item.price }
          : item,
      );
    });
  };

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSave = async (event: Event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const username = getCurrentUsername();
    if (!username) {
      setError("Debes iniciar sesión");
      return;
    }

    if (!customerName.trim()) {
      setError("Ingresa el nombre del cliente");
      return;
    }

    if (cart.length === 0) {
      setError("Agrega productos al pedido");
      return;
    }

    setSaving(true);

    const payload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      items: cart,
      total: calculateTotal(),
      delivery_date: deliveryDate,
      notes: notes.trim() || null,
      added_by: username,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("transaction_id, status")
        .eq("id", editingId)
        .single();

      const updateResult = await supabase
        .from("orders")
        .update(payload)
        .eq("id", editingId);

      if (updateResult.error) {
        setSaving(false);
        setError(updateResult.error.message);
        return;
      }

      if (
        currentOrder?.transaction_id &&
        (currentOrder.status === "terminado" ||
          currentOrder.status === "completado")
      ) {
        await supabase
          .from("transactions")
          .update({
            amount: calculateTotal(),
            description: `Pedido de ${customerName.trim()}${customerPhone.trim() ? ` (${customerPhone.trim()})` : ""}`,
            items: cart,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentOrder.transaction_id);
      }

      setMessage("Pedido actualizado");
    } else {
      const createResult = await supabase
        .from("orders")
        .insert({ ...payload, status: "pendiente" });

      if (createResult.error) {
        setSaving(false);
        setError(createResult.error.message);
        return;
      }

      setMessage("Pedido creado");
    }

    setSaving(false);
    closeFormModal();
    fetchOrders();
  };

  const requestDeleteOrder = (order: Order) => {
    setDeleteModal({ isOpen: true, order });
  };

  const closeDeleteModal = () => setDeleteModal({ isOpen: false, order: null });

  const confirmDeleteOrder = async () => {
    if (!deleteModal.order) return;

    setError("");
    setMessage("");

    if (deleteModal.order.transaction_id) {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", deleteModal.order.transaction_id);
    }

    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", deleteModal.order.id);

    if (deleteError) {
      setError(deleteError.message);
      closeDeleteModal();
      return;
    }

    setMessage("Pedido eliminado");
    closeDeleteModal();
    fetchOrders();
  };

  const openStatusModal = (order: Order) => {
    setStatusModal({ isOpen: true, orderId: order.id, current: order.status });
  };

  const closeStatusModal = () => {
    setStatusModal({ isOpen: false, orderId: null, current: null });
  };

  const changeStatus = async (newStatus: OrderStatus) => {
    if (!statusModal.orderId) return;

    const username = getCurrentUsername();
    if (!username) {
      setError("Debes iniciar sesión");
      return;
    }

    const { data: currentOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", statusModal.orderId)
      .single();

    if (fetchError || !currentOrder) {
      setError(fetchError?.message || "No se pudo cargar el pedido");
      closeStatusModal();
      return;
    }

    const wasCompleted =
      currentOrder.status === "terminado" ||
      currentOrder.status === "completado";
    const willBeCompleted =
      newStatus === "terminado" || newStatus === "completado";

    if (wasCompleted && !willBeCompleted && currentOrder.transaction_id) {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", currentOrder.transaction_id);

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", statusModal.orderId);

      if (updateError) {
        setError(updateError.message);
        closeStatusModal();
        return;
      }

      setMessage("Estado cambiado e ingreso eliminado");
    } else if (!wasCompleted && willBeCompleted) {
      const { data: newTransaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          type: "venta",
          sale_type: "productos",
          amount: currentOrder.total,
          description: `Pedido de ${currentOrder.customer_name}${currentOrder.customer_phone ? ` (${currentOrder.customer_phone})` : ""}`,
          items: currentOrder.items,
          added_by: username,
        })
        .select()
        .single();

      if (txError || !newTransaction) {
        setError(txError?.message || "No se pudo crear ingreso");
        closeStatusModal();
        return;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          transaction_id: newTransaction.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", statusModal.orderId);

      if (updateError) {
        setError(updateError.message);
        closeStatusModal();
        return;
      }

      setMessage("Estado cambiado e ingreso registrado");
    } else {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", statusModal.orderId);

      if (updateError) {
        setError(updateError.message);
        closeStatusModal();
        return;
      }

      setMessage(`Estado cambiado a ${STATUS_CONFIG[newStatus].label}`);
    }

    closeStatusModal();
    fetchOrders();
  };

  return (
    <section class="panel-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">Pedidos</h1>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted hover:text-text"
            onClick={() => {
              fetchOrders();
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
            Nuevo
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
        {orders.map((item) => (
          <article
            class="rounded-xl border border-border bg-background p-4"
            key={item.id}
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-semibold text-text">
                  {item.customer_name}
                </h3>
                {item.customer_phone && (
                  <p class="text-xs text-muted">{item.customer_phone}</p>
                )}
              </div>
              <div class="flex items-center gap-2">
                <button
                  class={`rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_CONFIG[item.status]?.badge || "bg-surface text-muted"}`}
                  onClick={() => openStatusModal(item)}
                  type="button"
                >
                  {STATUS_CONFIG[item.status]?.label || item.status}
                </button>
                <button
                  class="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text"
                  onClick={() => openForEdit(item)}
                  type="button"
                >
                  Editar
                </button>
                <button
                  class="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                  onClick={() => requestDeleteOrder(item)}
                  type="button"
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div class="mt-2 space-y-1">
              {item.items?.map((row, index) => (
                <p class="text-xs text-muted" key={`${item.id}-${index}`}>
                  • {row.quantity}x {row.product_name} (
                  {formatCOP(row.subtotal)})
                </p>
              ))}
            </div>

            <p class="mt-2 text-sm font-semibold text-primary">
              Total: {formatCOP(item.total)}
            </p>
            <p class="mt-1 text-xs text-muted">
              Entrega:{" "}
              {new Date(item.delivery_date).toLocaleDateString("es-CO")}
            </p>
            {item.notes && (
              <p class="mt-1 text-xs text-muted">Nota: {item.notes}</p>
            )}
          </article>
        ))}

        {!loading && orders.length === 0 && (
          <p class="text-sm text-muted">No hay pedidos registrados.</p>
        )}
      </div>

      {isModalOpen && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-text">
                {editingId ? "Editar Pedido" : "Nuevo Pedido"}
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
                <label
                  class="mb-1 block text-sm text-muted"
                  for="customer-name"
                >
                  Cliente
                </label>
                <input
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="customer-name"
                  onInput={(event) =>
                    setCustomerName(
                      (event.currentTarget as HTMLInputElement).value,
                    )
                  }
                  required
                  type="text"
                  value={customerName}
                />
              </div>

              <div>
                <label
                  class="mb-1 block text-sm text-muted"
                  for="customer-phone"
                >
                  Teléfono (Opcional)
                </label>
                <input
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="customer-phone"
                  onInput={(event) =>
                    setCustomerPhone(
                      (event.currentTarget as HTMLInputElement).value,
                    )
                  }
                  type="text"
                  value={customerPhone}
                />
              </div>

              <div>
                <label
                  class="mb-1 block text-sm text-muted"
                  for="delivery-date"
                >
                  Fecha de entrega
                </label>
                <input
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="delivery-date"
                  onInput={(event) =>
                    setDeliveryDate(
                      (event.currentTarget as HTMLInputElement).value,
                    )
                  }
                  required
                  type="date"
                  value={deliveryDate}
                />
              </div>

              <div>
                <label class="mb-1 block text-sm text-muted" for="order-search">
                  Buscar producto
                </label>
                <input
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  id="order-search"
                  onInput={(event) =>
                    setSearchQuery(
                      (event.currentTarget as HTMLInputElement).value,
                    )
                  }
                  placeholder="Buscar producto..."
                  type="text"
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
                <p class="mb-2 text-sm text-muted">Productos del pedido</p>
                <div class="space-y-2">
                  {cart.map((item) => (
                    <article
                      class="rounded-xl border border-border bg-background p-3"
                      key={item.product_id}
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p class="text-sm font-semibold text-text">
                            {item.product_name}
                          </p>
                          <p class="text-xs text-muted">
                            {formatCOP(item.price)} c/u
                          </p>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                            onClick={() =>
                              updateQuantity(item.product_id, item.quantity - 1)
                            }
                            type="button"
                          >
                            -
                          </button>
                          <span class="min-w-6 text-center text-sm font-semibold text-text">
                            {item.quantity}
                          </span>
                          <button
                            class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                            onClick={() =>
                              updateQuantity(item.product_id, item.quantity + 1)
                            }
                            type="button"
                          >
                            +
                          </button>
                          <span class="ml-1 text-sm font-semibold text-text">
                            {formatCOP(item.subtotal)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {cart.length === 0 && (
                  <p class="text-sm text-muted">Aún no agregas productos.</p>
                )}
                <div class="mt-2 rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">
                  Total: {formatCOP(calculateTotal())}
                </div>
              </div>

              <div>
                <label class="mb-1 block text-sm text-muted" for="order-notes">
                  Notas (Opcional)
                </label>
                <textarea
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
                  id="order-notes"
                  onInput={(event) =>
                    setNotes((event.currentTarget as HTMLTextAreaElement).value)
                  }
                  rows={3}
                  value={notes}
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
                    : editingId
                      ? "Actualizar"
                      : "Guardar pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statusModal.isOpen && statusModal.current && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-lg font-semibold text-text">Cambiar Estado</h3>
              <button
                class="text-muted hover:text-text"
                onClick={closeStatusModal}
                type="button"
              >
                ✕
              </button>
            </div>
            <div class="space-y-2">
              {STATUS_FLOW.map((status) => (
                <button
                  class={`w-full rounded-xl border px-3 py-2 text-left text-sm ${status === statusModal.current ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-text"}`}
                  onClick={() => changeStatus(status)}
                  type="button"
                >
                  {STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteModal.isOpen && deleteModal.order && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <h3 class="text-lg font-semibold text-text">Eliminar pedido</h3>
            <p class="mt-2 text-sm text-muted">
              ¿Seguro que deseas eliminar el pedido de{" "}
              {deleteModal.order.customer_name}?
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
                onClick={confirmDeleteOrder}
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
