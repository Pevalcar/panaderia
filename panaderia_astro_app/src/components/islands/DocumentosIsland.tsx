import { useEffect, useState } from "preact/hooks";
import { getCurrentUsername, supabase } from "../../lib/supabase";

type DocumentRow = {
  id: number;
  name: string;
  url: string;
  type?: string | null;
  created_at: string;
};

function getStoragePathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/documents/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rawPath = parsed.pathname.slice(idx + marker.length);
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
}

export default function DocumentosIsland() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    row: DocumentRow | null;
  }>({
    isOpen: false,
    row: null,
  });

  const fetchDocs = async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("documents")
      .select("id, name, url, type, created_at")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setDocs((data || []) as DocumentRow[]);
    setLoading(false);
  };

  const uploadDoc = async (file: File) => {
    setError("");
    setMessage("");

    const username = getCurrentUsername();
    if (!username) {
      setError("Debes iniciar sesión");
      return;
    }

    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName);

    const { error: dbError } = await supabase.from("documents").insert({
      name: file.name,
      url: publicUrl,
      type: file.type,
      added_by: username,
    });

    if (dbError) {
      setUploading(false);
      setError(dbError.message);
      return;
    }

    setUploading(false);
    setMessage("Documento subido correctamente");
    fetchDocs();
  };

  const requestDelete = (row: DocumentRow) => {
    setDeleteModal({ isOpen: true, row });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, row: null });
  };

  const confirmDelete = async () => {
    if (!deleteModal.row) return;

    setDeleting(true);
    setError("");
    setMessage("");

    const storagePath = getStoragePathFromUrl(deleteModal.row.url);
    if (storagePath) {
      await supabase.storage.from("documents").remove([storagePath]);
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", deleteModal.row.id);

    setDeleting(false);
    closeDeleteModal();

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Documento eliminado");
    fetchDocs();
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <section class="panel-card">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-text">Documentos</h1>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted hover:text-text"
            onClick={fetchDocs}
            type="button"
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <label class="cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
            {uploading ? "Subiendo..." : "Subir"}
            <input
              class="hidden"
              onChange={(event) => {
                const file = (event.currentTarget as HTMLInputElement)
                  .files?.[0];
                if (!file) return;
                uploadDoc(file);
                (event.currentTarget as HTMLInputElement).value = "";
              }}
              type="file"
            />
          </label>
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
        {docs.map((item) => (
          <article
            class="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4"
            key={item.id}
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-text">
                {item.name}
              </p>
              <p class="text-xs text-muted">
                {new Date(item.created_at).toLocaleDateString("es-CO")}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <a
                class="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted"
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                Abrir
              </a>
              <button
                class="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                onClick={() => requestDelete(item)}
                type="button"
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}

        {!loading && docs.length === 0 && (
          <p class="text-sm text-muted">
            Aquí puedes guardar RUT, NIT y otros documentos de la empresa.
          </p>
        )}
      </div>

      {deleteModal.isOpen && deleteModal.row && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <h3 class="text-lg font-semibold text-text">Eliminar documento</h3>
            <p class="mt-2 text-sm text-muted">
              ¿Seguro que deseas eliminar "{deleteModal.row.name}"?
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
                disabled={deleting}
                onClick={confirmDelete}
                type="button"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
