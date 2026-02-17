/// <reference types="nativewind/types" />
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";

// Types para nuevas funcionalidades
export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  credit_limit: number;
  created_at: string;
  added_by?: string;
};

export type Invoice = {
  id: string;
  invoice_number: number;
  customer_id: string;
  amount: number;
  status: "pagada" | "pendiente";
  created_at: string;
  due_date?: string;
  added_by?: string;
  customer?: Customer; // Join opcional
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type CustomerPayment = {
  id: string;
  customer_id: string;
  amount: number;
  type: "abono" | "devolucion";
  description?: string;
  created_at: string;
  added_by?: string;
};

export type Note = {
  id: string;
  content: string;
  category: "importante" | "urgente" | "normal";
  is_read: boolean;
  created_at: string;
  added_by?: string;
};
