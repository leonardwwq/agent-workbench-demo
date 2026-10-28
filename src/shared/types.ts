export type AgentId =
  "control" | "recruit" | "growth" | "operations" | "customer" | "video";
export type ProductKind = "subscription" | "tokens" | "feature" | "bundle";
export type TaskStatus = "running" | "success" | "failed" | "interrupted";
export interface Agent {
  id: AgentId;
  name: string;
  sender: string;
  description: string;
  initial: string;
  color: string;
}
export interface Capability {
  id: string;
  agentId: AgentId;
  pluginId: string;
  name: string;
  description: string;
  enabled: boolean;
  cost: number;
  basic: boolean;
}
export interface Plugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}
export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  price: number;
  enabled: boolean;
  tokens: number;
  capabilityIds: string[];
  subscriptionId?: string;
  months?: number;
  tokenProductId?: string;
  featureProductIds?: string[];
}
export interface Account {
  name: string;
  storeName: string;
  service: string;
  subscriptionId: string | null;
  subscriptionAt?: number;
  featureIds: string[];
  balance: number;
}
export interface BusinessResult {
  title: string;
  body: string;
  fields: Record<string, string>;
  adopted?: boolean;
  activityId?: string;
  customerIds?: string[];
  sent?: boolean;
  feedbackIds?: string[];
  arrivedIds?: string[];
  todos?: { id: string; text: string; done: boolean }[];
}
export interface Task {
  id: string;
  agentId: AgentId;
  capabilityId: string;
  title: string;
  status: TaskStatus;
  input: Record<string, string>;
  result?: BusinessResult;
  cost: number;
  createdAt: number;
  ownerId: string;
  error?: string;
  planId?: string;
}
export interface ChatMessage {
  id: string;
  agentId: AgentId;
  sender: AgentId | "user";
  text: string;
  createdAt: number;
  taskId?: string;
  planId?: string;
}
export interface Plan {
  id: string;
  title: string;
  confirmed: boolean;
  createdAt: number;
  taskIds: string[];
}
export interface Customer {
  id: string;
  name: string;
  group: string;
  note: string;
  lastVisit: string;
}
export interface Order {
  id: string;
  productId: string;
  name: string;
  kind: ProductKind;
  price: number;
  createdAt: number;
  tokens: number;
  capabilityIds: string[];
}
export interface LedgerEntry {
  id: string;
  amount: number;
  balance: number;
  reason: string;
  createdAt: number;
  taskId?: string;
  orderId?: string;
}
export interface AppState {
  version: number;
  revision: number;
  resetId: string;
  mode: "business" | "purchase";
  agents: Agent[];
  capabilities: Capability[];
  plugins: Plugin[];
  products: Product[];
  account: Account;
  tasks: Task[];
  messages: ChatMessage[];
  plans: Plan[];
  customers: Customer[];
  orders: Order[];
  ledger: LedgerEntry[];
}
export interface Access {
  allowed: boolean;
  reason: string;
  kind: "allowed" | "platform" | "membership" | "balance";
}
