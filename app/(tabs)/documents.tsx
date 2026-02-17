import { decode } from "base64-arraybuffer";
import * as DocumentPicker from "expo-document-picker";
import { Download, FileText, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export default function DocumentsScreen() {
  const { username } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setDocs(data || []);
    setLoading(false);
  };

  const uploadDoc = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = file.name;
      const fileUri = file.uri;

      // Read file as base64
      const response = await fetch(fileUri);
      const blob = await response.blob();
      // Supabase upload logic
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(",")[1];

        const { data, error } = await supabase.storage
          .from("documents")
          .upload(fileName, decode(base64), {
            contentType: file.mimeType,
          });

        if (error) {
          Alert.alert("Error", error.message);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("documents").getPublicUrl(fileName);

        const { error: dbError } = await supabase.from("documents").insert({
          name: fileName,
          url: publicUrl,
          type: file.mimeType,
          added_by: username,
        });

        if (dbError) {
          Alert.alert("Error Saving to DB", dbError.message);
        } else {
          fetchDocs();
        }
      };
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo subir el documento");
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => Linking.openURL(item.url)}
      className="bg-surface p-4 rounded-xl border border-border mb-3 flex-row items-center"
    >
      <FileText size={24} color="#6366F1" />
      <View className="ml-4 flex-1">
        <Text className="text-text font-bold text-lg" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-muted text-xs">
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Download size={20} color="#94A3B8" />
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background pt-12 px-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-bold text-text">Documentos</Text>
        <TouchableOpacity
          onPress={uploadDoc}
          className="bg-primary p-2 rounded-full"
        >
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={docs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchDocs}
            tintColor="#6366F1"
            colors={["#6366F1"]}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center mt-20">
            <FileText size={48} color="#334155" />
            <Text className="text-muted text-center mt-4 px-8">
              Aquí puedes guardar el RUT, NIT y otros documentos de la empresa.
            </Text>
          </View>
        }
      />
    </View>
  );
}
