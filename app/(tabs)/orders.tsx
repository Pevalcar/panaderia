import {
  Calendar,
  Edit2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import SkeletonLoader from "../../components/SkeletonLoader";
import { useAuth } from "../../context/AuthContext";
import { formatCOP } from "../../lib/currency";
import { smartIncludes } from "../../lib/search";
import { supabase } from "../../lib/supabase";

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

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    textColor: string;
  }
> = {
  pendiente: {
    label: "Pendiente",
    color: "#EAB308",
    bgColor: "bg-yellow-500/20",
    textColor: "text-yellow-500",
  },
  en_proceso: {
    label: "En Proceso",
    color: "#3B82F6",
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-500",
  },
  terminado: {
    label: "Terminado",
    color: "#8B5CF6",
    bgColor: "bg-purple-500/20",
    textColor: "text-purple-500",
  },
  en_entrega: {
    label: "En Entrega",
    color: "#F59E0B",
    bgColor: "bg-orange-500/20",
    textColor: "text-orange-500",
  },
  completado: {
    label: "Completado",
    color: "#22C55E",
    bgColor: "bg-green-500/20",
    textColor: "text-green-500",
  },
  cancelado: {
    label: "Cancelado",
    color: "#EF4444",
    bgColor: "bg-red-500/20",
    textColor: "text-red-500",
  },
};

const STATUS_FLOW = [
  "pendiente",
  "en_proceso",
  "terminado",
  "en_entrega",
  "completado",
];

export default function OrdersScreen() {
  const { username } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedOrderToDelete, setSelectedOrderToDelete] = useState<any>(null);

  // Order state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date());

  // Product selection
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("delivery_date", { ascending: true });

    if (error) console.error(error);
    else setOrders(data || []);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price")
      .order("name", { ascending: true });

    if (error) console.error(error);
    else setProducts(data || []);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      updateQuantity(product.id, existing.quantity + 1);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          price: product.price,
          subtotal: product.price,
        },
      ]);
    }
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter((item) => item.product_id !== productId));
    } else {
      setCart(
        cart.map((item) =>
          item.product_id === productId
            ? {
                ...item,
                quantity: newQuantity,
                subtotal: item.price * newQuantity,
              }
            : item,
        ),
      );
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      Toast.show({ type: "error", text1: "Ingresa el nombre del cliente" });
      return;
    }

    if (cart.length === 0) {
      Toast.show({ type: "error", text1: "Agrega productos al pedido" });
      return;
    }

    const orderData = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      items: cart,
      total: calculateTotal(),
      delivery_date: deliveryDate.toISOString().split("T")[0],
      notes: notes.trim() || null,
      added_by: username,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      // Obtener el pedido actual para ver si tiene transacción asociada
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("transaction_id, status")
        .eq("id", editingId)
        .single();

      const { error } = await supabase
        .from("orders")
        .update(orderData)
        .eq("id", editingId);

      if (error) {
        Toast.show({
          type: "error",
          text1: "Error al actualizar",
          text2: error.message,
        });
        return;
      }

      // Si el pedido está terminado/completado y tiene transacción, actualizar la transacción también
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

      Toast.show({ type: "success", text1: "Pedido actualizado" });
      resetForm();
      fetchOrders();
    } else {
      const { error } = await supabase
        .from("orders")
        .insert({ ...orderData, status: "pendiente" });

      if (error) {
        Toast.show({
          type: "error",
          text1: "Error al crear",
          text2: error.message,
        });
      } else {
        Toast.show({ type: "success", text1: "Pedido creado" });
        resetForm();
        fetchOrders();
      }
    }
  };

  const handleEdit = (order: any) => {
    setEditingId(order.id);
    setCustomerName(order.customer_name);
    setCustomerPhone(order.customer_phone || "");
    setNotes(order.notes || "");
    setDeliveryDate(new Date(order.delivery_date));
    setCart(order.items || []);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    // Primero obtener el pedido para ver si tiene transacción asociada
    const { data: order } = await supabase
      .from("orders")
      .select("transaction_id")
      .eq("id", id)
      .single();

    // Si tiene transacción asociada, eliminarla primero
    if (order?.transaction_id) {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", order.transaction_id);
    }

    // Eliminar el pedido
    const { error } = await supabase.from("orders").delete().eq("id", id);

    if (error) {
      Toast.show({ type: "error", text1: "Error al eliminar" });
    } else {
      Toast.show({ type: "success", text1: "Pedido eliminado" });
      fetchOrders();
    }
  };

  const requestDeleteOrder = (order: any) => {
    setSelectedOrderToDelete(order);
    setDeleteModalOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!selectedOrderToDelete?.id) return;

    await handleDelete(selectedOrderToDelete.id);
    setDeleteModalOpen(false);
    setSelectedOrderToDelete(null);
  };

  const openStatusModal = (id: number, currentStatus: string) => {
    setSelectedOrderId(id);
    setSelectedStatus(currentStatus);
    setStatusModalOpen(true);
  };

  const changeStatus = async (newStatus: string) => {
    if (!selectedOrderId) return;

    // Obtener el pedido actual
    const { data: currentOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", selectedOrderId)
      .single();

    if (fetchError || !currentOrder) {
      Toast.show({ type: "error", text1: "Error al obtener pedido" });
      return;
    }

    const oldStatus = currentOrder.status;
    const wasCompleted =
      oldStatus === "terminado" || oldStatus === "completado";
    const willBeCompleted =
      newStatus === "terminado" || newStatus === "completado";

    // Si cambia de completado a no completado, eliminar transacción
    if (wasCompleted && !willBeCompleted && currentOrder.transaction_id) {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", currentOrder.transaction_id);

      if (deleteError) {
        Toast.show({ type: "error", text1: "Error al eliminar ingreso" });
        return;
      }

      // Actualizar pedido sin transacción
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedOrderId);

      if (updateError) {
        Toast.show({ type: "error", text1: "Error al cambiar estado" });
        return;
      }

      Toast.show({
        type: "success",
        text1: `Estado cambiado e ingreso eliminado`,
      });
    }
    // Si cambia de no completado a completado, crear transacción
    else if (!wasCompleted && willBeCompleted) {
      // Crear transacción de ingreso
      const { data: newTransaction, error: transactionError } = await supabase
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

      if (transactionError || !newTransaction) {
        Toast.show({ type: "error", text1: "Error al crear ingreso" });
        return;
      }

      // Actualizar pedido con ID de transacción
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          transaction_id: newTransaction.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedOrderId);

      if (updateError) {
        Toast.show({ type: "error", text1: "Error al cambiar estado" });
        return;
      }

      Toast.show({
        type: "success",
        text1: `Estado cambiado e ingreso registrado`,
      });
    }
    // Si no hay cambio en completado, solo actualizar estado
    else {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedOrderId);

      if (error) {
        Toast.show({ type: "error", text1: "Error al cambiar estado" });
        return;
      }

      Toast.show({
        type: "success",
        text1: `Estado cambiado a ${STATUS_CONFIG[newStatus].label}`,
      });
    }

    setStatusModalOpen(false);
    fetchOrders();
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setDeliveryDate(new Date());
    setCart([]);
    setSearchQuery("");
  };

  const getDeliveryDateColor = (deliveryDate: string, status: string) => {
    if (status === "completado" || status === "cancelado") return "text-muted";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(
      (delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) return "text-red-500"; // Vencido
    if (diffDays === 0) return "text-orange-500"; // Hoy
    if (diffDays === 1) return "text-yellow-500"; // Mañana
    if (diffDays <= 3) return "text-blue-500"; // Próximos 3 días
    return "text-green-500"; // Más de 3 días
  };

  const getDeliveryDateBg = (deliveryDate: string, status: string) => {
    if (status === "completado" || status === "cancelado") return "bg-surface";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(
      (delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) return "bg-red-500/20"; // Vencido
    if (diffDays === 0) return "bg-orange-500/20"; // Hoy
    if (diffDays === 1) return "bg-yellow-500/20"; // Mañana
    if (diffDays <= 3) return "bg-blue-500/20"; // Próximos 3 días
    return "bg-green-500/20"; // Más de 3 días
  };

  const filteredProducts = products.filter((product) =>
    smartIncludes(searchQuery, product.name),
  );

  const renderItem = ({ item }: { item: any }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendiente;
    const canAdvance =
      STATUS_FLOW.indexOf(item.status) < STATUS_FLOW.length - 1;

    return (
      <View className="bg-surface p-4 rounded-xl border border-border mb-3">
        {/* Header */}
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-text font-bold text-lg">
              {item.customer_name}
            </Text>
            {item.customer_phone && (
              <Text className="text-muted text-sm">{item.customer_phone}</Text>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            {item.status !== "completado" && item.status !== "cancelado" && (
              <TouchableOpacity
                onPress={() => handleEdit(item)}
                className="p-2"
              >
                <Edit2 size={18} color="#6366F1" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => requestDeleteOrder(item)}
              className="p-2"
            >
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <View className="mb-2">
          {item.items?.map((cartItem: CartItem, idx: number) => (
            <Text key={idx} className="text-muted text-sm">
              • {cartItem.quantity}x {cartItem.product_name} (
              {formatCOP(cartItem.subtotal)})
            </Text>
          ))}
        </View>

        {/* Total */}
        <Text className="text-primary font-bold text-lg mb-2">
          Total: {formatCOP(item.total)}
        </Text>

        {/* Notes */}
        {item.notes && (
          <Text className="text-muted text-sm italic mb-2">
            Nota: {item.notes}
          </Text>
        )}

        {/* Footer */}
        <View className="flex-row justify-between items-center pt-2 border-t border-border">
          {/* Delivery Date */}
          <View
            className={`px-3 py-1 rounded-lg ${getDeliveryDateBg(item.delivery_date, item.status)}`}
          >
            <Text
              className={`text-xs font-medium ${getDeliveryDateColor(item.delivery_date, item.status)}`}
            >
              📅 {new Date(item.delivery_date).toLocaleDateString()}
            </Text>
          </View>

          {/* Status - Siempre editable */}
          <TouchableOpacity
            onPress={() => openStatusModal(item.id, item.status)}
            className={`px-3 py-2 rounded-lg ${statusConfig.bgColor}`}
          >
            <Text className={`text-xs font-bold ${statusConfig.textColor}`}>
              {statusConfig.label} ✏️
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          className="bg-surface p-4 rounded-xl border border-border mb-3"
        >
          <SkeletonLoader width={150} height={20} />
          <View className="mt-2" />
          <SkeletonLoader width="100%" height={14} />
        </View>
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="p-4 pt-12 flex-row justify-between items-center border-b border-border bg-surface">
        <Text className="text-2xl font-bold text-text">Pedidos</Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={async () => {
              await Promise.all([fetchOrders(), fetchProducts()]);
              Toast.show({ type: "success", text1: "Pedidos actualizados" });
            }}
            className="bg-surface p-2 rounded-full border border-border"
          >
            <RefreshCw color="#94A3B8" size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-primary p-2 rounded-full"
          >
            <Plus color="white" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchOrders}
            tintColor="#6366F1"
          />
        }
        ListEmptyComponent={
          loading ? (
            renderSkeleton()
          ) : (
            <Text className="text-muted text-center mt-8">
              No hay pedidos registrados.
            </Text>
          )
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={resetForm}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-3xl p-6 h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text">
                {editingId ? "Editar Pedido" : "Nuevo Pedido"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X color="#94A3B8" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Cliente */}
              <Text className="text-text mb-2">Nombre del Cliente</Text>
              <TextInput
                className="bg-background text-text text-base p-4 rounded-xl border border-border mb-4"
                placeholder="Nombre completo"
                placeholderTextColor="#475569"
                value={customerName}
                onChangeText={setCustomerName}
              />

              <Text className="text-text mb-2">Teléfono (Opcional)</Text>
              <TextInput
                className="bg-background text-text text-base p-4 rounded-xl border border-border mb-4"
                placeholder="Número de contacto"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                value={customerPhone}
                onChangeText={setCustomerPhone}
              />

              {/* Fecha de Entrega */}
              <Text className="text-text mb-2">Fecha de Entrega</Text>
              <View className="bg-background p-4 rounded-xl border border-border mb-4 flex-row items-center">
                <Calendar size={20} color="#94A3B8" />
                <TextInput
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#475569"
                  className="ml-3 flex-1 text-text text-base"
                  value={deliveryDate.toLocaleDateString("es-ES")}
                  onChangeText={(text) => {
                    // Parse formato DD/MM/YYYY
                    const parts = text.split("/");
                    if (parts.length === 3) {
                      const day = parseInt(parts[0]);
                      const month = parseInt(parts[1]) - 1;
                      const year = parseInt(parts[2]);
                      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                        const newDate = new Date(year, month, day);
                        if (!isNaN(newDate.getTime())) {
                          setDeliveryDate(newDate);
                        }
                      }
                    }
                  }}
                />
              </View>

              {/* Productos */}
              <Text className="text-text mb-2 font-bold">Productos</Text>
              <View className="bg-background p-3 rounded-xl border border-border flex-row items-center mb-4">
                <Search size={20} color="#94A3B8" />
                <TextInput
                  placeholder="Buscar producto..."
                  placeholderTextColor="#475569"
                  className="ml-3 flex-1 text-text text-base"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Lista de productos disponibles */}
              {searchQuery.length > 0 && (
                <View className="mb-4 max-h-40 bg-background border border-border rounded-xl">
                  <ScrollView>
                    {filteredProducts.map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        onPress={() => {
                          addToCart(product);
                          setSearchQuery("");
                        }}
                        className="p-3 border-b border-border"
                      >
                        <Text className="text-text font-medium">
                          {product.name}
                        </Text>
                        <Text className="text-muted text-sm">
                          {formatCOP(product.price)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Carrito */}
              {cart.length > 0 && (
                <View className="mb-4">
                  <Text className="text-text font-bold mb-2">
                    Productos en el pedido:
                  </Text>
                  {cart.map((item) => (
                    <View
                      key={item.product_id}
                      className="bg-background p-3 rounded-xl border border-border mb-2"
                    >
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1">
                          <Text className="text-text font-medium">
                            {item.product_name}
                          </Text>
                          <Text className="text-muted text-sm">
                            {formatCOP(item.price)} c/u
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            onPress={() =>
                              updateQuantity(item.product_id, item.quantity - 1)
                            }
                            className="bg-surface p-2 rounded-lg border border-border"
                          >
                            <Minus size={16} color="#F87171" />
                          </TouchableOpacity>

                          <Text className="text-text font-bold min-w-[30px] text-center">
                            {item.quantity}
                          </Text>

                          <TouchableOpacity
                            onPress={() =>
                              updateQuantity(item.product_id, item.quantity + 1)
                            }
                            className="bg-surface p-2 rounded-lg border border-border"
                          >
                            <Plus size={16} color="#34D399" />
                          </TouchableOpacity>

                          <Text className="text-text font-bold ml-2 min-w-[60px] text-right">
                            {formatCOP(item.subtotal)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  <View className="bg-primary/10 p-3 rounded-xl mt-2">
                    <Text className="text-text text-xl font-bold text-center">
                      Total: {formatCOP(calculateTotal())}
                    </Text>
                  </View>
                </View>
              )}

              {/* Notas */}
              <Text className="text-text mb-2">Notas (Opcional)</Text>
              <TextInput
                className="bg-background text-text text-base p-4 rounded-xl border border-border mb-6"
                placeholder="Detalles adicionales del pedido..."
                placeholderTextColor="#475569"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                onPress={handleSave}
                className="bg-primary p-4 rounded-xl items-center mb-8"
              >
                <Text className="text-white text-lg font-bold">
                  {editingId ? "Actualizar" : "Guardar"} Pedido
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Cambio de Estado */}
      <Modal
        visible={deleteModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setDeleteModalOpen(false);
          setSelectedOrderToDelete(null);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-surface w-full max-w-md rounded-xl p-6 border border-border">
            <Text className="text-text text-xl font-bold mb-3">
              Confirmar eliminación
            </Text>
            <Text className="text-muted mb-6">
              {`¿Seguro que deseas eliminar el pedido de ${selectedOrderToDelete?.customer_name ?? "este cliente"}?`}
            </Text>

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalOpen(false);
                  setSelectedOrderToDelete(null);
                }}
                className="px-4 py-2 rounded-lg border border-border bg-background"
              >
                <Text className="text-text font-semibold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteOrder}
                className="px-4 py-2 rounded-lg bg-red-600"
              >
                <Text className="text-white font-semibold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={statusModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStatusModalOpen(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-surface w-11/12 rounded-xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-text text-xl font-bold">
                Cambiar Estado
              </Text>
              <TouchableOpacity onPress={() => setStatusModalOpen(false)}>
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View className="space-y-3">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => changeStatus(key)}
                  className={`p-4 rounded-xl border-2 ${
                    selectedStatus === key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View
                        className={`w-3 h-3 rounded-full mr-3 ${config.bgColor}`}
                        style={{ backgroundColor: config.color }}
                      />
                      <Text
                        className={`text-base font-semibold ${
                          selectedStatus === key ? "text-primary" : "text-text"
                        }`}
                      >
                        {config.label}
                      </Text>
                    </View>
                    {selectedStatus === key && (
                      <Text className="text-primary">✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
