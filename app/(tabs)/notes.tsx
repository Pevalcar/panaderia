import { AlertCircle, Bookmark, Plus, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
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
import type { Note } from "../../types";

export default function NotesScreen() {
  const { username } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "importante" | "urgente" | "unread"
  >("all");

  // Form state
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"normal" | "importante" | "urgente">(
    "normal",
  );

  useEffect(() => {
    fetchNotes();
  }, [filter]);

  const fetchNotes = async () => {
    setLoading(true);
    let query = supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter === "importante") query = query.eq("category", "importante");
    if (filter === "urgente") query = query.eq("category", "urgente");
    if (filter === "unread") query = query.eq("is_read", false);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      Toast.show({ type: "error", text1: "Error al cargar comentos" });
    } else {
      setNotes(data || []);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotes();
    setRefreshing(false);
  };

  const createNote = async () => {
    if (!content.trim()) {
      Toast.show({ type: "error", text1: "El contenido no puede estar vacío" });
      return;
    }

    const { error } = await supabase.from("notes").insert({
      content: content.trim(),
      category,
      added_by: username,
    });

    if (error) {
      console.error(error);
      Toast.show({ type: "error", text1: "Error al crear comento" });
    } else {
      Toast.show({ type: "success", text1: "Comento creado" });
      setContent("");
      setCategory("normal");
      setIsModalOpen(false);
      fetchNotes();
    }
  };

  const toggleRead = async (note: Note) => {
    const { error } = await supabase
      .from("notes")
      .update({ is_read: !note.is_read })
      .eq("id", note.id);

    if (error) {
      console.error(error);
    } else {
      setNotes(
        notes.map((n) =>
          n.id === note.id ? { ...n, is_read: !n.is_read } : n,
        ),
      );
    }
  };

  const deleteNote = (id: string) => {
    Alert.alert("Eliminar Comento", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("notes").delete().eq("id", id);
          if (error) {
            Toast.show({ type: "error", text1: "Error al eliminar" });
          } else {
            setNotes(notes.filter((n) => n.id !== id));
            Toast.show({ type: "success", text1: "Comento eliminado" });
          }
        },
      },
    ]);
  };

  const getCategoryColor = (cat: string) => {
    if (cat === "urgente") return "bg-red-500";
    if (cat === "importante") return "bg-yellow-500";
    return "bg-gray-500";
  };

  const renderNote = ({ item }: { item: Note }) => (
    <View className="bg-surface border border-border rounded-xl p-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View
          className={`${getCategoryColor(item.category)} px-3 py-1 rounded-full`}
        >
          <Text className="text-white text-xs font-semibold uppercase">
            {item.category}
          </Text>
        </View>
        <Text className="text-muted text-xs">
          {new Date(item.created_at).toLocaleDateString("es-ES")}
        </Text>
      </View>

      <Text
        className={`text-foreground text-base mb-3 ${item.is_read ? "opacity-50" : ""}`}
      >
        {item.content}
      </Text>

      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => toggleRead(item)}
          className="flex-row items-center bg-primary/20 px-3 py-2 rounded-lg"
        >
          <Bookmark size={16} color={item.is_read ? "#94A3B8" : "#6366F1"} />
          <Text className="text-primary text-xs ml-2">
            {item.is_read ? "Marcar no leído" : "Marcar leído"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => deleteNote(item.id)}>
          <Trash2 size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-surface border-b border-border px-6 pt-16 pb-4">
        <Text className="text-foreground text-3xl font-bold mb-4">
          Comentos Importantes
        </Text>

        {/* Filters */}
        <View className="flex-row gap-2">
          {["all", "urgente", "importante", "unread"].map((f) => (
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
                {f === "all"
                  ? "Todos"
                  : f === "unread"
                    ? "No Leídos"
                    : f.charAt(0).toUpperCase() + f.slice(1)}
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
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <AlertCircle size={48} color="#94A3B8" />
              <Text className="text-muted text-base mt-4">No hay comentos</Text>
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

      {/* Modal: Crear Comento */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-surface rounded-t-3xl p-6 pt-8">
            <Text className="text-foreground text-2xl font-bold mb-4">
              Nuevo Comento
            </Text>

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Escribe algo importante..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={4}
              className="bg-background text-foreground border border-border rounded-xl p-4 mb-4"
              style={{ textAlignVertical: "top" }}
            />

            <Text className="text-muted mb-2">Categoría:</Text>
            <View className="flex-row gap-2 mb-6">
              {(["normal", "importante", "urgente"] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`flex-1 py-3 rounded-lg ${
                    category === cat
                      ? getCategoryColor(cat)
                      : "bg-surface-elevated"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      category === cat ? "text-white" : "text-muted"
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                className="flex-1 bg-surface-elevated py-4 rounded-xl"
              >
                <Text className="text-muted text-center font-semibold">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={createNote}
                className="flex-1 bg-primary py-4 rounded-xl"
              >
                <Text className="text-white text-center font-semibold">
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
