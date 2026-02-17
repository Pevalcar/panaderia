import { FileText, Plus } from "lucide-react-native";
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
import { supabase } from "../../lib/supabase";
import type { Customer, Invoice } from "../../types";

export default function InvoicesScreen() {
  const { username } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pagada" | "pendiente">("all");

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [items, setItems] = useState<
    { description: string; quantity: string; price: string }[]
  >([{ description: "", quantity: "1", price: "" }]);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, [filter]);

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*, customer:customers(name)")
      .order("invoice_number", { ascending: false });

    if (filter !== "all") query = query.eq("status", filter);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      Toast.show({ type: "error", text1: "Error al cargar facturas" });
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setCustomers(data || []);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: "1", price: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const createInvoice = async () => {
    if (!selectedCustomer) {
      Toast.show({ type: "error", text1: "Selecciona un cliente" });
      return;
    }

    const validItems = items.filter(
      (i) => i.description && i.quantity && i.price,
    );
    if (validItems.length === 0) {
      Toast.show({ type: "error", text1: "Agrega al menos un item" });
      return;
    }

    const total = calculateTotal();

    // Insert invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        customer_id: selectedCustomer,
        amount: total,
        status: "pendiente",
        due_date: dueDate || null,
        added_by: username,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error(invoiceError);
      Toast.show({ type: "error", text1: "Error al crear factura" });
      return;
    }

    // Insert invoice items
    const itemsToInsert = validItems.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.price),
      total: parseFloat(item.quantity) * parseFloat(item.price),
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error(itemsError);
      Toast.show({ type: "error", text1: "Error al guardar items" });
      return;
    }

    Toast.show({
      type: "success",
      text1: "Factura creada",
      text2: `#${invoice.invoice_number}`,
    });
    setIsModalOpen(false);
    resetForm();
    fetchInvoices();
  };

  const toggleStatus = async (invoice: Invoice) => {
    const newStatus = invoice.status === "pagada" ? "pendiente" : "pagada";
    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", invoice.id);

    if (error) {
      console.error(error);
      Toast.show({ type: "error", text1: "Error al actualizar" });
    } else {
      setInvoices(
        invoices.map((i) =>
          i.id === invoice.id ? { ...i, status: newStatus } : i,
        ),
      );
      Toast.show({
        type: "success",
        text1: `Factura marcada como ${newStatus}`,
      });
    }
  };

  const resetForm = () => {
    setSelectedCustomer("");
    setItems([{ description: "", quantity: "1", price: "" }]);
    setDueDate("");
  };

  const renderInvoice = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      onPress={() => toggleStatus(item)}
      className="bg-surface border border-border rounded-xl p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View>
          <Text className="text-foreground text-lg font-bold">
            #{item.invoice_number}
          </Text>
          <Text className="text-muted text-sm">
            {item.customer?.name || "Sin cliente"}
          </Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            item.status === "pagada" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          <Text className="text-white text-xs font-semibold uppercase">
            {item.status}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-foreground text-2xl font-bold">
          ${item.amount.toLocaleString("es-ES")}
        </Text>
        <Text className="text-muted text-xs">
          {new Date(item.created_at).toLocaleDateString("es-ES")}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-surface border-b border-border px-6 pt-16 pb-4">
        <Text className="text-foreground text-3xl font-bold mb-4">
          Facturas
        </Text>

        {/* Filters */}
        <View className="flex-row gap-2">
          {["all", "pendiente", "pagada"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg ${
                filter === f ? "bg-primary" : "bg-surface-elevated"
              }`}
            >
              <Text
                className={
                  filter === f ? "text-white font-semibold" : "text-muted"
                }
              >
                {f === "all" ? "Todas" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <SkeletonLoader />
      ) : (
        <FlatList
          data={invoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <FileText size={48} color="#94A3B8" />
              <Text className="text-muted text-base mt-4">No hay facturas</Text>
            </View>
          }
        />
      )}

      {/* Floating Button */}
      <TouchableOpacity
        onPress={() => setIsModalOpen(true)}
        className="absolute bottom-6 right-6 bg-primary w-16 h-16 rounded-full items-center justify-center shadow-lg"
      >
        <Plus size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Modal: Crear Factura */}
      <Modal visible={isModalOpen} animationType="slide">
        <View className="flex-1 bg-background">
          <ScrollView className="flex-1 px-6 pt-16">
            <Text className="text-foreground text-3xl font-bold mb-6">
              Nueva Factura
            </Text>

            {/* Customer Selection */}
            <Text className="text-muted mb-2">Cliente:</Text>
            <View className="bg-surface border border-border rounded-xl mb-4">
              {customers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  onPress={() => setSelectedCustomer(customer.id)}
                  className={`p-4 border-b border-border ${
                    selectedCustomer === customer.id ? "bg-primary/20" : ""
                  }`}
                >
                  <Text
                    className={
                      selectedCustomer === customer.id
                        ? "text-primary font-bold"
                        : "text-foreground"
                    }
                  >
                    {customer.name}
                  </Text>
                  {customer.phone && (
                    <Text className="text-muted text-sm">{customer.phone}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Items */}
            <Text className="text-muted mb-2">Items:</Text>
            {items.map((item, index) => (
              <View
                key={index}
                className="bg-surface border border-border rounded-xl p-4 mb-3"
              >
                <TextInput
                  value={item.description}
                  onChangeText={(val) => updateItem(index, "description", val)}
                  placeholder="Descripción (ej: Pan integral)"
                  placeholderTextColor="#64748B"
                  className="text-foreground bg-background border border-border rounded-lg p-3 mb-2"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={item.quantity}
                    onChangeText={(val) => updateItem(index, "quantity", val)}
                    placeholder="Cant."
                    keyboardType="numeric"
                    placeholderTextColor="#64748B"
                    className="flex-1 text-foreground bg-background border border-border rounded-lg p-3"
                  />
                  <TextInput
                    value={item.price}
                    onChangeText={(val) => updateItem(index, "price", val)}
                    placeholder="Precio"
                    keyboardType="numeric"
                    placeholderTextColor="#64748B"
                    className="flex-1 text-foreground bg-background border border-border rounded-lg p-3"
                  />
                </View>
                {items.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    className="mt-2 bg-red-500/20 py-2 rounded-lg"
                  >
                    <Text className="text-red-500 text-center font-semibold">
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              onPress={addItem}
              className="bg-primary/20 py-3 rounded-xl mb-4"
            >
              <Text className="text-primary text-center font-semibold">
                + Agregar Item
              </Text>
            </TouchableOpacity>

            {/* Total */}
            <View className="bg-surface border border-border rounded-xl p-4 mb-6">
              <Text className="text-muted mb-1">Total:</Text>
              <Text className="text-foreground text-3xl font-bold">
                ${calculateTotal().toLocaleString("es-ES")}
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row gap-3 mb-8">
              <TouchableOpacity
                onPress={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="flex-1 bg-surface-elevated py-4 rounded-xl"
              >
                <Text className="text-muted text-center font-semibold">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={createInvoice}
                className="flex-1 bg-primary py-4 rounded-xl"
              >
                <Text className="text-white text-center font-semibold">
                  Crear Factura
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
