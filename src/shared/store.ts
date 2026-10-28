import Dexie, { liveQuery, type Table } from "dexie";
import { useSyncExternalStore } from "react";
import { AGENTS } from "./catalog";
import { buildResult } from "./mock-results";
import type {
  Access,
  Account,
  AgentId,
  AppState,
  BusinessResult,
  Capability,
  ChatMessage,
  Plugin,
  Product,
  Task,
} from "./types";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ownerId = uid();
const STATE_KEY = "app";
const LEASE_MS = 12_000;
class MockDB extends Dexie {
  state!: Table<{ id: string; value: AppState }, string>;
  owners!: Table<{ id: string; updatedAt: number }, string>;
  constructor() {
    super("qinghe-agent-workbench-v1");
    this.version(1).stores({ state: "id", owners: "id" });
  }
}
const db = new MockDB();
const clone = <T>(v: T): T => structuredClone(v);
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<string>>();
let current = seed("business");
let initialized: Promise<void> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let channel: BroadcastChannel | undefined;
const alive = new Set<string>();
function emit(state: AppState) {
  if (
    state.revision < current.revision ||
    (state.revision === current.revision && state.resetId === current.resetId)
  )
    return;
  current = state;
  listeners.forEach((l) => l());
}
function message(
  agentId: AgentId,
  sender: AgentId | "user",
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: uid(), agentId, sender, text, createdAt: Date.now(), ...extra };
}

function seed(mode: "business" | "purchase"): AppState {
  const capabilities: Capability[] = [
    {
      id: "control-plan",
      agentId: "control",
      pluginId: "core",
      name: "经营行动建议",
      description: "梳理目标、调度业务任务、汇总经营进展",
      enabled: true,
      cost: 0,
      basic: true,
    },
    {
      id: "recruit-copy",
      agentId: "recruit",
      pluginId: "recruit-plugin",
      name: "招聘文案",
      description: "根据岗位需求，生成可编辑的招聘文案",
      enabled: true,
      cost: 1000,
      basic: false,
    },
    {
      id: "growth-plan",
      agentId: "growth",
      pluginId: "growth-plugin",
      name: "引流活动",
      description: "从到店目标生成活动方案，确认后供客户邀约引用",
      enabled: true,
      cost: 2000,
      basic: false,
    },
    {
      id: "operations-todo",
      agentId: "operations",
      pluginId: "operations-plugin",
      name: "运营待办",
      description: "围绕门店重点生成行动清单并跟踪完成",
      enabled: true,
      cost: 1000,
      basic: false,
    },
    {
      id: "customer-invite",
      agentId: "customer",
      pluginId: "customer-plugin",
      name: "客户邀约",
      description: "引用已采用活动，为模拟客户分组生成邀约话术",
      enabled: true,
      cost: 1500,
      basic: false,
    },
    {
      id: "video-script",
      agentId: "video",
      pluginId: "video-plugin",
      name: "短视频脚本",
      description: "生成短视频脚本和分镜建议，不生成或发布视频",
      enabled: true,
      cost: 2500,
      basic: false,
    },
  ];
  const plugins: Plugin[] = capabilities.map((c) => ({
    id: c.pluginId,
    name:
      c.agentId === "control"
        ? "总控基础插件"
        : `${AGENTS.find((a) => a.id === c.agentId)!.sender}插件`,
    description: c.description,
    enabled: true,
  }));
  const products: Product[] = [
    {
      id: "sub-standard",
      kind: "subscription",
      name: "门店经营订阅",
      price: 128,
      enabled: true,
      tokens: 3_000_000_000,
      capabilityIds: [
        "recruit-copy",
        "growth-plan",
        "operations-todo",
        "customer-invite",
      ],
      months: 1,
    },
    {
      id: "tokens-1b",
      kind: "tokens",
      name: "1B Token 额度包",
      price: 28,
      enabled: true,
      tokens: 1_000_000_000,
      capabilityIds: [],
    },
    {
      id: "feature-video",
      kind: "feature",
      name: "短视频脚本功能",
      price: 18,
      enabled: true,
      tokens: 0,
      capabilityIds: ["video-script"],
    },
    {
      id: "bundle-starter",
      kind: "bundle",
      name: "门店启动套餐",
      price: 158,
      enabled: true,
      tokens: 0,
      capabilityIds: [],
      subscriptionId: "sub-standard",
      months: 1,
      tokenProductId: "tokens-1b",
      featureProductIds: ["feature-video"],
    },
  ];
  const welcomes: Record<AgentId, string> = {
    control:
      "你好，我是你的总控助手。告诉我这周想改善什么，我会把目标整理成可确认的行动建议。",
    recruit: "把岗位和门店亮点告诉我，一起写一份合适的招聘文案。",
    growth: "这周想让哪些顾客走进门店？从一场目标清晰的活动开始。",
    operations: "先理清今天最重要的事。生成待办后，可以在工作面板里逐项推进。",
    customer: "让关心更有分寸。先采用一份引流活动，再为合适的客户生成邀约。",
    video: "把门店的专业变成好内容。这里可以生成、编辑和保存短视频脚本。",
  };
  const names = [
    "林女士",
    "陈女士",
    "周女士",
    "李女士",
    "许女士",
    "黄女士",
    "吴女士",
    "郑女士",
    "何女士",
    "赵女士",
    "刘女士",
    "孙女士",
  ];
  return {
    version: 1,
    revision: 0,
    resetId: uid(),
    mode,
    agents: clone(AGENTS),
    capabilities,
    plugins,
    products,
    account: {
      name: "Leonard",
      storeName: "LABU 演示门店",
      service: "面部护理",
      subscriptionId: mode === "business" ? "sub-standard" : null,
      subscriptionAt: mode === "business" ? Date.now() : undefined,
      featureIds: [],
      balance: mode === "business" ? 3_000_000_000 : 0,
    },
    tasks: [],
    plans: [],
    customers: names.map((name, i) => ({
      id: `customer-${i + 1}`,
      name,
      group: i < 6 ? "近期活跃" : "待唤醒",
      note: i < 6 ? "关注换季护理，偏好工作日预约" : "近期未到店，适合轻量关怀",
      lastVisit: i < 6 ? "近 30 天" : "60 天前",
    })),
    orders: [],
    ledger: [],
    messages: AGENTS.map((a) => message(a.id, a.id, welcomes[a.id])),
  };
}

async function mutate(fn: (s: AppState) => void) {
  await initStore();
  let saved!: AppState;
  await db.transaction("rw", db.state, async () => {
    const row = await db.state.get(STATE_KEY);
    if (!row) throw Error("演示数据尚未准备好，请刷新重试");
    const state = clone(row.value);
    fn(state);
    state.revision++;
    saved = state;
    await db.state.put({ id: STATE_KEY, value: state });
  });
  emit(saved);
}
export function getState() {
  return current;
}
export function useApp() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getState,
    getState,
  );
}
async function recover(previousOwner?: string) {
  const now = Date.now();
  const owners = await db.owners.toArray();
  const live = new Set(
    owners.filter((o) => now - o.updatedAt < LEASE_MS).map((o) => o.id),
  );
  await db.transaction("rw", db.state, async () => {
    const row = await db.state.get(STATE_KEY);
    if (!row) return;
    let changed = false;
    for (const task of row.value.tasks) {
      if (
        task.status === "running" &&
        task.ownerId !== ownerId &&
        ((task.ownerId === previousOwner && !alive.has(task.ownerId)) ||
          !live.has(task.ownerId))
      ) {
        task.status = "interrupted";
        task.error = "页面已刷新或执行中断，未扣除额度，可重新生成";
        changed = true;
      }
    }
    if (changed) {
      row.value.revision++;
      await db.state.put(row);
      emit(row.value);
    }
  });
}
export function initStore(): Promise<void> {
  if (initialized) return initialized;
  initialized = (async () => {
    await db.open();
    await db.transaction("rw", db.state, async () => {
      const row = await db.state.get(STATE_KEY);
      if (!row || row.value.version !== 1)
        await db.state.put({ id: STATE_KEY, value: seed("business") });
      else if (row.value.account.storeName === "青禾美学护理") {
        row.value.account.storeName = "LABU 演示门店";
        row.value.revision++;
        await db.state.put(row);
      }
    });
    let previousOwner: string | undefined;
    try {
      previousOwner = sessionStorage.getItem("qinghe-owner") || undefined;
      sessionStorage.setItem("qinghe-owner", ownerId);
    } catch {
      /* Storage can be unavailable; lease expiry still recovers orphan work. */
    }
    if (
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      channel = new BroadcastChannel("qinghe-owner-liveness");
      channel.onmessage = (e) => {
        if (e.data?.type === "ping" && e.data.owner === ownerId)
          channel?.postMessage({ type: "alive", owner: ownerId });
        if (e.data?.type === "alive") alive.add(e.data.owner);
      };
      if (previousOwner) {
        channel.postMessage({ type: "ping", owner: previousOwner });
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await db.owners.put({ id: ownerId, updatedAt: Date.now() });
    await recover(previousOwner);
    const row = await db.state.get(STATE_KEY);
    if (row) {
      current = row.value;
      listeners.forEach((l) => l());
    }
    liveQuery(() => db.state.get(STATE_KEY)).subscribe({
      next: (row) => {
        if (row) emit(row.value);
      },
      error: (error) => console.error("本地数据同步失败", error),
    });
    heartbeat = setInterval(() => {
      void db.owners
        .put({ id: ownerId, updatedAt: Date.now() })
        .then(() => recover())
        .catch(() => {});
    }, 3000);
    (heartbeat as unknown as { unref?: () => void }).unref?.();
  })().catch((error) => {
    initialized = undefined;
    throw error;
  });
  return initialized;
}

export function accessFor(
  capabilityId: string,
  state: AppState = current,
): Access {
  const cap = state.capabilities.find((c) => c.id === capabilityId);
  const plugin = state.plugins.find((p) => p.id === cap?.pluginId);
  if (!cap || !cap.enabled || !plugin?.enabled)
    return { allowed: false, reason: "平台暂未开放此功能", kind: "platform" };
  const sub = state.products.find(
    (p) => p.id === state.account.subscriptionId && p.kind === "subscription",
  );
  if (
    !cap.basic &&
    !state.account.featureIds.includes(cap.id) &&
    !sub?.capabilityIds.includes(cap.id)
  )
    return {
      allowed: false,
      reason: "当前账号未开通此功能",
      kind: "membership",
    };
  if (state.account.balance < cap.cost)
    return {
      allowed: false,
      reason: "Token 额度不足，请先补充额度",
      kind: "balance",
    };
  return { allowed: true, reason: "可使用", kind: "allowed" };
}
const validText = (v: string, label: string, max = 120) => {
  if (!v?.trim()) throw Error(`请填写${label}`);
  if (v.trim().length > max) throw Error(`${label}不能超过 ${max} 字`);
  return v.trim();
};
function safeAmount(n: number, label: string) {
  if (!Number.isSafeInteger(n) || n < 0) throw Error(`${label}必须是非负整数`);
}
export async function saveCapability(value: Capability) {
  await mutate((s) => {
    const i = s.capabilities.findIndex((c) => c.id === value.id);
    if (i < 0) throw Error("本版不支持新增能力");
    const original = s.capabilities[i];
    safeAmount(value.cost, "模拟消耗");
    s.capabilities[i] = {
      ...original,
      name: validText(value.name, "能力名称"),
      description: value.description.trim(),
      enabled: !!value.enabled,
      cost: value.cost,
    };
  });
}
export async function savePlugin(value: Plugin) {
  await mutate((s) => {
    const i = s.plugins.findIndex((p) => p.id === value.id);
    if (i < 0) throw Error("本版不支持新增插件");
    s.plugins[i] = {
      ...s.plugins[i],
      name: validText(value.name, "插件名称"),
      description: value.description.trim(),
      enabled: !!value.enabled,
    };
  });
}
function validateProduct(p: Product, s: AppState) {
  validText(p.name, "商品名称");
  if (!Number.isFinite(p.price) || p.price <= 0 || p.price > 1e8)
    throw Error("请填写有效售价（大于 0）");
  if (Math.abs(p.price * 100 - Math.round(p.price * 100)) > 1e-6)
    throw Error("售价最多保留两位小数");
  safeAmount(p.tokens, "Token 额度");
  if (p.capabilityIds.some((id) => !s.capabilities.some((c) => c.id === id)))
    throw Error("商品引用了不存在的功能");
  if (
    (p.kind === "subscription" || p.kind === "feature") &&
    !p.capabilityIds.length
  )
    throw Error("请至少选择一项包含功能");
  if ((p.kind === "subscription" || p.kind === "tokens") && p.tokens <= 0)
    throw Error("请填写大于 0 的 Token 额度");
  if (p.kind === "feature" && p.tokens !== 0)
    throw Error("额外功能不附赠 Token，请通过额度包配置");
  if (p.kind === "bundle") {
    const hasSub = !!p.subscriptionId,
      hasTokens = !!p.tokenProductId,
      hasFeatures = !!p.featureProductIds?.length;
    if (!hasSub && !hasTokens && !hasFeatures)
      throw Error("请至少选择一个套餐组成商品");
    if (
      hasSub &&
      !s.products.some(
        (x) => x.id === p.subscriptionId && x.kind === "subscription",
      )
    )
      throw Error("请选择有效订阅方案");
    if (hasSub && p.months !== 1) throw Error("本次演示套餐仅支持一个月订阅");
    if (
      hasTokens &&
      !s.products.some((x) => x.id === p.tokenProductId && x.kind === "tokens")
    )
      throw Error("请选择有效额度包");
    if (
      p.featureProductIds?.some(
        (id) => !s.products.some((x) => x.id === id && x.kind === "feature"),
      )
    )
      throw Error("请选择有效额外功能");
  }
}
export async function saveProduct(value: Product) {
  await mutate((s) => {
    const existing = s.products.find((p) => p.id === value.id);
    if (existing && existing.kind !== value.kind)
      throw Error("不能修改已有商品类别");
    validateProduct(value, s);
    const p = clone(value);
    p.name = p.name.trim();
    p.capabilityIds = [...new Set(p.capabilityIds)];
    if (existing) s.products[s.products.indexOf(existing)] = p;
    else s.products.push(p);
  });
}
export async function saveProfile(
  value: Pick<Account, "name" | "storeName" | "service">,
) {
  await mutate((s) => {
    s.account.name = validText(value.name, "姓名", 30);
    s.account.storeName = validText(value.storeName, "门店名称", 50);
    s.account.service = validText(value.service, "主营服务", 80);
  });
}
export async function purchase(productId: string) {
  await mutate((s) => {
    const p = s.products.find((x) => x.id === productId);
    if (!p || !p.enabled) throw Error("商品已下架或不存在");
    validateProduct(p, s);
    let sub: Product | undefined;
    let tokens = 0;
    const features: string[] = [];
    const included: string[] = [];
    if (p.kind === "subscription") {
      sub = p;
      tokens = p.tokens;
      included.push(...p.capabilityIds);
    }
    if (p.kind === "tokens") tokens = p.tokens;
    if (p.kind === "feature") {
      features.push(...p.capabilityIds);
      included.push(...p.capabilityIds);
    }
    if (p.kind === "bundle") {
      const parts = [
        p.subscriptionId,
        p.tokenProductId,
        ...(p.featureProductIds || []),
      ]
        .filter(Boolean)
        .map((id) => s.products.find((x) => x.id === id));
      if (parts.some((x) => !x?.enabled))
        throw Error("套餐内有商品已下架，请联系平台调整配置");
      for (const part of parts) {
        if (!part) throw Error("套餐配置不完整");
        validateProduct(part, s);
        if (part.kind === "subscription") {
          sub = part;
          tokens += part.tokens;
          included.push(...part.capabilityIds);
        }
        if (part.kind === "tokens") tokens += part.tokens;
        if (part.kind === "feature") {
          features.push(...part.capabilityIds);
          included.push(...part.capabilityIds);
        }
      }
    }
    if (sub && s.account.subscriptionId)
      throw Error("已有订阅，本版未开放续订或替换；请从购买演示起点体验");
    if (features.some((id) => s.account.featureIds.includes(id)))
      throw Error("已购买此功能，本版不支持重复购买或套餐折价");
    if (
      features.length &&
      features.every((id) =>
        s.products
          .find((x) => x.id === s.account.subscriptionId)
          ?.capabilityIds.includes(id),
      )
    )
      throw Error("当前订阅已包含此功能，无需重复购买");
    safeAmount(s.account.balance + tokens, "累计额度");
    const orderId = uid();
    if (sub) {
      s.account.subscriptionId = sub.id;
      s.account.subscriptionAt = Date.now();
    }
    s.account.featureIds = [...new Set([...s.account.featureIds, ...features])];
    s.account.balance += tokens;
    s.orders.unshift({
      id: orderId,
      productId: p.id,
      name: p.name,
      kind: p.kind,
      price: p.price,
      createdAt: Date.now(),
      tokens,
      capabilityIds: [...new Set(included)],
    });
    if (tokens)
      s.ledger.unshift({
        id: uid(),
        amount: tokens,
        balance: s.account.balance,
        reason: `模拟购买 · ${p.name}`,
        createdAt: Date.now(),
        orderId,
      });
  });
}
export async function resetDemo(mode: "business" | "purchase") {
  await mutate((s) => {
    const revision = s.revision;
    Object.assign(s, seed(mode), { revision });
  });
  inflight.clear();
}

export async function sendChat(agentId: AgentId, text: string) {
  await mutate((s) => {
    const cleaned = validText(text, "消息", 2000);
    s.messages.push(message(agentId, "user", cleaned));
    if (agentId === "control") {
      const allowed = accessFor("control-plan", s);
      if (!allowed.allowed) {
        s.messages.push(message(agentId, "control", allowed.reason));
        return;
      }
      if (/汇总|进展|任务|结果|完成/.test(cleaned)) {
        const done = s.tasks.filter((t) => t.status === "success");
        const activities = done.filter(
          (t) => t.agentId === "growth" && t.result?.adopted,
        ).length;
        const sent = done.filter(
          (t) => t.agentId === "customer" && t.result?.sent,
        );
        const arrivals = new Set(
          sent.flatMap((t) => t.result?.arrivedIds || []),
        ).size;
        s.messages.push(
          message(
            agentId,
            "control",
            `当前已完成 ${done.length} 项生成任务，采用 ${activities} 个活动，执行 ${sent.length} 批模拟邀约，记录 ${arrivals} 位模拟到店。你可以打开工作面板查看各板块；所有结果均来自本地模拟记录。`,
          ),
        );
        return;
      }
      if (/到店|活动|邀约|护理|经营|引流|老客|提升|增加/.test(cleaned)) {
        const plan = {
          id: uid(),
          title: cleaned,
          confirmed: false,
          createdAt: Date.now(),
          taskIds: [],
        };
        s.plans.push(plan);
        s.messages.push(
          message(
            "control",
            "control",
            "建议先做一份目标清晰的体验活动，再由客户经营助手引用活动、邀约合适的老客。确认行动后，我会把两项工作分别带入对应会话；具体内容仍由你审核。",
            { planId: plan.id },
          ),
        );
        return;
      }

      s.messages.push(
        message(
          agentId,
          "control",
          "本演示支持经营目标梳理和任务进展汇总。可以试试“这周想增加到店，先做护理体验活动，再邀约老客”，或打开工作面板查看已有记录。",
        ),
      );
      return;
    }
    const coord = /@总控|@总控助手|总控.*(汇总|协调|进展)/.test(cleaned);
    if (coord) {
      const count = s.tasks.filter(
        (t) => t.agentId === agentId && t.status === "success",
      ).length;
      s.messages.push(
        message(
          agentId,
          "control",
          `我已查看本板块的任务摘要，目前完成 ${count} 项生成任务。引流活动确认采用后，客户经营助手就可以引用该活动继续邀约。`,
        ),
      );
      return;
    }
    const relevant: Record<AgentId, RegExp> = {
      control: /.*/,
      recruit: /招聘|岗位|美容师|文案|招人/,
      growth: /活动|引流|到店|护理|方案/,
      operations: /待办|运营|今天|任务|安排/,
      customer: /客户|邀约|老客|活动|关怀/,
      video: /视频|脚本|分镜|拍摄|主题/,
    };
    s.messages.push(
      message(
        agentId,
        agentId,
        relevant[agentId].test(cleaned)
          ? "收到。请点击下方功能入口补充本次需求，我会生成可编辑的内容。提交前会显示模拟消耗；不会自动执行付费任务。"
          : "这个问题暂不在本模块的模拟范围内。请通过加号中的功能入口继续，或到总控助手整理经营目标。",
      ),
    );
  });
}
export async function confirmPlan(planId: string) {
  await mutate((s) => {
    const access = accessFor("control-plan", s);
    if (!access.allowed) throw Error(access.reason);
    const p = s.plans.find((x) => x.id === planId);
    if (!p) throw Error("行动建议不存在");
    if (p.confirmed) return;
    p.confirmed = true;
    s.messages.push(
      message(
        "control",
        "control",
        "行动已确认：先在获客引流中生成并采用活动，再到客户经营引用该活动生成邀约。点击下方入口即可继续。",
        { planId },
      ),
    );
    s.messages.push(
      message(
        "growth",
        "control",
        "这次目标是提升到店量。请先补充服务项目、周期和优惠约束，生成活动方案；采用后交给客户经营助手。",
        { planId },
      ),
    );
    s.messages.push(
      message(
        "customer",
        "control",
        "收到老客邀约行动。请等待引流活动确认采用，再选择客户分组生成邀约内容。",
        { planId },
      ),
    );
  });
}

function validateInput(
  agentId: AgentId,
  input: Record<string, string>,
  s: AppState,
) {
  if (agentId === "control") throw Error("请在总控会话中发送经营目标");
  if (agentId === "growth") {
    validText(input.project || "", "服务项目", 80);
    validText(input.period || "", "活动周期", 80);
  }
  if (agentId === "recruit") validText(input.role || "", "招聘岗位", 80);
  if (agentId === "video") validText(input.title || "", "视频主题", 100);
  if (agentId === "customer") {
    const activity = s.tasks.find(
      (t) =>
        t.id === input.activityId &&
        t.agentId === "growth" &&
        t.status === "success" &&
        t.result?.adopted,
    );
    if (!activity) throw Error("请先采用一份引流活动，再生成客户邀约");
    if (!s.customers.some((c) => c.group === input.group))
      throw Error("请选择有效客户分组");
  }
  for (const text of Object.values(input)) {
    if (text.length > 3000) throw Error("输入内容过长，请缩短后重试");
  }
}
export function runTask(
  agentId: AgentId,
  input: Record<string, string>,
  options?: { fail?: boolean; planId?: string },
): Promise<string> {
  const key = JSON.stringify([agentId, input, options?.planId]);
  const active = inflight.get(key);
  if (active) return active;
  const job = executeTask(agentId, input, options).finally(() => {
    if (inflight.get(key) === job) inflight.delete(key);
  });
  inflight.set(key, job);
  return job;
}
async function executeTask(
  agentId: AgentId,
  input: Record<string, string>,
  options?: { fail?: boolean; planId?: string },
) {
  let taskId = "";
  let resetId = "";
  await mutate((s) => {
    const capability = s.capabilities.find((c) => c.agentId === agentId);
    if (!capability) throw Error("功能不存在");
    const access = accessFor(capability.id, s);
    if (!access.allowed) throw Error(access.reason);
    validateInput(agentId, input, s);
    if (
      s.tasks.some(
        (t) =>
          t.status === "running" &&
          t.agentId === agentId &&
          JSON.stringify(t.input) === JSON.stringify(input),
      )
    )
      throw Error("同一任务正在生成，请等待结果");
    taskId = uid();
    resetId = s.resetId;
    const linkedPlan =
      options?.planId || [...s.plans].reverse().find((p) => p.confirmed)?.id;
    const task: Task = {
      id: taskId,
      agentId,
      capabilityId: capability.id,
      title: capability.name,
      status: "running",
      input: clone(input),
      cost: capability.cost,
      createdAt: Date.now(),
      ownerId,
      planId: linkedPlan,
    };
    s.tasks.push(task);
    const plan = s.plans.find((p) => p.id === linkedPlan);
    if (plan) plan.taskIds.push(taskId);
    s.messages.push(
      message(
        agentId,
        "user",
        `生成${capability.name} · 预计模拟消耗 ${capability.cost.toLocaleString("en-US")} Token`,
      ),
    );
    s.messages.push(
      message(agentId, agentId, `正在整理${capability.name}…`, {
        taskId,
        planId: linkedPlan,
      }),
    );
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await mutate((s) => {
    if (s.resetId !== resetId) return;
    const task = s.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "running") return;
    const fail = (reason: string) => {
      task.status = "failed";
      task.error = reason;
      const m = s.messages.find((x) => x.taskId === taskId);
      if (m) m.text = `生成失败：${reason}。未扣除 Token，可重试。`;
    };
    if (options?.fail) {
      fail("模拟服务暂时繁忙");
      return;
    }
    const access = accessFor(task.capabilityId, s);
    if (access.kind === "platform" || access.kind === "membership") {
      fail(access.reason);
      return;
    }
    if (s.account.balance < task.cost) {
      fail("Token 额度不足");
      return;
    }
    try {
      validateInput(agentId, input, s);
    } catch (error) {
      fail(error instanceof Error ? error.message : "输入条件发生变化");
      return;
    }
    task.result = buildResult(agentId, input, s);
    task.status = "success";
    s.account.balance -= task.cost;
    if (task.cost)
      s.ledger.unshift({
        id: uid(),
        amount: -task.cost,
        balance: s.account.balance,
        reason: `模拟消耗 · ${task.title}`,
        createdAt: Date.now(),
        taskId,
      });
    const m = s.messages.find((x) => x.taskId === taskId);
    if (m)
      m.text = `${task.result.title}已生成，请查看并编辑。${agentId === "growth" ? "确认采用后，客户经营可引用此活动。" : ""}`;
  });
  return taskId;
}
function resultTask(
  s: AppState,
  id: string,
  agentId?: AgentId,
): Task & { result: BusinessResult } {
  const task = s.tasks.find((t) => t.id === id);
  if (
    !task ||
    task.status !== "success" ||
    !task.result ||
    (agentId && task.agentId !== agentId)
  )
    throw Error("可操作的结果不存在");
  return task as Task & { result: BusinessResult };
}
export async function saveResult(taskId: string, body: string) {
  await mutate((s) => {
    const t = resultTask(s, taskId);
    if (t.result.adopted || t.result.sent)
      throw Error("内容已确认，不能修改已采用活动或已触达邀约");
    t.result.body = validText(body, "内容", 20000);
  });
}
export async function adoptActivity(taskId: string) {
  await mutate((s) => {
    const t = resultTask(s, taskId, "growth");
    if (t.result.adopted) return;
    const a = accessFor(t.capabilityId, s);
    if (a.kind === "platform" || a.kind === "membership") throw Error(a.reason);
    t.result.adopted = true;
    s.messages.push(
      message(
        "growth",
        "growth",
        "活动已采用。可以前往客户经营，引用这份方案生成老客邀约。",
        { taskId },
      ),
    );
  });
}
export async function sendInvitation(taskId: string) {
  await mutate((s) => {
    const t = resultTask(s, taskId, "customer");
    if (t.result.sent) return;
    const a = accessFor(t.capabilityId, s);
    if (a.kind === "platform" || a.kind === "membership") throw Error(a.reason);
    const activity = s.tasks.find(
      (x) => x.id === t.result.activityId && x.result?.adopted,
    );
    if (!activity) throw Error("关联活动不可用，请重新生成邀约");
    const ids = t.result.customerIds || [];
    if (!ids.length) throw Error("邀约未包含客户");
    t.result.sent = true;
    t.result.feedbackIds = ids.filter((_, i) => i % 2 === 0);
    t.result.arrivedIds = [];
    s.messages.push(
      message(
        "customer",
        "customer",
        `已完成 ${ids.length} 位客户的模拟触达，${t.result.feedbackIds.length} 位有模拟反馈。尚未发送任何真实消息；可在详情中登记模拟到店。`,
        { taskId },
      ),
    );
  });
}
export async function markArrival(taskId: string, customerId: string) {
  await mutate((s) => {
    const t = resultTask(s, taskId, "customer");
    if (!t.result.sent || !t.result.feedbackIds?.includes(customerId))
      throw Error("请先完成模拟触达，并选择已有反馈的客户");
    t.result.arrivedIds = [
      ...new Set([...(t.result.arrivedIds || []), customerId]),
    ];
  });
}
export async function toggleTodo(taskId: string, todoId: string) {
  await mutate((s) => {
    const t = resultTask(s, taskId, "operations");
    const todo = t.result.todos?.find((x) => x.id === todoId);
    if (!todo) throw Error("待办不存在");
    todo.done = !todo.done;
  });
}
