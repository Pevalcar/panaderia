export function formatCOP(value: number | string | null | undefined): string {
  const parsedValue =
    typeof value === "number" ? value : Number.parseFloat(value ?? "0");

  const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(safeValue);
}
