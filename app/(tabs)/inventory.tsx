import { DollarSign, Package, Plus, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import SkeletonLoader from "../../components/SkeletonLoader";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export default function InventoryScreen() {
  const { username } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New product form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) console.error(error);
    else setProducts(data || []);
    setLoading(false);
  };

  const handleAddProduct = async () => {
    if (!name || !price) {
      Toast.show({
        type: "error",
        text1: "Campos requeridos",
        text2: "Ingresa nombre y precio del producto",
      });
      return;
    }

    const { error } = await supabase.from("products").insert({
      name,
      price: parseFloat(price),
      description,
      added_by: username,
    });

    if (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message,
      });
    } else {
      setIsModalOpen(false);
      setName("");
      setPrice("");
      setDescription("");
      fetchProducts();
      Toast.show({
        type: "success",
        text1: "Producto agregado",
        text2: "Ahora puedes usarlo en pedidos y ventas",
      });
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          className="bg-surface p-4 rounded-xl border border-border mb-3"
        >
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <SkeletonLoader width={140} height={20} />
              <View className="mt-2" />
              <SkeletonLoader width="80%" height={14} />
            </View>
            <SkeletonLoader width={70} height={28} radius={8} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-surface p-4 rounded-xl border border-border mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="font-bold text-lg text-text">{item.name}</Text>
          {item.description && (
            <Text className="text-muted text-sm mt-1">{item.description}</Text>
          )}
        </View>
        <View className="bg-green-600 px-3 py-1 rounded-lg">
          <Text className="text-white font-bold text-base">${item.price}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="p-4 pt-12 flex-row justify-between items-center border-b border-border bg-surface">
        <Text className="text-2xl font-bold text-text">Productos</Text>
        <TouchableOpacity
          onPress={() => setIsModalOpen(true)}
          className="bg-primary p-2 rounded-full"
        >
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>

      <View className="p-4">
        <View className="bg-surface p-3 rounded-xl border border-border flex-row items-center mb-4">
          <Search size={20} color="#94A3B8" />
          <TextInput
            placeholder="Buscar producto..."
            placeholderTextColor="#94A3B8"
            className="ml-3 flex-1 text-text text-base"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <FlatList
          data={filteredProducts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchProducts}
              tintColor="#6366F1"
              colors={["#6366F1"]}
            />
          }
          ListEmptyComponent={
            loading ? (
              renderSkeleton()
            ) : (
              <View className="items-center mt-12">
                <Package size={64} color="#475569" />
                <Text className="text-center text-muted mt-4">
                  No hay productos registrados.
                </Text>
                <Text className="text-center text-muted text-sm mt-2">
                  Agrega productos para usarlos en pedidos y ventas
                </Text>
              </View>
            )
          }
        />
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-3xl p-6 h-[75%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text">
                Nuevo Producto
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text className="text-muted text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-text mb-2">Nombre del Producto</Text>
            <TextInput
              className="bg-background text-text text-base p-4 rounded-xl border border-border mb-4"
              placeholder="Ej: Pan integral, Torta de chocolate..."
              placeholderTextColor="#475569"
              value={name}
              onChangeText={setName}
            />

            <Text className="text-text mb-2">Precio</Text>
            <View className="flex-row items-center bg-background rounded-xl border border-border mb-4">
              <View className="p-4 border-r border-border">
                <DollarSign size={20} color="#94A3B8" />
              </View>
              <TextInput
                keyboardType="numeric"
                className="flex-1 text-text text-base p-4"
                placeholder="0.00"
                placeholderTextColor="#475569"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            <Text className="text-text mb-2">Descripción (Opcional)</Text>
            <TextInput
              className="bg-background text-text text-base p-4 rounded-xl border border-border mb-6"
              placeholder="Detalles del producto..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              onPress={handleAddProduct}
              className="bg-primary p-4 rounded-xl items-center mt-auto mb-8"
            >
              <Text className="text-white text-lg font-bold">
                Agregar Producto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
