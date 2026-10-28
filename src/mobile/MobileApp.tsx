import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Checkbox,
  Dialog,
  Form,
  Input,
  List,
  Popup,
  Tabs,
  TextArea,
  Toast,
} from "antd-mobile";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  AudioOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  CrownOutlined,
  ExpandOutlined,
  FileTextOutlined,
  LeftOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  AGENTS,
  agentById,
  exactTokens,
  formatTokens,
} from "../shared/catalog";
import type {
  AgentId,
  AppState,
  Product,
  ProductKind,
  Task,
} from "../shared/types";
import {
  accessFor,
  adoptActivity,
  confirmPlan,
  markArrival,
  purchase,
  resetDemo,
  runTask,
  saveProfile,
  saveResult,
  sendChat,
  sendInvitation,
  toggleTodo,
  useApp,
} from "../shared/store";
import "./mobile.css";

const iconMap: Record<AgentId, ReactNode> = {
  control: <AppstoreOutlined />,
  recruit: <TeamOutlined />,
  growth: <ThunderboltOutlined />,
  operations: <CheckOutlined />,
  customer: <MessageOutlined />,
  video: <FileTextOutlined />,
};
const statusLabels = {
  running: "正在生成",
  success: "已完成",
  failed: "执行失败",
  interrupted: "已中断",
};
const kindLabels: Record<ProductKind, string> = {
  subscription: "订阅",
  tokens: "额度",
  feature: "功能",
  bundle: "套餐",
};
const time = (n: number) =>
  new Date(n).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const date = (n: number) =>
  new Date(n).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
async function act(fn: () => Promise<unknown>, success?: string) {
  try {
    await fn();
    if (success) Toast.show({ content: success });
    return true;
  } catch (e) {
    Toast.show({
      content: e instanceof Error ? e.message : "操作未完成，请重试",
      duration: 2800,
    });
    return false;
  }
}
function Avatar({ id, size = "normal" }: { id: AgentId; size?: string }) {
  const a = agentById(id);
  return (
    <span
      className={`m-avatar ${size}`}
      style={{ "--avatar-color": a.color } as CSSProperties}
    >
      {iconMap[id]}
    </span>
  );
}
function Header({
  title,
  back = true,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <header className="m-header">
      {back ? (
        <button
          className="m-icon"
          aria-label="返回"
          onClick={() =>
            window.history.state?.idx > 0 ? nav(-1) : nav("/app")
          }
        >
          <ArrowLeftOutlined />
        </button>
      ) : (
        <span className="m-brand-mark">禾</span>
      )}
      <h1>{title}</h1>
      <div className="m-header-action">{right || <span />}</div>
    </header>
  );
}
function Empty({
  title = "这里还没有记录",
  description = "完成一次任务后，相关记录会保存在这里。",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="m-empty">
      <span className="m-empty-icon">
        <FileTextOutlined />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Pill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`m-pill ${tone}`}>{children}</span>;
}
function DemoNote() {
  return (
    <div className="m-demo-note">
      <span className="m-dot" />
      交互演示 · 数据与执行结果均为模拟
    </div>
  );
}
function BottomNav({ selected }: { selected: string }) {
  const nav = useNavigate();
  return (
    <nav className="m-bottom-nav" aria-label="主导航">
      {[
        { id: "work", path: "/app", title: "工作", icon: <MessageOutlined /> },
        {
          id: "data",
          path: "/app/data",
          title: "数据总览",
          icon: <BarChartOutlined />,
        },
        {
          id: "mine",
          path: "/app/mine",
          title: "我的",
          icon: <UserOutlined />,
        },
      ].map((n) => (
        <button
          key={n.id}
          className={selected === n.id ? "active" : ""}
          onClick={() => nav(n.path)}
        >
          {n.icon}
          <span>{n.title}</span>
          {selected === n.id && <i />}
        </button>
      ))}
    </nav>
  );
}
function TokenCard({
  state,
  compact = false,
}: {
  state: AppState;
  compact?: boolean;
}) {
  const nav = useNavigate();
  const used = state.ledger
    .filter((l) => l.amount < 0)
    .reduce((n, l) => n - l.amount, 0);
  const sub = state.products.find((p) => p.id === state.account.subscriptionId);
  return (
    <section className={`m-token-card ${compact ? "compact" : ""}`}>
      <div className="m-token-top">
        <span>
          <ThunderboltOutlined /> 可用 Token
        </span>
        <Pill tone="light">{sub ? "订阅中" : "未订阅"}</Pill>
      </div>
      <button
        className="m-token-number"
        onClick={() => nav("/app/ledger")}
        aria-label="查看完整额度与流水"
      >
        {formatTokens(state.account.balance)}
        <RightOutlined />
      </button>
      <div className="m-token-exact">
        {exactTokens(state.account.balance)} Token
      </div>
      <div className="m-token-bottom">
        <span>
          {sub?.name || "按需开启你的经营能力"}
          <small>已用 {exactTokens(used)} Token · 模拟</small>
        </span>
        <button onClick={() => nav("/app/purchase")}>
          补充额度 <PlusOutlined />
        </button>
      </div>
    </section>
  );
}
function Work({ state }: { state: AppState }) {
  const nav = useNavigate();
  const count = state.tasks.filter((t) => t.status === "success").length;
  return (
    <>
      <Header
        title="青禾工作台"
        back={false}
        right={
          <button
            className="m-icon"
            aria-label="查看演示说明"
            onClick={() =>
              Dialog.alert({
                title: "青禾 · 美业 Agent",
                content:
                  "这是个人版交互 Mock。可体验经营任务、双端配置和模拟购买。所有数据保存在当前浏览器，不会向真实客户发送消息。",
                confirmText: "知道了",
              })
            }
          >
            <MoreOutlined />
          </button>
        }
      />
      <main className="m-scroll">
        <section className="m-work-hero">
          <div className="m-eyebrow">让经营，有条不紊</div>
          <h2>
            {state.account.name}，今天也一起
            <br />
            把门店照顾好。
          </h2>
          <p>
            {state.account.storeName} <span>·</span>{" "}
            {count ? `已完成 ${count} 项工作` : "你的 6 位经营助手已就位"}
          </p>
          <span className="m-hero-art">
            <span />
            <span />
            <span />禾
          </span>
        </section>
        <div className="m-section-title">
          <h2>
            我的助手 <span>06</span>
          </h2>
          <span>各司其职，协同工作</span>
        </div>
        <section className="m-conversations">
          {AGENTS.map((a) => {
            const msgs = state.messages.filter((m) => m.agentId === a.id);
            const last = msgs.at(-1);
            const running = state.tasks.some(
              (t) => t.agentId === a.id && t.status === "running",
            );
            return (
              <button
                className={`m-conversation ${a.id === "control" ? "control" : ""}`}
                key={a.id}
                onClick={() => nav(`/app/chat/${a.id}`)}
              >
                <Avatar id={a.id} />
                <span className="m-conversation-copy">
                  <span className="m-conversation-name">
                    {a.name}
                    {a.id === "control" && <Pill>总控</Pill>}
                  </span>
                  <span className="m-conversation-preview">
                    {running ? "正在为你整理…" : last?.text || a.description}
                  </span>
                </span>
                <span className="m-conversation-meta">
                  {last ? time(last.createdAt) : <RightOutlined />}
                  {running && <i />}
                </span>
              </button>
            );
          })}
        </section>
        <div className="m-hint-card">
          <span className="m-hint-icon">
            <ThunderboltOutlined />
          </span>
          <div>
            <strong>一个目标，几个助手一起完成</strong>
            <p>从总控开始，让获客与客户经营自然衔接。</p>
          </div>
        </div>
        <DemoNote />
      </main>
      <BottomNav selected="work" />
    </>
  );
}
function Stats({
  state,
  compact = false,
}: {
  state: AppState;
  compact?: boolean;
}) {
  const invites = state.tasks.filter((t) => t.result?.sent);
  const touch = new Set(invites.flatMap((t) => t.result?.customerIds || []))
    .size;
  const feedback = new Set(invites.flatMap((t) => t.result?.feedbackIds || []))
    .size;
  const arrived = new Set(invites.flatMap((t) => t.result?.arrivedIds || []))
    .size;
  const activities = state.tasks.filter(
    (t) => t.agentId === "growth" && t.result?.adopted,
  ).length;
  return (
    <div className={`m-stats ${compact ? "compact" : ""}`}>
      {[
        { label: "已采用活动", value: activities, unit: "场" },
        { label: "模拟触达", value: touch, unit: "人" },
        { label: "客户反馈", value: feedback, unit: "人" },
        { label: "模拟到店", value: arrived, unit: "人" },
      ].map((s) => (
        <div className="m-stat" key={s.label}>
          <span>{s.label}</span>
          <strong>
            {s.value}
            <small>{s.unit}</small>
          </strong>
        </div>
      ))}
    </div>
  );
}
function DataPage({ state }: { state: AppState }) {
  const nav = useNavigate();
  return (
    <>
      <Header title="数据总览" back={false} />
      <main className="m-scroll m-page-pad">
        <div className="m-page-intro">
          <Pill>本轮演示</Pill>
          <h2>每一步行动，都有回响</h2>
          <p>从经营任务到客户反馈，看见工作的进展。</p>
        </div>
        <Stats state={state} />
        <section className="m-white-card">
          <div className="m-section-title">
            <h3>各助手工作进展</h3>
            <span>实时同步</span>
          </div>
          {AGENTS.slice(1).map((a) => {
            const tasks = state.tasks.filter((t) => t.agentId === a.id);
            const completed = tasks.filter(
              (t) => t.status === "success",
            ).length;
            return (
              <button
                className="m-progress-row"
                key={a.id}
                onClick={() => nav(`/app/chat/${a.id}`)}
              >
                <Avatar id={a.id} size="small" />
                <div>
                  <strong>{a.name}</strong>
                  <div className="m-progress-track">
                    <span
                      style={{
                        width: tasks.length
                          ? `${(completed / tasks.length) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
                <span>
                  {completed} / {tasks.length}
                </span>
                <RightOutlined />
              </button>
            );
          })}
        </section>
        <section className="m-white-card">
          <h3>最近工作</h3>
          {state.tasks.length ? (
            state.tasks
              .slice()
              .reverse()
              .slice(0, 5)
              .map((t) => <TaskRow task={t} key={t.id} />)
          ) : (
            <Empty
              title="等待第一项行动"
              description="与总控聊聊经营目标，开始你的第一项任务。"
              action={
                <Button
                  color="primary"
                  size="small"
                  onClick={() => nav("/app/chat/control")}
                >
                  找总控聊聊
                </Button>
              }
            />
          )}
        </section>
        <p className="m-footnote">
          统计来自本轮模拟活动、邀约和到店记录，不代表真实经营成效。
        </p>
      </main>
      <BottomNav selected="data" />
    </>
  );
}
function Mine({ state }: { state: AppState }) {
  const nav = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);
  const reset = async (mode: "business" | "purchase") => {
    const yes = await Dialog.confirm({
      title: "重置本轮演示？",
      content: "这会清除当前会话、任务、购买记录及 PC 配置修改，恢复初始数据。",
      confirmText: "确认重置",
      cancelText: "保留当前数据",
    });
    if (yes && (await act(() => resetDemo(mode), "已恢复演示起点"))) {
      setResetOpen(false);
      nav("/app");
    }
  };
  return (
    <>
      <Header title="我的" back={false} />
      <main className="m-scroll m-page-pad">
        <button className="m-profile" onClick={() => nav("/app/profile")}>
          <span className="m-user-avatar">
            {state.account.name.slice(0, 1)}
          </span>
          <span>
            <strong>{state.account.name}</strong>
            <small>{state.account.storeName} · 个人版</small>
          </span>
          <RightOutlined />
        </button>
        <TokenCard state={state} />
        <div className="m-setting-list">
          <List>
            <List.Item
              prefix={<UserOutlined />}
              onClick={() => nav("/app/profile")}
            >
              个人资料
            </List.Item>
            <List.Item
              prefix={<CrownOutlined />}
              onClick={() => nav("/app/purchase")}
            >
              订阅与购买
            </List.Item>
            <List.Item
              prefix={<FileTextOutlined />}
              onClick={() => nav("/app/orders")}
            >
              购买记录
            </List.Item>
            <List.Item
              prefix={<ThunderboltOutlined />}
              onClick={() => nav("/app/ledger")}
            >
              额度明细
            </List.Item>
          </List>
        </div>
        <div className="m-setting-list">
          <List>
            <List.Item
              prefix={<SettingOutlined />}
              onClick={() => setResetOpen(true)}
            >
              重置演示数据
            </List.Item>
            <List.Item
              prefix={<AppstoreOutlined />}
              onClick={() =>
                window.open(
                  `${window.location.pathname}#/admin`,
                  "_blank",
                  "noopener",
                )
              }
            >
              打开 PC 服务配置端
            </List.Item>
          </List>
        </div>
        <DemoNote />
        <p className="m-footnote">
          青禾 · 美业 Agent 工作台
          <br />
          Leonard 作品演示
        </p>
      </main>
      <BottomNav selected="mine" />
      <Popup
        visible={resetOpen}
        onMaskClick={() => setResetOpen(false)}
        onClose={() => setResetOpen(false)}
        bodyClassName="m-popup"
      >
        <div className="m-popup-head">
          <h3>选择演示起点</h3>
          <button
            className="m-icon"
            aria-label="关闭"
            onClick={() => setResetOpen(false)}
          >
            <CloseOutlined />
          </button>
        </div>
        <p className="m-muted">
          两种起点使用同一个演示账号，重置会恢复所有配置。
        </p>
        <button className="m-scenario" onClick={() => reset("business")}>
          <strong>
            经营演示 <Pill>推荐</Pill>
          </strong>
          <span>已有订阅 · 3B Token · 从经营主线开始</span>
          <RightOutlined />
        </button>
        <button className="m-scenario" onClick={() => reset("purchase")}>
          <strong>购买演示</strong>
          <span>未订阅 · 0 Token · 体验订阅与固定套餐</span>
          <RightOutlined />
        </button>
      </Popup>
    </>
  );
}
function TaskRow({ task }: { task: Task }) {
  const nav = useNavigate();
  return (
    <button className="m-task-row" onClick={() => nav(`/app/task/${task.id}`)}>
      <Avatar id={task.agentId} size="small" />
      <span>
        <strong>{task.result?.title || task.title}</strong>
        <small>{date(task.createdAt)}</small>
      </span>
      <Pill
        tone={
          task.status === "failed"
            ? "red"
            : task.status === "running"
              ? "amber"
              : "green"
        }
      >
        {statusLabels[task.status]}
      </Pill>
      <RightOutlined />
    </button>
  );
}
function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <button className="m-chat-task" onClick={onOpen}>
      <span className="m-chat-task-top">
        <span>
          <FileTextOutlined /> {task.result?.title || task.title}
        </span>
        <Pill
          tone={
            task.status === "failed"
              ? "red"
              : task.status === "running"
                ? "amber"
                : "green"
          }
        >
          {task.result?.adopted
            ? "已采用"
            : task.result?.sent
              ? "已模拟触达"
              : statusLabels[task.status]}
        </Pill>
      </span>
      <span className="m-chat-task-body">
        {task.status === "running"
          ? "正在整理内容，请稍候…"
          : task.error || task.result?.body?.slice(0, 95) || "打开查看任务详情"}
      </span>
      <span className="m-chat-task-bottom">
        {task.status === "success"
          ? `模拟消耗 ${exactTokens(task.cost)} Token`
          : "失败或中断不扣额度"}
        <span>
          查看详情 <RightOutlined />
        </span>
      </span>
    </button>
  );
}

function Chat({ state, id }: { state: AppState; id: AgentId }) {
  const nav = useNavigate();
  const a = agentById(id);
  const [draft, setDraft] = useState("");
  const [features, setFeatures] = useState(false);
  const [sending, setSending] = useState(false);
  const [panel, rawSetPanel] = useState<"dock" | "overview" | "full">("dock");
  const panelElement = useRef<HTMLElement>(null);
  const panelBefore = useRef<DOMRect | null>(null);
  const panelAnimation = useRef<Animation | null>(null);
  const panelGhost = useRef<HTMLElement | null>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  const boardPositions = useRef<Record<number, number>>({});
  const [board, setBoard] = useState(
    id === "control" ? 0 : AGENTS.slice(1).findIndex((a) => a.id === id),
  );
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [newMessages, setNewMessages] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const touch = useRef({ x: 0, y: 0 });
  const messages = state.messages.filter((m) => m.agentId === id);
  const capabilities = state.capabilities.filter((c) => c.agentId === id);
  const current = AGENTS.slice(1)[Math.max(0, board)];
  const boardTasks = state.tasks.filter((t) => t.agentId === current.id);
  const ownTasks = state.tasks.filter((t) => t.agentId === id);
  const unread = AGENTS.slice(1).some(
    (a) =>
      (seen[a.id] || 0) <
      state.tasks
        .filter((t) => t.agentId === a.id)
        .reduce(
          (sum, t) =>
            sum +
            (t.status === "success" ? 1 : 0) +
            (t.result?.adopted ? 1 : 0) +
            (t.result?.sent ? 1 : 0) +
            (t.result?.arrivedIds?.length || 0),
          0,
        ),
  );
  const setPanel = (next: "dock" | "overview" | "full") => {
    if (next === panel) return;
    panelAnimation.current?.cancel();
    panelGhost.current?.remove();
    panelGhost.current = null;
    const el = panelElement.current;
    if (el) el.style.visibility = "";
    if (panel === "full" && panelBody.current)
      boardPositions.current[board] = panelBody.current.scrollTop;
    panelBefore.current = el?.getBoundingClientRect() || null;
    const sizes = { dock: 0, overview: 1, full: 2 };
    if (
      el &&
      sizes[next] < sizes[panel] &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Shrink the previous panel, never scale up the newly mounted dock content.
      const rect = el.getBoundingClientRect(),
        parent = el.parentElement!,
        parentRect = parent.getBoundingClientRect();
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.setAttribute("aria-hidden", "true");
      ghost.setAttribute("inert", "");
      ghost.classList.add("m-panel-ghost");
      Object.assign(ghost.style, {
        position: "absolute",
        left: `${rect.left - parentRect.left}px`,
        top: `${rect.top - parentRect.top}px`,
        right: "auto",
        bottom: "auto",
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        maxWidth: "none",
        maxHeight: "none",
        pointerEvents: "none",
        zIndex: "10",
        transform: "none",
        visibility: "visible",
      });
      parent.appendChild(ghost);
      const cloneBody = ghost.querySelector<HTMLElement>(".m-panel-body");
      if (cloneBody && panelBody.current)
        cloneBody.scrollTop = panelBody.current.scrollTop;
      panelGhost.current = ghost;
    }
    rawSetPanel(next);
  };
  useLayoutEffect(() => {
    const el = panelElement.current,
      previous = panelBefore.current;
    if (panelBody.current)
      panelBody.current.scrollTop =
        panel === "full" ? boardPositions.current[board] || 0 : 0;
    if (
      !el ||
      !previous ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      panelGhost.current?.remove();
      panelGhost.current = null;
      return;
    }
    const current = el.getBoundingClientRect(),
      ghost = panelGhost.current;
    if (ghost) {
      el.style.visibility = "hidden";
      const end = `translate(${current.right - previous.right}px,${current.bottom - previous.bottom}px) scale(${current.width / previous.width},${current.height / previous.height})`;
      const animation = ghost.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: end, opacity: 0.15 },
        ],
        { duration: 340, easing: "cubic-bezier(.3,0,.18,1)" },
      );
      animation.onfinish = () => {
        ghost.remove();
        if (panelGhost.current === ghost) panelGhost.current = null;
        el.style.visibility = "";
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 70 });
      };
      panelAnimation.current = animation;
    } else {
      const start = `translate(${previous.right - current.right}px,${previous.bottom - current.bottom}px) scale(${previous.width / current.width},${previous.height / current.height})`;
      panelAnimation.current = el.animate(
        [
          {
            transform: start,
            opacity: 0.85,
            offset: 0,
            easing: "cubic-bezier(.16,.8,.22,1)",
          },
          {
            transform: "scale(1.01)",
            opacity: 1,
            offset: 0.67,
            easing: "ease-in-out",
          },
          { transform: "scale(.998)", offset: 0.86, easing: "ease-out" },
          { transform: "scale(1)", offset: 1 },
        ],
        { duration: 560, easing: "linear" },
      );
    }
    panelBefore.current = null;
  }, [panel]);
  useEffect(
    () => () => {
      panelAnimation.current?.cancel();
      panelGhost.current?.remove();
    },
    [],
  );
  const openPanel = (next: "dock" | "overview" | "full") => {
    setPanel(next);
    if (next !== "dock") markBoard(board);
  };
  const markBoard = (index: number) => {
    const selected = AGENTS.slice(1)[index];
    if (selected)
      setSeen((v) => ({
        ...v,
        [selected.id]: state.tasks
          .filter((t) => t.agentId === selected.id)
          .reduce(
            (sum, t) =>
              sum +
              (t.status === "success" ? 1 : 0) +
              (t.result?.adopted ? 1 : 0) +
              (t.result?.sent ? 1 : 0) +
              (t.result?.arrivedIds?.length || 0),
            0,
          ),
      }));
  };
  const turn = (step: number) => {
    if (id !== "control") return;
    if (panel === "full" && panelBody.current)
      boardPositions.current[board] = panelBody.current.scrollTop;
    const next = (board + step + 5) % 5;
    setBoard(next);
    markBoard(next);
    requestAnimationFrame(() => {
      const el = panelBody.current;
      if (!el) return;
      el.scrollTop = panel === "full" ? boardPositions.current[next] || 0 : 0;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        el.animate(
          [
            { transform: `translateX(${step * 15}px)`, opacity: 0.5 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 190, easing: "ease-out" },
        );
    });
  };
  useEffect(() => {
    if (follow.current) {
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: "smooth",
      });
      setNewMessages(false);
    } else setNewMessages(true);
  }, [
    messages.length,
    state.tasks.map((t) => t.status).join(),
    state.plans.map((p) => p.confirmed).join(),
  ]);
  const send = async () => {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    follow.current = true;
    setPanel("dock");
    setFeatures(false);
    if (await act(() => sendChat(id, text))) setDraft("");
    setSending(false);
  };
  const openFeature = (capId: string) => {
    const access = accessFor(capId, state);
    if (!access.allowed) {
      if (access.kind === "membership" || access.kind === "balance") {
        Dialog.confirm({
          title:
            access.kind === "membership" ? "此功能尚未开通" : "Token 额度不足",
          content: access.reason,
          confirmText: "查看购买",
          cancelText: "稍后再说",
        }).then((ok) => ok && nav("/app/purchase"));
      } else Toast.show(access.reason);
      return;
    }
    setFeatures(false);
    if (id === "control") {
      setDraft(
        draft
          ? `${draft} 帮我制定提升到店量的行动计划。`
          : "这周想增加到店，先做护理体验活动，再邀约老客。",
      );
      input.current?.focus();
    } else nav(`/app/form/${id}`);
  };
  return (
    <>
      <Header
        title={a.name}
        right={
          <button
            className="m-icon"
            aria-label="会话更多"
            onClick={() =>
              Dialog.show({
                title: a.name,
                content: (
                  <p>
                    {a.description}
                    。业务会话由对应助手回复，总控在协调与汇总时介入。
                  </p>
                ),
                closeOnAction: true,
                actions: [
                  {
                    key: "tasks",
                    text: "查看工作面板",
                    onClick: () => openPanel("full"),
                  },
                  { key: "cancel", text: "关闭" },
                ],
              })
            }
          >
            <MoreOutlined />
          </button>
        }
      />
      <div
        className="m-chat-stage"
        style={
          {
            "--wallpaper": `url(${import.meta.env.BASE_URL}assets/backgrounds/telegram-pattern.svg)`,
          } as CSSProperties
        }
        onClick={(e) => {
          if (
            panel === "overview" &&
            !(e.target as HTMLElement).closest(".m-work-panel")
          )
            setPanel("dock");
        }}
      >
        <div
          className="m-messages"
          ref={scroll}
          onScroll={() => {
            const el = scroll.current;
            if (el)
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 90;
          }}
        >
          <div className="m-chat-date">今天 · 模拟会话</div>
          {!messages.length && (
            <div className="m-agent-message">
              <Avatar id={id} size="tiny" />
              <div>
                <span className="m-message-sender">{a.sender}</span>
                <div className="m-bubble">
                  {id === "control"
                    ? "你好，我是你的总控助手。告诉我一个经营目标，我帮你拆成可以执行的行动。"
                    : `你好，我是${a.sender}。${a.description}。点击下方功能，或先告诉我你的需求。`}
                  <small>{time(Date.now())}</small>
                </div>
              </div>
            </div>
          )}
          {id === "control" && messages.length <= 1 && (
            <button
              className="m-prompt-chip"
              onClick={() =>
                setDraft("这周想增加到店，先做护理体验活动，再邀约老客。")
              }
            >
              <ThunderboltOutlined /> 帮我安排本周到店提升计划 <RightOutlined />
            </button>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.sender === "user" ? "m-user-message" : "m-agent-message"
              }
            >
              {m.sender !== "user" && <Avatar id={m.sender} size="tiny" />}
              <div>
                {m.sender !== "user" && (
                  <span className="m-message-sender">
                    {agentById(m.sender).sender}
                  </span>
                )}
                <div className="m-bubble">
                  {m.text}
                  <small>{time(m.createdAt)}</small>
                </div>
                {m.planId &&
                  id === "control" &&
                  messages.find((x) => x.planId === m.planId)?.id === m.id &&
                  (() => {
                    const p = state.plans.find((p) => p.id === m.planId);
                    return p ? (
                      <div className="m-plan-card">
                        <div className="m-eyebrow">经营行动计划</div>
                        <h3>{p.title}</h3>
                        <div className="m-plan-step">
                          <span>01</span>
                          <div>
                            <strong>先准备一场引流活动</strong>
                            <small>明确项目、周期及优惠边界</small>
                          </div>
                        </div>
                        <div className="m-plan-step">
                          <span>02</span>
                          <div>
                            <strong>再邀约合适的老客户</strong>
                            <small>引用活动，生成分组邀约话术</small>
                          </div>
                        </div>
                        {p.confirmed ? (
                          <>
                            <Pill>
                              <CheckCircleFilled /> 已确认，助手已就位
                            </Pill>
                            <div className="m-card-actions">
                              <Button
                                size="small"
                                color="primary"
                                onClick={() => nav("/app/chat/growth")}
                              >
                                去做引流活动
                              </Button>
                              <Button
                                size="small"
                                onClick={() => nav("/app/chat/customer")}
                              >
                                客户经营
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Button
                            block
                            color="primary"
                            size="middle"
                            onClick={async () => {
                              await act(
                                () => confirmPlan(p.id),
                                "已确认行动，先去引流助手完善活动",
                              );
                            }}
                          >
                            确认行动计划
                          </Button>
                        )}
                      </div>
                    ) : null;
                  })()}
                {m.taskId &&
                  messages.find((x) => x.taskId === m.taskId)?.id === m.id &&
                  (() => {
                    const t = state.tasks.find((t) => t.id === m.taskId);
                    return t ? (
                      <TaskCard
                        task={t}
                        onOpen={() => nav(`/app/task/${t.id}`)}
                      />
                    ) : null;
                  })()}
              </div>
            </div>
          ))}
          {ownTasks
            .filter((t) => !messages.some((m) => m.taskId === t.id))
            .map((t) => (
              <div className="m-agent-message" key={t.id}>
                <Avatar id={id} size="tiny" />
                <div>
                  <span className="m-message-sender">{a.sender}</span>
                  <TaskCard task={t} onOpen={() => nav(`/app/task/${t.id}`)} />
                </div>
              </div>
            ))}
          <button
            className="m-chat-start"
            onClick={() =>
              id === "control"
                ? setDraft("帮我汇总当前经营进展")
                : openFeature(capabilities[0]?.id || "")
            }
          >
            <PlusOutlined />
            {id === "control"
              ? "汇总当前进展"
              : `开始${capabilities[0]?.name || a.name}`}
          </button>
        </div>
        {newMessages && (
          <button
            className="m-new-message"
            onClick={() => {
              follow.current = true;
              scroll.current?.scrollTo({
                top: scroll.current.scrollHeight,
                behavior: "smooth",
              });
              setNewMessages(false);
            }}
          >
            有新消息 ↓
          </button>
        )}
        <aside
          ref={panelElement}
          className={`m-work-panel ${panel}`}
          aria-label="工作面板"
        >
          {panel === "dock" ? (
            <button
              className="m-dock"
              onClick={(e) => {
                e.stopPropagation();
                openPanel("overview");
              }}
              aria-label="打开工作概览"
            >
              <AppstoreOutlined />
              <span>概览</span>
              {unread && <i />}
            </button>
          ) : (
            <>
              <div className="m-panel-header">
                <strong>
                  <AppstoreOutlined /> 工作面板
                </strong>
                <span>
                  <button
                    className="m-icon"
                    aria-label={
                      panel === "full" ? "缩为概览" : "完全打开工作面板"
                    }
                    onClick={() =>
                      setPanel(panel === "full" ? "overview" : "full")
                    }
                  >
                    <ExpandOutlined />
                  </button>
                  <button
                    className="m-icon"
                    aria-label="收起工作面板"
                    onClick={() => setPanel("dock")}
                  >
                    <CloseOutlined />
                  </button>
                </span>
              </div>
              <div className="m-panel-pager">
                <button
                  className="m-icon"
                  aria-label="上一个板块"
                  disabled={id !== "control"}
                  onClick={() => turn(-1)}
                >
                  <LeftOutlined />
                </button>
                <div>
                  <strong>{current.name}</strong>
                  <small>
                    {id === "control" ? `${board + 1} / 5` : "当前业务板块"}
                  </small>
                </div>
                <button
                  className="m-icon"
                  aria-label="下一个板块"
                  disabled={id !== "control"}
                  onClick={() => turn(1)}
                >
                  <RightOutlined />
                </button>
              </div>
              <div
                ref={panelBody}
                className="m-panel-body"
                onTouchStart={(e) => {
                  touch.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                }}
                onTouchEnd={(e) => {
                  const dx = e.changedTouches[0].clientX - touch.current.x,
                    dy = e.changedTouches[0].clientY - touch.current.y;
                  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
                    turn(dx < 0 ? 1 : -1);
                }}
              >
                <div className="m-panel-metrics">
                  <div>
                    <span>相关任务</span>
                    <strong>
                      {boardTasks.length}
                      <small>项</small>
                    </strong>
                  </div>
                  <div>
                    <span>已完成</span>
                    <strong>
                      {boardTasks.filter((t) => t.status === "success").length}
                      <small>项</small>
                    </strong>
                  </div>
                </div>
                {panel === "overview" ? (
                  <p className="m-muted">
                    {boardTasks.at(-1)?.result?.title ||
                      "从一个小目标开始，工作进展会同步到这里。"}
                  </p>
                ) : (
                  <>
                    <div className="m-card-actions">
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => nav(`/app/form/${current.id}`)}
                      >
                        发起任务
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setDraft(
                            (v) =>
                              `${v}${v ? " " : ""}帮我整理${current.name}的当前进展。`,
                          );
                          input.current?.focus();
                        }}
                      >
                        带入输入框
                      </Button>
                    </div>
                    {boardTasks.length ? (
                      boardTasks
                        .slice()
                        .reverse()
                        .map((t) => (
                          <div key={t.id} className="m-panel-task">
                            <TaskRow task={t} />
                            {t.result?.todos?.map((todo) => (
                              <label className="m-todo" key={todo.id}>
                                <Checkbox
                                  checked={todo.done}
                                  onChange={() =>
                                    act(() => toggleTodo(t.id, todo.id))
                                  }
                                />
                                <span className={todo.done ? "done" : ""}>
                                  {todo.text}
                                </span>
                              </label>
                            ))}
                            {t.agentId === "growth" &&
                              t.status === "success" &&
                              !t.result?.adopted && (
                                <Button
                                  size="small"
                                  onClick={async () => {
                                    await act(
                                      () => adoptActivity(t.id),
                                      "活动已采用",
                                    );
                                  }}
                                >
                                  确认采用
                                </Button>
                              )}
                            {t.agentId === "customer" &&
                              t.status === "success" &&
                              !t.result?.sent && (
                                <Button
                                  size="small"
                                  onClick={async () => {
                                    await act(
                                      () => sendInvitation(t.id),
                                      "已完成模拟触达",
                                    );
                                  }}
                                >
                                  确认模拟触达
                                </Button>
                              )}
                          </div>
                        ))
                    ) : (
                      <Empty
                        title="还没有相关任务"
                        description="点击发起任务，补充需求后即可开始。"
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      <div className="m-composer-area">
        <form
          className="m-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="m-input-shell">
            <input
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="发送消息…"
              aria-label={`发送给${a.sender}的消息`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.nativeEvent.isComposing)
                  e.preventDefault();
              }}
            />
            <button
              className="m-send"
              aria-label="发送消息"
              disabled={!draft.trim() || sending}
              type="submit"
            >
              <ArrowUpOutlined />
            </button>
          </div>
          <button
            className="m-icon"
            aria-label="模拟语音输入"
            type="button"
            onClick={() => {
              setDraft(
                (v) =>
                  `${v}${v ? " " : ""}${id === "control" ? "这周想增加到店，先做护理体验活动，再邀约老客。" : "帮我整理一下当前工作。"}`,
              );
              Toast.show("已插入模拟语音转写，可编辑后发送");
            }}
          >
            <AudioOutlined />
          </button>
          <button
            type="button"
            className={`m-icon ${features ? "active" : ""}`}
            aria-label="展开功能面板"
            aria-expanded={features}
            onClick={() => setFeatures((v) => !v)}
          >
            <PlusOutlined />
          </button>
        </form>
        {features && (
          <div className="m-feature-panel">
            <div className="m-feature-caption">{a.sender}的功能</div>
            <div className="m-feature-grid">
              {capabilities.map((c) => {
                const access = accessFor(c.id, state);
                return (
                  <button key={c.id} onClick={() => openFeature(c.id)}>
                    <span className="m-feature-icon">
                      {iconMap[id]}
                      {access.kind === "membership" && <em>会员</em>}
                      {access.kind === "platform" && <em>停用</em>}
                    </span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setFeatures(false);
                  openPanel("full");
                }}
              >
                <span className="m-feature-icon">
                  <AppstoreOutlined />
                </span>
                <span>工作面板</span>
              </button>
              {id === "customer" && (
                <button onClick={() => nav("/app/customers")}>
                  <span className="m-feature-icon">
                    <TeamOutlined />
                  </span>
                  <span>客户分组</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const formFields: Record<
  string,
  {
    key: string;
    label: string;
    placeholder: string;
    initial: string;
    multiline?: boolean;
  }[]
> = {
  recruit: [
    {
      key: "role",
      label: "招聘岗位",
      placeholder: "例如：美容师",
      initial: "美容师",
    },
    { key: "count", label: "招聘人数", placeholder: "例如：2", initial: "2" },
    {
      key: "salary",
      label: "待遇说明",
      placeholder: "薪资范围、福利和培训",
      initial: "底薪 + 提成，提供专业培训",
    },
    {
      key: "highlights",
      label: "门店亮点",
      placeholder: "吸引候选人的理由",
      initial: "社区口碑门店，团队氛围轻松",
      multiline: true,
    },
  ],
  growth: [
    {
      key: "project",
      label: "服务项目",
      placeholder: "本次主推的项目",
      initial: "水润护理体验",
    },
    {
      key: "period",
      label: "活动周期",
      placeholder: "例如：本周末",
      initial: "本周五至周日",
    },
    {
      key: "target",
      label: "到店目标",
      placeholder: "希望增加多少人到店",
      initial: "20 人",
    },
    {
      key: "constraint",
      label: "优惠与执行边界",
      placeholder: "可用优惠、服务容量及限制",
      initial: "新客体验优惠，每天限 8 个预约名额，不承诺效果",
      multiline: true,
    },
  ],
  operations: [
    {
      key: "focus",
      label: "今天关注的重点",
      placeholder: "可结合预置经营摘要补充需求",
      initial: "理清活动准备、预约接待和客户回访的优先级",
      multiline: true,
    },
  ],
  customer: [
    {
      key: "target",
      label: "邀约目标",
      placeholder: "希望与客户传达什么",
      initial: "邀请老客户预约本周护理体验",
      multiline: true,
    },
  ],
  video: [
    {
      key: "title",
      label: "视频主题",
      placeholder: "例如：护理体验活动介绍",
      initial: "门店水润护理体验",
    },
    {
      key: "direction",
      label: "内容方向",
      placeholder: "希望突出什么",
      initial: "真实服务流程与专业护理建议",
      multiline: true,
    },
    {
      key: "duration",
      label: "时长偏好",
      placeholder: "例如：30 秒",
      initial: "30 秒",
    },
  ],
};
function TaskForm({ state, id }: { state: AppState; id: AgentId }) {
  const nav = useNavigate();
  const fields = formFields[id] || [];
  const activity = state.tasks.filter(
    (t) => t.agentId === "growth" && t.result?.adopted,
  );
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fail, setFail] = useState(false);
  const cap = state.capabilities.find((c) => c.agentId === id);
  const access = cap ? accessFor(cap.id, state) : null;
  const submit = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      const plan = state.plans.filter((p) => p.confirmed).at(-1);
      const taskId = await runTask(id, values, { fail, planId: plan?.id });
      nav(`/app/task/${taskId}`, { replace: true });
    } catch (e) {
      Toast.show({
        content: e instanceof Error ? e.message : "执行未完成，请重试",
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Header title={cap?.name || agentById(id).name} />
      <main className="m-scroll m-page-pad">
        <div className="m-form-intro">
          <Avatar id={id} />
          <div>
            <Pill>补充需求</Pill>
            <h2>
              把想法交代清楚，
              <br />
              让结果更合心意。
            </h2>
          </div>
        </div>
        {id === "operations" && (
          <div className="m-info-banner">
            模拟经营摘要：当前有 {activity.length} 场已采用活动，
            {state.tasks.filter((t) => t.result?.sent).length}{" "}
            批客户邀约。助手将结合这些记录生成待办。
          </div>
        )}
        {id === "customer" && !activity.length && (
          <div className="m-warning">
            需要先采用一场引流活动，才能生成关联邀约。
            <Button size="small" onClick={() => nav("/app/chat/growth")}>
              去准备活动
            </Button>
          </div>
        )}
        {access && !access.allowed && (
          <div className="m-warning">
            {access.reason}
            {access.kind !== "platform" && (
              <Button size="small" onClick={() => nav("/app/purchase")}>
                查看购买
              </Button>
            )}
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{
            ...Object.fromEntries(fields.map((f) => [f.key, f.initial])),
            activityId: activity.at(-1)?.id,
            group: "近期活跃",
          }}
          mode="card"
        >
          {id === "customer" && (
            <>
              <Form.Item
                name="activityId"
                label="关联已采用的活动"
                rules={[{ required: true, message: "请选择关联活动" }]}
              >
                <select
                  className="m-native-select"
                  aria-label="关联已采用的活动"
                >
                  <option value="">请选择活动</option>
                  {activity.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.result?.title || t.title}
                    </option>
                  ))}
                </select>
              </Form.Item>
              <Form.Item
                name="group"
                label="客户分组"
                rules={[{ required: true }]}
              >
                <select className="m-native-select" aria-label="客户分组">
                  {Array.from(new Set(state.customers.map((c) => c.group))).map(
                    (g) => (
                      <option key={g} value={g}>
                        {g} ·{" "}
                        {state.customers.filter((c) => c.group === g).length} 人
                      </option>
                    ),
                  )}
                </select>
              </Form.Item>
              <div className="m-form-link">
                <button onClick={() => nav("/app/customers")} type="button">
                  查看客户分组与明细 <RightOutlined />
                </button>
              </div>
            </>
          )}
          {fields.map((f) => (
            <Form.Item
              name={f.key}
              label={f.label}
              key={f.key}
              rules={[{ required: true, message: `请填写${f.label}` }]}
            >
              {f.multiline ? (
                <TextArea
                  placeholder={f.placeholder}
                  rows={3}
                  maxLength={500}
                  showCount
                />
              ) : (
                <Input placeholder={f.placeholder} maxLength={120} />
              )}
            </Form.Item>
          ))}
        </Form>
        <div className="m-form-cost">
          <ThunderboltOutlined />
          <span>
            成功生成后扣除 <strong>{exactTokens(cap?.cost || 0)}</strong> Token
            <small>模拟消耗，失败或中断不扣除</small>
          </span>
        </div>
        <details className="m-advanced">
          <summary>演示验证选项</summary>
          <label>
            <Checkbox checked={fail} onChange={setFail} />{" "}
            模拟一次执行失败（不扣额度）
          </label>
        </details>
        <DemoNote />
      </main>
      <footer className="m-sticky-action">
        <Button
          color="primary"
          block
          loading={loading}
          disabled={!access?.allowed || (id === "customer" && !activity.length)}
          onClick={() => form.submit()}
        >
          {loading ? "正在整理，请稍候…" : "生成方案"}
        </Button>
      </footer>
    </>
  );
}
function TaskDetail({ state, task }: { state: AppState; task: Task }) {
  const nav = useNavigate();
  const [body, setBody] = useState(task.result?.body || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const frozen = task.result?.adopted || task.result?.sent;
  const action = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    await act(fn, success);
    setBusy(false);
  };
  useEffect(() => setBody(task.result?.body || ""), [task.result?.body]);
  const copy = () =>
    act(async () => {
      await navigator.clipboard.writeText(task.result?.body || "");
    }, "已复制内容");
  const retry = async () => {
    setBusy(true);
    try {
      const next = await runTask(task.agentId, task.input, {
        planId: task.planId,
      });
      nav(`/app/task/${next}`, { replace: true });
    } catch (e) {
      Toast.show(e instanceof Error ? e.message : "重试未完成");
    }
    setBusy(false);
  };
  return (
    <>
      <Header title="任务详情" />
      <main className="m-scroll m-page-pad">
        <div className="m-result-heading">
          <Avatar id={task.agentId} />
          <div>
            <Pill
              tone={
                task.status === "failed"
                  ? "red"
                  : task.status === "running"
                    ? "amber"
                    : "green"
              }
            >
              {task.result?.adopted
                ? "已采用"
                : task.result?.sent
                  ? "已模拟触达"
                  : statusLabels[task.status]}
            </Pill>
            <h2>{task.result?.title || task.title}</h2>
            <p>
              {agentById(task.agentId).sender} · {date(task.createdAt)}
            </p>
          </div>
        </div>
        {task.status === "running" ? (
          <div className="m-generation">
            <div className="m-loading-orbit">
              <ThunderboltOutlined />
            </div>
            <h3>正在为你整理</h3>
            <p>完成后，结果会保存在会话和工作面板。</p>
          </div>
        ) : task.status !== "success" ? (
          <div className="m-white-card">
            <h3>
              {task.status === "interrupted" ? "任务已中断" : "这次没有完成"}
            </h3>
            <p>{task.error || "输入内容已保留，你可以重试。"}</p>
            <p className="m-muted">本次没有扣除 Token。</p>
            <Button color="primary" loading={busy} onClick={retry}>
              使用原输入重试
            </Button>
          </div>
        ) : (
          <>
            <section className="m-result-content">
              {editing ? (
                <TextArea
                  value={body}
                  onChange={setBody}
                  rows={16}
                  maxLength={8000}
                  aria-label="编辑生成内容"
                />
              ) : (
                <div className="m-result-prose">{task.result?.body}</div>
              )}
              <div className="m-result-tools">
                {editing ? (
                  <>
                    <Button
                      size="small"
                      color="primary"
                      disabled={!body.trim()}
                      loading={busy}
                      onClick={() =>
                        action(async () => {
                          await saveResult(task.id, body);
                          setEditing(false);
                        }, "修改已保存")
                      }
                    >
                      保存修改
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setEditing(false);
                        setBody(task.result?.body || "");
                      }}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    {!frozen && (
                      <button onClick={() => setEditing(true)}>编辑内容</button>
                    )}
                    <button onClick={copy}>
                      <CopyOutlined /> 复制
                    </button>
                  </>
                )}
              </div>
              {frozen && (
                <p className="m-footnote">
                  已确认内容保留为执行快照，可查看和复制。
                </p>
              )}
            </section>
            {task.result?.todos && (
              <section className="m-white-card">
                <h3>今日待办</h3>
                {task.result.todos.map((todo) => (
                  <label className="m-todo" key={todo.id}>
                    <Checkbox
                      checked={todo.done}
                      onChange={() => act(() => toggleTodo(task.id, todo.id))}
                    />
                    <span className={todo.done ? "done" : ""}>{todo.text}</span>
                  </label>
                ))}
              </section>
            )}
            {task.agentId === "customer" && task.result?.sent && (
              <section className="m-white-card">
                <div className="m-section-title">
                  <h3>客户反馈</h3>
                  <Pill>模拟</Pill>
                </div>
                <div className="m-feedback-metrics">
                  <span>
                    已触达{" "}
                    <strong>{task.result.customerIds?.length || 0}</strong>
                  </span>
                  <span>
                    有反馈{" "}
                    <strong>{task.result.feedbackIds?.length || 0}</strong>
                  </span>
                  <span>
                    已到店{" "}
                    <strong>{task.result.arrivedIds?.length || 0}</strong>
                  </span>
                </div>
                {state.customers
                  .filter((c) => task.result?.customerIds?.includes(c.id))
                  .map((c) => {
                    const feedback = task.result?.feedbackIds?.includes(c.id),
                      arrived = task.result?.arrivedIds?.includes(c.id);
                    return (
                      <div className="m-customer-feedback" key={c.id}>
                        <span className="m-customer-initial">
                          {c.name.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {arrived
                              ? "已记录模拟到店"
                              : feedback
                                ? "已反馈：有意向了解活动"
                                : "暂未反馈"}
                          </small>
                        </div>
                        {arrived ? (
                          <CheckCircleFilled className="m-success-icon" />
                        ) : (
                          feedback && (
                            <Button
                              size="mini"
                              onClick={() =>
                                action(
                                  () => markArrival(task.id, c.id),
                                  "已记录模拟到店",
                                )
                              }
                            >
                              登记到店
                            </Button>
                          )
                        )}
                      </div>
                    );
                  })}
              </section>
            )}
            <div className="m-consumption-line">
              <CheckCircleFilled /> 成功生成 · 模拟消耗 {exactTokens(task.cost)}{" "}
              Token
            </div>
          </>
        )}
        <DemoNote />
      </main>
      {task.status === "success" && !editing && (
        <footer className="m-sticky-action">
          {task.agentId === "growth" ? (
            task.result?.adopted ? (
              <Button
                block
                color="primary"
                onClick={() => nav("/app/form/customer")}
              >
                引用活动，去邀约客户
              </Button>
            ) : (
              <Button
                block
                color="primary"
                loading={busy}
                onClick={() =>
                  action(
                    () => adoptActivity(task.id),
                    "活动已采用，可用于客户邀约",
                  )
                }
              >
                确认采用活动
              </Button>
            )
          ) : task.agentId === "customer" && !task.result?.sent ? (
            <Button
              block
              color="primary"
              loading={busy}
              onClick={async () => {
                const ok = await Dialog.confirm({
                  title: "确认模拟触达？",
                  content: `将为 ${task.result?.customerIds?.length || 0} 位虚构客户生成模拟触达与反馈，不会发送真实消息。`,
                  confirmText: "确认模拟触达",
                  cancelText: "再检查一下",
                });
                if (ok) action(() => sendInvitation(task.id), "已完成模拟触达");
              }}
            >
              确认模拟触达
            </Button>
          ) : (
            <Button
              block
              color="primary"
              onClick={() => nav(`/app/chat/${task.agentId}`)}
            >
              返回会话
            </Button>
          )}
        </footer>
      )}
    </>
  );
}
function productContents(
  product: Product,
  state: AppState,
): { tokens: number; names: string[]; description: string } {
  let tokens = product.tokens;
  let ids = product.capabilityIds;
  let description = "";
  if (product.kind === "bundle") {
    const sub = state.products.find((p) => p.id === product.subscriptionId);
    const token = state.products.find((p) => p.id === product.tokenProductId);
    const features = state.products.filter((p) =>
      product.featureProductIds?.includes(p.id),
    );
    tokens = (sub?.tokens || 0) + (token?.tokens || 0);
    ids = [
      ...(sub?.capabilityIds || []),
      ...features.flatMap((p) => p.capabilityIds),
      ...ids,
    ];
    description = [
      sub ? `${sub.name} × ${product.months || 1} 个月` : "",
      token?.name || "",
      ...features.map((p) => p.name),
    ]
      .filter(Boolean)
      .join(" + ");
  }
  return {
    tokens,
    names: [...new Set(ids)].map(
      (id) => state.capabilities.find((c) => c.id === id)?.name || id,
    ),
    description,
  };
}
function PurchasePage({ state }: { state: AppState }) {
  const [kind, setKind] = useState<ProductKind>("subscription");
  const [buying, setBuying] = useState<string | null>(null);
  const buy = async (p: Product) => {
    const contents = productContents(p, state);
    const ok = await Dialog.confirm({
      title: "确认模拟购买",
      content: (
        <div className="m-buy-confirm">
          <strong>{p.name}</strong>
          <p>
            ¥{p.price}
            {p.kind === "subscription" ? " / 月" : ""}
          </p>
          {contents.tokens > 0 && (
            <p>发放 {exactTokens(contents.tokens)} Token</p>
          )}
          {contents.names.length > 0 && (
            <p>包含：{contents.names.join("、")}</p>
          )}
          <small>仅演示购买流程，不会产生真实扣款。</small>
        </div>
      ),
      confirmText: "确认模拟购买",
      cancelText: "取消",
    });
    if (!ok) return;
    setBuying(p.id);
    await act(() => purchase(p.id), "模拟购买成功，权益与额度已更新");
    setBuying(null);
  };
  return (
    <>
      <Header title="订阅与额度" />
      <main className="m-scroll m-page-pad">
        <TokenCard state={state} />
        <div className="m-purchase-heading">
          <h2>按需开启，安心经营</h2>
          <p>订阅、额度与功能，都由你做主。</p>
        </div>
        <Tabs
          activeKey={kind}
          onChange={(key) => setKind(key as ProductKind)}
          className="m-product-tabs"
        >
          {(Object.entries(kindLabels) as [ProductKind, string][]).map(
            ([id, label]) => (
              <Tabs.Tab key={id} title={label} />
            ),
          )}
        </Tabs>
        <div className="m-products">
          {state.products
            .filter((p) => p.kind === kind && p.enabled)
            .map((p) => {
              const contents = productContents(p, state);
              const subscribed =
                !!state.account.subscriptionId &&
                (p.kind === "subscription" ||
                  (p.kind === "bundle" && !!p.subscriptionId));
              const owned =
                p.kind === "feature" &&
                p.capabilityIds.length > 0 &&
                p.capabilityIds.every(
                  (id) =>
                    state.account.featureIds.includes(id) ||
                    state.products
                      .find((x) => x.id === state.account.subscriptionId)
                      ?.capabilityIds.includes(id),
                );
              const conflict =
                p.kind === "bundle" &&
                (p.featureProductIds || []).some((id) => {
                  const f = state.products.find((x) => x.id === id);
                  return f?.capabilityIds.some((cap) =>
                    state.account.featureIds.includes(cap),
                  );
                });
              const invalid = !Number.isFinite(p.price) || p.price <= 0;
              const blocked = subscribed || owned || conflict || invalid;
              return (
                <section
                  className={`m-product ${p.kind === "subscription" ? "featured" : ""}`}
                  key={p.id}
                >
                  {p.kind === "subscription" && (
                    <div className="m-product-ribbon">
                      <CrownOutlined /> 日常经营之选
                    </div>
                  )}
                  <div className="m-product-title">
                    <h3>{p.name}</h3>
                    <span>
                      {p.kind === "tokens" ? (
                        <ThunderboltOutlined />
                      ) : p.kind === "feature" ? (
                        <FileTextOutlined />
                      ) : p.kind === "bundle" ? (
                        <AppstoreOutlined />
                      ) : (
                        <CrownOutlined />
                      )}
                    </span>
                  </div>
                  <div className="m-product-price">
                    <small>¥</small>
                    {p.price}
                    <span>
                      /
                      {p.kind === "subscription"
                        ? "月"
                        : p.kind === "tokens"
                          ? "包"
                          : p.kind === "bundle"
                            ? "套"
                            : "份"}
                    </span>
                  </div>
                  {contents.tokens > 0 && (
                    <div className="m-product-token">
                      <ThunderboltOutlined /> {formatTokens(contents.tokens)}{" "}
                      Token{p.kind === "subscription" ? " / 月" : ""}
                    </div>
                  )}
                  {contents.description && (
                    <p className="m-product-description">
                      {contents.description}
                    </p>
                  )}
                  <ul>
                    {contents.names.map((n) => (
                      <li key={n}>
                        <CheckOutlined /> {n}
                      </li>
                    ))}
                    {p.kind === "tokens" && (
                      <>
                        <li>
                          <CheckOutlined /> 独立补充，到账即用
                        </li>
                        <li>
                          <CheckOutlined /> 不改变已有功能权益
                        </li>
                      </>
                    )}
                    {p.kind === "feature" && (
                      <li>
                        <CheckOutlined /> 按需解锁，Token 额度另计
                      </li>
                    )}
                  </ul>
                  <Button
                    block
                    color={blocked ? "default" : "primary"}
                    disabled={blocked || !!buying}
                    loading={buying === p.id}
                    onClick={() => buy(p)}
                  >
                    {subscribed
                      ? "当前已订阅，暂不支持续订 / 替换"
                      : owned
                        ? "当前已拥有该功能"
                        : conflict
                          ? "已有套餐内功能，暂不支持重复购买"
                          : invalid
                            ? "暂未配置有效售价"
                            : "模拟购买"}
                  </Button>
                </section>
              );
            })}
          {!state.products.some((p) => p.kind === kind && p.enabled) && (
            <Empty
              title="暂无在售商品"
              description="后台上架商品后，将在这里显示。"
            />
          )}
        </div>
        <div className="m-purchase-note">
          <strong>关于本次演示</strong>
          <p>
            价格为演示占位，不代表真实模型用量报价。Token
            为模拟额度，不连接真实模型；不演示续订、到期和结转。
          </p>
        </div>
      </main>
    </>
  );
}
function ProfilePage({ state }: { state: AppState }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Header title="个人资料" />
      <main className="m-scroll m-page-pad">
        <div className="m-profile-portrait">
          <span className="m-user-avatar">
            {state.account.name.slice(0, 1)}
          </span>
          <Pill>个人版 · 演示账号</Pill>
        </div>
        <Form
          layout="vertical"
          mode="card"
          initialValues={{
            name: state.account.name,
            storeName: state.account.storeName,
            service: state.account.service,
          }}
          onFinish={async (values) => {
            setBusy(true);
            if (await act(() => saveProfile(values), "个人资料已保存")) nav(-1);
            setBusy(false);
          }}
          footer={
            <Button block color="primary" type="submit" loading={busy}>
              保存资料
            </Button>
          }
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请填写姓名" }]}
          >
            <Input placeholder="你的姓名" maxLength={20} />
          </Form.Item>
          <Form.Item
            name="storeName"
            label="门店名称"
            rules={[{ required: true, message: "请填写门店名称" }]}
          >
            <Input placeholder="门店名称" maxLength={40} />
          </Form.Item>
          <Form.Item
            name="service"
            label="主营服务"
            rules={[{ required: true, message: "请填写主营服务" }]}
          >
            <Input placeholder="例如：皮肤管理、身体护理" maxLength={100} />
          </Form.Item>
        </Form>
        <p className="m-footnote">资料仅保存在当前浏览器，用于丰富演示场景。</p>
      </main>
    </>
  );
}
function Records({
  state,
  type,
}: {
  state: AppState;
  type: "orders" | "ledger";
}) {
  return (
    <>
      <Header title={type === "orders" ? "购买记录" : "额度明细"} />
      <main className="m-scroll m-page-pad">
        {type === "ledger" && (
          <section className="m-ledger-balance">
            <span>当前可用 Token</span>
            <strong>{exactTokens(state.account.balance)}</strong>
            <small>{formatTokens(state.account.balance)} · 模拟额度</small>
          </section>
        )}
        {type === "orders" ? (
          state.orders.length ? (
            <div className="m-white-card m-record-list">
              {state.orders.map((o) => (
                <div className="m-record" key={o.id}>
                  <div>
                    <strong>{o.name}</strong>
                    <small>
                      {date(o.createdAt)} · {kindLabels[o.kind]}
                    </small>
                    {o.tokens > 0 && (
                      <small>发放 {exactTokens(o.tokens)} Token</small>
                    )}
                  </div>
                  <span>
                    <strong>¥{o.price}</strong>
                    <Pill>模拟成功</Pill>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="还没有购买记录"
              description="完成一次模拟购买后，会在这里保留当时的商品与价格。"
            />
          )
        ) : state.ledger.length ? (
          <div className="m-white-card m-record-list">
            {state.ledger.map((l) => (
              <div className="m-record" key={l.id}>
                <div>
                  <strong>{l.reason}</strong>
                  <small>{date(l.createdAt)} · 模拟</small>
                  <small>余额 {exactTokens(l.balance)}</small>
                </div>
                <span className={l.amount > 0 ? "m-positive" : "m-negative"}>
                  {l.amount > 0 ? "+" : ""}
                  {exactTokens(l.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="还没有额度变动"
            description="购买额度或成功执行任务后，会显示精确增减与余额。"
          />
        )}
        <DemoNote />
      </main>
    </>
  );
}
function CustomersPage({ state }: { state: AppState }) {
  const [group, setGroup] = useState("全部");
  const [detail, setDetail] = useState<string | null>(null);
  const groups = ["全部", ...new Set(state.customers.map((c) => c.group))];
  const customer = state.customers.find((c) => c.id === detail);
  return (
    <>
      <Header title="客户分组" />
      <main className="m-scroll m-page-pad">
        <div className="m-page-intro">
          <Pill>虚构客户</Pill>
          <h2>关心，从了解开始</h2>
          <p>按客户近况分组，为邀约找到合适的对象。</p>
        </div>
        <div className="m-group-tabs">
          {groups.map((g) => (
            <button
              key={g}
              className={g === group ? "active" : ""}
              onClick={() => setGroup(g)}
            >
              {g}
              <span>
                {g === "全部"
                  ? state.customers.length
                  : state.customers.filter((c) => c.group === g).length}
              </span>
            </button>
          ))}
        </div>
        <div className="m-white-card">
          {state.customers
            .filter((c) => group === "全部" || c.group === group)
            .map((c) => (
              <button
                className="m-customer-row"
                key={c.id}
                onClick={() => setDetail(c.id)}
              >
                <span className="m-customer-initial">{c.name.slice(0, 1)}</span>
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.note}</small>
                </span>
                <Pill tone={c.group === "待唤醒" ? "amber" : "green"}>
                  {c.group}
                </Pill>
                <RightOutlined />
              </button>
            ))}
        </div>
        <DemoNote />
      </main>
      <Popup
        visible={!!customer}
        onMaskClick={() => setDetail(null)}
        onClose={() => setDetail(null)}
        bodyClassName="m-popup"
      >
        {customer && (
          <>
            <div className="m-popup-head">
              <h3>客户详情</h3>
              <button
                className="m-icon"
                aria-label="关闭客户详情"
                onClick={() => setDetail(null)}
              >
                <CloseOutlined />
              </button>
            </div>
            <div className="m-customer-detail">
              <span className="m-customer-initial large">
                {customer.name.slice(0, 1)}
              </span>
              <h2>{customer.name}</h2>
              <Pill>{customer.group}</Pill>
              <dl>
                <dt>客户备注</dt>
                <dd>{customer.note}</dd>
                <dt>最近到店</dt>
                <dd>{customer.lastVisit}</dd>
              </dl>
              <p className="m-footnote">虚构客户资料，仅供流程演示使用。</p>
            </div>
          </>
        )}
      </Popup>
    </>
  );
}
export default function MobileApp() {
  const state = useApp();
  const location = useLocation();
  const path = location.pathname
    .replace(/^\/app\/?/, "")
    .split("/")
    .filter(Boolean);
  const agent = AGENTS.find((a) => a.id === path[1]);
  let content: ReactNode;
  if (path[0] === "chat" && agent)
    content = (
      <Chat key={`${agent.id}-${state.resetId}`} state={state} id={agent.id} />
    );
  else if (path[0] === "form" && agent && agent.id !== "control")
    content = (
      <TaskForm
        key={`${agent.id}-${state.resetId}`}
        state={state}
        id={agent.id}
      />
    );
  else if (path[0] === "task") {
    const task = state.tasks.find((t) => t.id === path[1]);
    content = task ? (
      <TaskDetail key={task.id} state={state} task={task} />
    ) : (
      <>
        <Header title="任务详情" />
        <Empty
          title="任务已不存在"
          description="演示重置后，历史任务会被清除。请返回工作台开始新的任务。"
        />
      </>
    );
  } else if (path[0] === "data") content = <DataPage state={state} />;
  else if (path[0] === "mine") content = <Mine state={state} />;
  else if (path[0] === "purchase") content = <PurchasePage state={state} />;
  else if (path[0] === "profile") content = <ProfilePage state={state} />;
  else if (path[0] === "orders" || path[0] === "ledger")
    content = <Records state={state} type={path[0]} />;
  else if (path[0] === "customers") content = <CustomersPage state={state} />;
  else content = <Work state={state} />;
  return <div className="mobile-app">{content}</div>;
}
