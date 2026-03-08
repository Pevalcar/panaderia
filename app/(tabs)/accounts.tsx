import { useFocusEffect } from "@react-navigation/native";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Edit2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
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

export default function AccountsScreen() {
  const { username } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Transaction state
  const [type, setType] = useState<"compra" | "venta">("venta");
  const [saleType, setSaleType] = useState<"productos" | "otros">("productos");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);

  // Product selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    fetchData();
    fetchProducts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, []),
  );

  useEffect(() => {
    if (isModalOpen && type === "venta" && saleType === "productos") {
      fetchProducts();
    }
  }, [isModalOpen, type, saleType]);

  useEffect(() => {
    const channel = supabase
      .channel("products-live-accounts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchProducts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        Toast.show({
          type: "error",
          text1: "No se pudieron cargar movimientos",
          text2: error.message,
        });
        setData([]);
        return;
      }

      setData(transactions || []);
    } catch {
      Toast.show({
        type: "error",
        text1: "Error de conexión al cargar movimientos",
      });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .order("name", { ascending: true });

      if (error) {
        Toast.show({
          type: "error",
          text1: "No se pudieron cargar productos",
          text2: error.message,
        });
        setProducts([]);
        return;
      }

      setProducts(data || []);
    } catch {
      Toast.show({
        type: "error",
        text1: "Error de conexión al cargar productos",
      });
      setProducts([]);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      return new Promise((resolve) => {
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(",")[1];
          const fileName = `${Date.now()}.png`;

          const { error } = await supabase.storage
            .from("images")
            .upload(fileName, decode(base64), {
              contentType: "image/png",
            });

          if (error) {
            console.error(error);
            resolve(null);
            return;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("images").getPublicUrl(fileName);
          resolve(publicUrl);
        };
      });
    } catch (e) {
      console.error(e);
      return null;
    }
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

  const handleCreate = async () => {
    if (type === "venta" && saleType === "productos") {
      if (cart.length === 0) {
        Toast.show({ type: "error", text1: "Agrega productos a la venta" });
        return;
      }
    } else if (type === "venta" && saleType === "otros") {
      if (!description.trim()) {
        Toast.show({ type: "error", text1: "Describe qué se vendió" });
        return;
      }
      if (!amount) {
        Toast.show({ type: "error", text1: "Ingresa el monto" });
        return;
      }
    } else {
      // Compra/Gasto
      if (!amount) {
        Toast.show({ type: "error", text1: "Ingresa el monto" });
        return;
      }
    }

    let imageUrl = null;
    if (image) {
      imageUrl = await uploadImage(image);
    }

    const finalAmount =
      type === "venta" && saleType === "productos"
        ? calculateTotal()
        : parseFloat(amount);

    const transactionData: any = {
      type,
      amount: finalAmount,
      description,
      image_url: imageUrl,
      added_by: username,
    };

    if (type === "venta") {
      transactionData.sale_type = saleType;
      if (saleType === "productos") {
        transactionData.items = cart;
      }
    }

    if (editingId) {
      const { error } = await supabase
        .from("transactions")
        .update(transactionData)
        .eq("id", editingId);

      if (error) {
        Toast.show({
          type: "error",
          text1: "Error al actualizar",
          text2: error.message,
        });
      } else {
        Toast.show({ type: "success", text1: "Venta actualizada" });
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("transactions")
        .insert(transactionData);

      if (error) {
        Toast.show({ type: "error", text1: "Error", text2: error.message });
      } else {
        Toast.show({ type: "success", text1: "Movimiento guardado" });
        resetForm();
        fetchData();
      }
    }
  };

  const handleEdit = (item: any) => {
    if (item.type !== "venta") return;

    setEditingId(item.id);
    setType(item.type);
    setSaleType(item.sale_type || "otros");
    setAmount(item.amount.toString());
    setDescription(item.description || "");
    setImage(item.image_url);

    if (item.sale_type === "productos" && item.items) {
      setCart(item.items);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      Toast.show({ type: "error", text1: "Error al eliminar" });
    } else {
      Toast.show({ type: "success", text1: "Eliminado" });
      fetchData();
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setType("venta");
    setSaleType("productos");
    setAmount("");
    setDescription("");
    setImage(null);
    setCart([]);
    setSearchQuery("");
  };

  const filteredProducts = products.filter((product) =>
    smartIncludes(searchQuery, product.name),
  );

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-surface p-4 rounded-xl border border-border mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text
            className={`font-bold text-lg ${item.type === "venta" ? "text-green-500" : "text-pink-500"}`}
          >
            {item.type === "venta" ? "+" : "-"} {formatCOP(item.amount)}
          </Text>

          {item.sale_type === "productos" && item.items && (
            <View className="mt-2">
              {item.items.map((cartItem: CartItem, idx: number) => (
                <Text key={idx} className="text-muted text-xs">
                  • {cartItem.quantity}x {cartItem.product_name} (
                  {formatCOP(cartItem.subtotal)})
                </Text>
              ))}
            </View>
          )}

          {item.description && (
            <Text className="text-muted text-sm mt-1">{item.description}</Text>
          )}

          <Text className="text-xs text-border mt-1">
            {new Date(item.created_at).toLocaleDateString()} - {item.added_by}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {item.image_url && (
            <Image
              source={{ uri: item.image_url }}
              className="w-12 h-12 rounded-lg bg-gray-600"
            />
          )}

          {item.type === "venta" && (
            <>
              <TouchableOpacity
                onPress={() => handleEdit(item)}
                className="p-2"
              >
                <Edit2 size={18} color="#6366F1" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                className="p-2"
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          className="bg-surface p-4 rounded-xl border border-border mb-3"
        >
          <SkeletonLoader width={100} height={24} />
          <View className="mt-2" />
          <SkeletonLoader width="80%" height={16} />
        </View>
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="p-4 pt-12 flex-row justify-between items-center border-b border-border bg-surface">
        <Text className="text-2xl font-bold text-text">Cuentas</Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={async () => {
              await Promise.all([fetchData(), fetchProducts()]);
              Toast.show({ type: "success", text1: "Datos actualizados" });
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
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
            tintColor="#6366F1"
          />
        }
        ListEmptyComponent={
          loading ? (
            renderSkeleton()
          ) : (
            <Text className="text-muted text-center mt-8">
              No hay movimientos recientes.
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
                {editingId ? "Editar Venta" : "Nueva Transacción"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X color="#94A3B8" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Tipo de transacción */}
              <View className="flex-row mb-6 bg-background rounded-xl p-1 border border-border">
                <TouchableOpacity
                  onPress={() => setType("venta")}
                  className={`flex-1 p-3 rounded-lg items-center ${type === "venta" ? "bg-green-600" : ""}`}
                >
                  <Text
                    className={`font-bold ${type === "venta" ? "text-white" : "text-muted"}`}
                  >
                    Venta
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setType("compra")}
                  className={`flex-1 p-3 rounded-lg items-center ${type === "compra" ? "bg-pink-600" : ""}`}
                >
                  <Text
                    className={`font-bold ${type === "compra" ? "text-white" : "text-muted"}`}
                  >
                    Gasto / Compra
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Para Ventas: Tipo de venta */}
              {type === "venta" && (
                <View className="flex-row mb-6 bg-background rounded-xl p-1 border border-border">
                  <TouchableOpacity
                    onPress={() => setSaleType("productos")}
                    className={`flex-1 p-3 rounded-lg items-center ${saleType === "productos" ? "bg-primary" : ""}`}
                  >
                    <Text
                      className={`font-bold ${saleType === "productos" ? "text-white" : "text-muted"}`}
                    >
                      Productos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSaleType("otros")}
                    className={`flex-1 p-3 rounded-lg items-center ${saleType === "otros" ? "bg-primary" : ""}`}
                  >
                    <Text
                      className={`font-bold ${saleType === "otros" ? "text-white" : "text-muted"}`}
                    >
                      Otros
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* VENTA CON PRODUCTOS */}
              {type === "venta" && saleType === "productos" && (
                <>
                  {/* Buscador de productos */}
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
                        Productos seleccionados:
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
                                  updateQuantity(
                                    item.product_id,
                                    item.quantity - 1,
                                  )
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
                                  updateQuantity(
                                    item.product_id,
                                    item.quantity + 1,
                                  )
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

                  {/* Descripción opcional */}
                  <Text className="text-text mb-2">Nota (Opcional)</Text>
                  <TextInput
                    className="bg-background text-text text-base p-4 rounded-xl border border-border mb-4"
                    placeholder="Algún detalle adicional..."
                    placeholderTextColor="#475569"
                    value={description}
                    onChangeText={setDescription}
                  />
                </>
              )}

              {/* VENTA OTROS o COMPRA/GASTO */}
              {(type === "compra" ||
                (type === "venta" && saleType === "otros")) && (
                <>
                  <Text className="text-text mb-2">Monto</Text>
                  <TextInput
                    keyboardType="numeric"
                    className="bg-background text-text text-xl p-4 rounded-xl border border-border mb-4"
                    placeholder="0.00"
                    placeholderTextColor="#475569"
                    value={amount}
                    onChangeText={setAmount}
                  />

                  <Text className="text-text mb-2">Descripción</Text>
                  <TextInput
                    className="bg-background text-text text-base p-4 rounded-xl border border-border mb-4"
                    placeholder={
                      type === "venta"
                        ? "¿Qué se vendió?"
                        : "Detalles del gasto..."
                    }
                    placeholderTextColor="#475569"
                    value={description}
                    onChangeText={setDescription}
                  />
                </>
              )}

              {/* Foto del recibo */}
              <TouchableOpacity
                onPress={pickImage}
                className="flex-row items-center justify-center border-2 border-dashed border-border p-6 rounded-xl mb-6"
              >
                {image ? (
                  <Image
                    source={{ uri: image }}
                    className="w-full h-32 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Camera color="#94A3B8" size={24} />
                    <Text className="text-muted ml-2">
                      Agregar Foto (Recibo/Factura)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreate}
                className="bg-primary p-4 rounded-xl items-center mb-8"
              >
                <Text className="text-white text-lg font-bold">
                  {editingId ? "Actualizar" : "Guardar"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
