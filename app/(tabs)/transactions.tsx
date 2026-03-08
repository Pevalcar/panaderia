import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus, RefreshCw, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
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
import { formatCOP } from "../../lib/currency";
import { supabase } from "../../lib/supabase";

export default function TransactionsScreen() {
  const { username } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New transaction state
  const [type, setType] = useState<"compra" | "venta">("venta");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) console.error(error);
    else setData(transactions || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      // Supabase storage needs ArrayBuffer or Blob
      // React Native with Supabase storage is tricky, sometimes easier to use base64
      // Let's use arraybuffer from blob

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          // extract base64 part
          const base64 = base64data.split(",")[1];
          const fileName = `${Date.now()}.png`;

          const { data, error } = await supabase.storage
            .from("images") // Ensure this bucket exists!
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

  const handleCreate = async () => {
    if (!amount) return;

    let imageUrl = null;
    if (image) {
      // For MVP, if upload is complex, we might just skip or need to handle carefully
      // Assuming 'images' bucket is created and public
      imageUrl = await uploadImage(image);
    }

    const { error } = await supabase.from("transactions").insert({
      type,
      amount: parseFloat(amount),
      description,
      image_url: imageUrl,
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
      setAmount("");
      setDescription("");
      setImage(null);
      fetchData();
      Toast.show({
        type: "success",
        text1: "Transacción guardada",
        text2: "El movimiento ha sido registrado correctamente",
      });
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-surface p-4 rounded-xl border border-border mb-3 flex-row justify-between items-center">
      <View className="flex-1">
        <Text
          className={`font-bold text-lg ${item.type === "venta" ? "text-green-500" : "text-pink-500"}`}
        >
          {item.type === "venta" ? "+" : "-"} {formatCOP(item.amount)}
        </Text>
        <Text className="text-muted text-sm">
          {item.description || "Sin descripción"}
        </Text>
        <Text className="text-xs text-border mt-1">
          {new Date(item.created_at).toLocaleDateString()} - {item.added_by}
        </Text>
      </View>
      {item.image_url && (
        <Image
          source={{ uri: item.image_url }}
          className="w-12 h-12 rounded-lg ml-2 bg-gray-600"
        />
      )}
    </View>
  );

  const renderSkeleton = () => (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          className="bg-surface p-4 rounded-xl border border-border mb-3 flex-row justify-between items-center"
        >
          <View className="flex-1">
            <SkeletonLoader width={100} height={24} />
            <View className="mt-2" />
            <SkeletonLoader width="80%" height={16} />
            <View className="mt-2" />
            <SkeletonLoader width={120} height={12} />
          </View>
          <SkeletonLoader width={48} height={48} radius={8} />
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
              await fetchData();
              Toast.show({
                type: "success",
                text1: "Movimientos actualizados",
              });
            }}
            className="bg-surface p-2 rounded-full border border-border"
          >
            <RefreshCw color="#94A3B8" size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsModalOpen(true)}
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
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-3xl p-6 h-[85%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text">
                Nueva Transacción
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X color="#94A3B8" size={24} />
              </TouchableOpacity>
            </View>

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
              placeholder="Detalles..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
            />

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
              className="bg-primary p-4 rounded-xl items-center mt-auto mb-8"
            >
              <Text className="text-white text-lg font-bold">Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
