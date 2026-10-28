import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudSyncOutlined,
  CodeSandboxOutlined,
  CreditCardOutlined,
  ExperimentOutlined,
  ExportOutlined,
  GiftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UserOutlined,
} from "@ant-design/icons";
import type { Capability, Product, ProductKind } from "../shared/types";
import {
  AGENTS,
  agentById,
  exactTokens,
  formatTokens,
} from "../shared/catalog";
import {
  resetDemo,
  saveCapability,
  savePlugin,
  saveProduct,
  useApp,
} from "../shared/store";
import "./admin.css";

type Section = "agents" | "plugins" | "commerce";
const kindLabels: Record<ProductKind, string> = {
  subscription: "订阅方案",
  tokens: "额度包",
  feature: "额外功能",
  bundle: "固定套餐",
};
const kindUnits: Record<ProductKind, string> = {
  subscription: "月",
  tokens: "包",
  feature: "份",
  bundle: "套",
};
const sectionLabels: Record<Section, string> = {
  agents: "Agent 配置",
  plugins: "插件与能力",
  commerce: "订阅与权益",
};
const inputLimits = { min: 1, max: Number.MAX_SAFE_INTEGER, precision: 0 };
const money = (n: number) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const errText = (error: unknown) =>
  error instanceof Error ? error.message : "操作未完成，请重试";

export default function AdminApp() {
  return (
    <AntApp>
      <AdminContent />
    </AntApp>
  );
}

function AdminContent() {
  const state = useApp();
  const { message, modal } = AntApp.useApp();
  const [section, setSection] = useState<Section>("commerce");
  const [kind, setKind] = useState<ProductKind>("subscription");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [collapsed, setCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [editingCapability, setEditingCapability] = useState<Capability | null>(
    null,
  );
  const [productForm] = Form.useForm<Product>();
  const [capabilityForm] = Form.useForm<Capability>();
  const [clock, setClock] = useState("");
  const formSubscription = Form.useWatch("subscriptionId", productForm);
  const formTokenProduct = Form.useWatch("tokenProductId", productForm);
  const formFeatureProducts = Form.useWatch(
    "featureProductIds",
    productForm,
  ) as string[] | undefined;

  useEffect(() => {
    setClock(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  }, [state.revision]);
  useEffect(() => {
    setEditing(undefined);
    setEditingCapability(null);
    setSaving(false);
  }, [state.resetId]);

  const changeSection = (next: Section) => {
    setSection(next);
    setSearch("");
    setStatus("all");
  };
  const paidCapabilities = state.capabilities.filter((c) => !c.basic);
  const capabilityOptions = paidCapabilities.map((c) => ({
    value: c.id,
    label: `${agentById(c.agentId).name} · ${c.name}`,
  }));
  const activeProducts = state.products.filter((p) => p.kind === kind);
  const filteredProducts = activeProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (status === "all" || String(p.enabled) === status),
  );
  const filteredCapabilities = state.capabilities.filter(
    (c) =>
      (agentFilter === "all" || c.agentId === agentFilter) &&
      `${c.name}${c.description}${agentById(c.agentId).name}`.includes(
        search.trim(),
      ) &&
      (status === "all" || String(c.enabled) === status),
  );
  const subscription = state.products.find(
    (p) => p.id === state.account.subscriptionId,
  );
  const getNames = (ids: string[]) =>
    ids.map(
      (id) => state.capabilities.find((c) => c.id === id)?.name || "配置缺失",
    );
  const productName = (id?: string) =>
    state.products.find((p) => p.id === id)?.name || "未包含";
  const bundleTokens = (
    p: Pick<Product, "subscriptionId" | "tokenProductId">,
  ) =>
    (state.products.find((x) => x.id === p.subscriptionId)?.tokens || 0) +
    (state.products.find((x) => x.id === p.tokenProductId)?.tokens || 0);
  const bundleFeatures = (
    p: Pick<Product, "subscriptionId" | "featureProductIds">,
  ) => [
    ...new Set([
      ...(state.products.find((x) => x.id === p.subscriptionId)
        ?.capabilityIds || []),
      ...(p.featureProductIds || []).flatMap(
        (id) => state.products.find((x) => x.id === id)?.capabilityIds || [],
      ),
    ]),
  ];
  const description = (p: Product) => {
    if (p.kind === "subscription")
      return `每月 ${formatTokens(p.tokens)} Token · ${p.capabilityIds.length} 项功能`;
    if (p.kind === "tokens") return `一次补充 ${formatTokens(p.tokens)} Token`;
    if (p.kind === "feature") return getNames(p.capabilityIds).join("、");
    return [
      p.subscriptionId && `${productName(p.subscriptionId)} × 1 个月`,
      p.tokenProductId && productName(p.tokenProductId),
      ...(p.featureProductIds || []).map(productName),
    ]
      .filter(Boolean)
      .join(" + ");
  };
  const notifyResult = async (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => {
    setBusy(key);
    try {
      await action();
      message.success(success);
    } catch (error) {
      message.error(errText(error));
    } finally {
      setBusy(null);
    }
  };
  const confirmReset = (mode: "business" | "purchase") => {
    modal.confirm({
      title: `重置为${mode === "business" ? "经营" : "购买"}演示？`,
      content: (
        <div>
          <p>
            将清除本浏览器中的会话、任务、订单与额度记录，并恢复所有 PC 配置。
          </p>
          <p>
            {mode === "business"
              ? "恢复已订阅账号，余额 3B，短视频未开通。"
              : "恢复未订阅账号，余额为 0，可演示首次购买。"}
          </p>
        </div>
      ),
      okText: "确认重置",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await resetDemo(mode);
          message.success("演示数据已重置，H5 同步更新");
        } catch (error) {
          message.error(errText(error));
          throw error;
        }
      },
    });
  };
  const openProduct = (p?: Product) => {
    setEditing(p || null);
    productForm.resetFields();
    productForm.setFieldsValue(
      p
        ? { ...p }
        : {
            kind,
            name: "",
            price: undefined,
            enabled: true,
            tokens: undefined,
            capabilityIds: [],
            months: 1,
            featureProductIds: [],
          },
    );
  };
  const openCapability = (c: Capability) => {
    setEditingCapability(c);
    capabilityForm.setFieldsValue(c);
  };
  const commitProduct = async () => {
    try {
      const values = await productForm.validateFields();
      setSaving(true);
      const base: Product = {
        id: editing?.id || `product-${crypto.randomUUID()}`,
        kind,
        name: values.name.trim(),
        price: Number(values.price),
        enabled: values.enabled,
        tokens: 0,
        capabilityIds: [],
      };
      if (kind === "subscription" || kind === "tokens")
        base.tokens = Number(values.tokens);
      if (kind === "subscription" || kind === "feature")
        base.capabilityIds = values.capabilityIds || [];
      if (kind === "bundle") {
        base.subscriptionId = values.subscriptionId || undefined;
        base.months = values.subscriptionId ? 1 : undefined;
        base.tokenProductId = values.tokenProductId || undefined;
        base.featureProductIds = values.featureProductIds || [];
        if (
          !base.subscriptionId &&
          !base.tokenProductId &&
          !base.featureProductIds.length
        )
          throw new Error("套餐至少包含一项商品");
        base.tokens = bundleTokens(base);
        base.capabilityIds = bundleFeatures(base);
      }
      await saveProduct(base);
      setEditing(undefined);
      message.success("已保存，门店端同步更新");
    } catch (error) {
      if (!(error && typeof error === "object" && "errorFields" in error))
        message.error(errText(error));
    } finally {
      setSaving(false);
    }
  };
  const commitCapability = async () => {
    if (!editingCapability) return;
    try {
      const values = await capabilityForm.validateFields();
      setSaving(true);
      await saveCapability({
        ...editingCapability,
        name: values.name.trim(),
        description: values.description.trim(),
        enabled: values.enabled,
      });
      setEditingCapability(null);
      message.success("能力配置已保存，门店端同步更新");
    } catch (error) {
      if (!(error && typeof error === "object" && "errorFields" in error))
        message.error(errText(error));
    } finally {
      setSaving(false);
    }
  };

  const productColumns: ColumnsType<Product> = [
    {
      title: "商品名称 / 权益",
      key: "name",
      render: (_, p) => (
        <div className="admin-product-cell">
          <strong>{p.name}</strong>
          <span>{description(p)}</span>
          {p.kind === "subscription" && (
            <div className="admin-feature-tags">
              {getNames(p.capabilityIds).map((name) => (
                <Tag key={name}>{name}</Tag>
              ))}
            </div>
          )}
        </div>
      ),
      width: "48%",
    },
    {
      title: kind === "bundle" ? "固定售价" : "售价",
      key: "price",
      width: 155,
      render: (_, p) => (
        <div className="admin-price">
          ¥{money(p.price)}
          <small> / {kindUnits[p.kind]}</small>
        </div>
      ),
    },
    {
      title: "上架状态",
      key: "enabled",
      width: 140,
      render: (_, p) => (
        <Space size={8}>
          <Switch
            size="small"
            checked={p.enabled}
            aria-label={`${p.name}上架状态`}
            loading={busy === p.id}
            onChange={(enabled) =>
              void notifyResult(
                p.id,
                () => saveProduct({ ...p, enabled }),
                enabled ? "商品已上架" : "商品已下架，已购权益保留",
              )
            }
          />
          <span className={p.enabled ? "admin-state-on" : "admin-muted"}>
            {p.enabled ? "已上架" : "已下架"}
          </span>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      fixed: "right",
      render: (_, p) => (
        <Button type="link" onClick={() => openProduct(p)}>
          配置
        </Button>
      ),
    },
  ];
  const capabilityColumns: ColumnsType<Capability> = [
    {
      title: "能力名称",
      key: "name",
      width: "37%",
      render: (_, c) => (
        <div className="admin-product-cell">
          <strong>
            {c.name} {c.basic && <Tag>基础能力</Tag>}
          </strong>
          <span>{c.description}</span>
        </div>
      ),
    },
    {
      title: "所属 Agent",
      key: "agent",
      width: 150,
      render: (_, c) => (
        <Space>
          <Avatar
            size={28}
            shape="square"
            style={{
              background: `${agentById(c.agentId).color}18`,
              color: agentById(c.agentId).color,
            }}
          >
            {agentById(c.agentId).initial}
          </Avatar>
          {agentById(c.agentId).name}
        </Space>
      ),
    },
    {
      title: "模拟消耗",
      key: "cost",
      width: 130,
      render: (_, c) => (
        <span className="admin-monospace">
          {c.basic ? "基础免费" : `${exactTokens(c.cost)} Token`}
        </span>
      ),
    },
    {
      title: "开放状态",
      key: "status",
      width: 150,
      render: (_, c) => {
        const plugin = state.plugins.find((p) => p.id === c.pluginId);
        return (
          <div>
            <Space size={8}>
              <Switch
                size="small"
                aria-label={`${c.name}开放状态`}
                checked={c.enabled}
                loading={busy === c.id}
                onChange={(enabled) =>
                  void notifyResult(
                    c.id,
                    () => saveCapability({ ...c, enabled }),
                    "能力开放状态已更新",
                  )
                }
              />
              <span className={c.enabled ? "admin-state-on" : "admin-muted"}>
                {c.enabled ? "已开放" : "已停用"}
              </span>
            </Space>
            {!plugin?.enabled && (
              <div className="admin-warning-small">所属插件已停用</div>
            )}
          </div>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_, c) => (
        <Button type="link" onClick={() => openCapability(c)}>
          配置
        </Button>
      ),
    },
  ];

  const summaries = useMemo(
    () => [
      {
        label: "固定 Agent",
        value: "6",
        suffix: "个",
        icon: <RobotOutlined />,
        note: "总控 + 五个业务助手",
      },
      {
        label: "已开放能力",
        value: state.capabilities.filter(
          (c) =>
            c.enabled &&
            state.plugins.find((p) => p.id === c.pluginId)?.enabled,
        ).length,
        suffix: "项",
        icon: <ThunderboltFilled />,
        note: "由平台统一控制开放",
      },
      {
        label: "已上架商品",
        value: state.products.filter((p) => p.enabled).length,
        suffix: "件",
        icon: <GiftOutlined />,
        note: "订阅、额度、功能与套餐",
      },
    ],
    [state.capabilities, state.plugins, state.products],
  );

  return (
    <div className={`admin-shell ${collapsed ? "admin-collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#/admin" aria-label="LABU 服务配置">
          <span className="admin-brand-symbol">
            <ThunderboltFilled />
          </span>
          <span className="admin-brand-text">
            LABU<span>AGENT WORKSPACE</span>
          </span>
        </a>
        <div className="admin-nav-caption">服务配置</div>
        <nav aria-label="后台主导航">
          <button
            className={section === "agents" ? "active" : ""}
            onClick={() => changeSection("agents")}
            title="Agent 配置"
          >
            <RobotOutlined />
            <span>Agent 配置</span>
          </button>
          <button
            className={section === "plugins" ? "active" : ""}
            onClick={() => changeSection("plugins")}
            title="插件与能力"
          >
            <CodeSandboxOutlined />
            <span>插件与能力</span>
          </button>
          <button
            className={section === "commerce" ? "active" : ""}
            onClick={() => changeSection("commerce")}
            title="订阅与权益"
          >
            <CreditCardOutlined />
            <span>订阅与权益</span>
          </button>
          <div className="admin-nav-caption">规划能力</div>
          <button
            onClick={() =>
              message.info("团队管理 · 规划中，本版仅支持个人账号")
            }
            title="团队管理，规划中"
          >
            <TeamOutlined />
            <span>团队管理</span>
            <small>规划中</small>
          </button>
          <button
            onClick={() => message.info("多门店管理 · 规划中，本版未开放")}
            title="多门店管理，规划中"
          >
            <ShopOutlined />
            <span>多门店管理</span>
            <small>规划中</small>
          </button>
          <button
            onClick={() =>
              message.info("付费与授权关系 · 规划中，本版仅支持个人购买")
            }
            title="付费与授权关系，规划中"
          >
            <ApartmentOutlined />
            <span>付费与授权关系</span>
            <small>规划中</small>
          </button>
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-note">
            <span className="admin-online-dot" />
            <span>个人版 · 交互演示</span>
          </div>
          <button
            className="admin-collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            <span>收起侧栏</span>
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            服务配置<span>/</span>
            <strong>{sectionLabels[section]}</strong>
          </div>
          <div className="admin-top-actions">
            <span className="admin-sync">
              <CloudSyncOutlined /> 同浏览器联动
            </span>
            <Button
              icon={<ExportOutlined />}
              href={`${window.location.pathname}#/app`}
              target="_blank"
              rel="noopener noreferrer"
            >
              打开门店端
            </Button>
            <div className="admin-account">
              <Avatar
                size={30}
                style={{ background: "#ecf3ee", color: "#237a57" }}
                icon={<UserOutlined />}
              />
              <span>平台运营</span>
            </div>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-heading">
            <div>
              <div className="admin-eyebrow">SERVICE CONSOLE</div>
              <h1>{sectionLabels[section]}</h1>
              <p>
                {section === "commerce"
                  ? "配置商品与个人权益，让每一项能力按需开放。"
                  : section === "agents"
                    ? "稳定的 Agent 骨架，灵活配置每一项业务能力。"
                    : "管理预置插件的开放状态，连接 Agent 与业务能力。"}
              </p>
            </div>
            <Tag icon={<ExperimentOutlined />} className="admin-demo-tag">
              个人版 · Mock
            </Tag>
          </div>
          <div className="admin-stats">
            {summaries.map((s) => (
              <div className="admin-stat" key={s.label}>
                <span className="admin-stat-icon">{s.icon}</span>
                <div>
                  <span className="admin-stat-label">{s.label}</span>
                  <div className="admin-stat-value">
                    {s.value}
                    <small>{s.suffix}</small>
                  </div>
                  <span className="admin-stat-note">{s.note}</span>
                </div>
              </div>
            ))}
          </div>
          {section === "commerce" && (
            <section className="admin-workspace" aria-label="商品配置">
              <Tabs
                activeKey={kind}
                onChange={(key) => {
                  setKind(key as ProductKind);
                  setSearch("");
                  setStatus("all");
                }}
                items={(Object.keys(kindLabels) as ProductKind[]).map(
                  (key) => ({ key, label: kindLabels[key] }),
                )}
              />
              <div className="admin-toolbar">
                <Space wrap>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="搜索商品名称"
                    aria-label="搜索商品名称"
                    allowClear
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="admin-search"
                  />
                  <Select
                    aria-label="筛选商品状态"
                    value={status}
                    onChange={setStatus}
                    style={{ width: 120 }}
                    options={[
                      { value: "all", label: "全部状态" },
                      { value: "true", label: "已上架" },
                      { value: "false", label: "已下架" },
                    ]}
                  />
                </Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openProduct()}
                >
                  新增{kindLabels[kind]}
                </Button>
              </div>
              <div className="admin-helper">
                {kind === "subscription"
                  ? "订阅直接包含具体功能与每月额度，无需配置抽象权限等级。"
                  : kind === "tokens"
                    ? "额度可单独补充。购买额度不会解锁新的业务功能。"
                    : kind === "feature"
                      ? "额外功能可独立购买，与订阅包含功能共同生效。"
                      : "套餐的包含内容与固定售价分别配置，H5 直接购买，不自由拼单。"}
              </div>
              <Table<Product>
                rowKey="id"
                columns={productColumns}
                dataSource={filteredProducts}
                scroll={{ x: 720 }}
                pagination={{
                  pageSize: 8,
                  hideOnSinglePage: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="没有匹配的商品，试试其他关键词或新增配置"
                    />
                  ),
                }}
              />
              <div className="admin-table-foot">
                <span>
                  共 {filteredProducts.length} 条
                  {status !== "all" || search ? "匹配" : "配置"}
                </span>
                <span>
                  <CheckCircleFilled /> 保存后实时影响门店端
                </span>
              </div>
            </section>
          )}
          {section === "agents" && (
            <section className="admin-workspace">
              <div className="admin-section-header">
                <div>
                  <h2>固定 Agent · 能力配置</h2>
                  <p>保留六个业务入口，通过能力与权益控制实际可用状态。</p>
                </div>
                <Tag>6 个 Agent</Tag>
              </div>
              <div
                className="admin-agent-tabs"
                role="group"
                aria-label="按 Agent 筛选"
              >
                <button
                  className={agentFilter === "all" ? "selected" : ""}
                  onClick={() => setAgentFilter("all")}
                >
                  全部 Agent
                </button>
                {AGENTS.map((a) => (
                  <button
                    key={a.id}
                    className={agentFilter === a.id ? "selected" : ""}
                    onClick={() => setAgentFilter(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <div className="admin-toolbar">
                <Space wrap>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="搜索能力或说明"
                    aria-label="搜索能力或说明"
                    allowClear
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="admin-search"
                  />
                  <Select
                    aria-label="筛选能力状态"
                    value={status}
                    onChange={setStatus}
                    style={{ width: 120 }}
                    options={[
                      { value: "all", label: "全部状态" },
                      { value: "true", label: "已开放" },
                      { value: "false", label: "已停用" },
                    ]}
                  />
                </Space>
                <span className="admin-muted">固定能力，不新增 Agent</span>
              </div>
              <Table<Capability>
                rowKey="id"
                columns={capabilityColumns}
                dataSource={filteredCapabilities}
                pagination={false}
                scroll={{ x: 860 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="没有匹配的能力"
                    />
                  ),
                }}
              />
              <div className="admin-table-foot">
                <span>共 {filteredCapabilities.length} 项能力</span>
                <span>平台停用优先于个人购买权益</span>
              </div>
            </section>
          )}
          {section === "plugins" && (
            <section className="admin-workspace admin-plugin-workspace">
              <div className="admin-section-header">
                <div>
                  <h2>预置插件</h2>
                  <p>
                    插件提供能力定义与展示模板，本版仅演示配置，不运行真实工具。
                  </p>
                </div>
                <Tag icon={<CodeSandboxOutlined />}>
                  {state.plugins.length} 个插件
                </Tag>
              </div>
              <div className="admin-plugin-grid">
                {state.plugins.map((plugin) => {
                  const capabilities = state.capabilities.filter(
                    (c) => c.pluginId === plugin.id,
                  );
                  return (
                    <Card key={plugin.id} className="admin-plugin-card">
                      <div className="admin-plugin-top">
                        <span className="admin-plugin-icon">
                          <CodeSandboxOutlined />
                        </span>
                        <Switch
                          aria-label={`${plugin.name}启用状态`}
                          checked={plugin.enabled}
                          loading={busy === plugin.id}
                          onChange={(enabled) =>
                            void notifyResult(
                              plugin.id,
                              () => savePlugin({ ...plugin, enabled }),
                              enabled
                                ? "插件已启用"
                                : "插件已停用，所属能力暂不可用",
                            )
                          }
                        />
                      </div>
                      <h3>{plugin.name}</h3>
                      <p>{plugin.description}</p>
                      <div className="admin-plugin-status">
                        <Badge
                          status={plugin.enabled ? "success" : "default"}
                          text={plugin.enabled ? "已启用" : "已停用"}
                        />
                        <span>{capabilities.length} 项能力</span>
                      </div>
                      <Divider />
                      <div className="admin-plugin-capabilities">
                        {capabilities.map((c) => (
                          <div key={c.id}>
                            <span>{agentById(c.agentId).name}</span>
                            <strong>{c.name}</strong>
                            <Tag
                              color={
                                c.enabled && plugin.enabled
                                  ? "success"
                                  : "default"
                              }
                            >
                              {c.enabled && plugin.enabled
                                ? "可开放"
                                : "已停用"}
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
          <div className="admin-bottom-grid">
            <section className="admin-account-preview">
              <span className="admin-mini-caption">
                <UserOutlined /> 联动中的个人账号
              </span>
              <div>
                <strong>{state.account.name}</strong>
                <span>{state.account.storeName}</span>
                <Tag>{subscription?.name || "未订阅"}</Tag>
              </div>
              <p>
                可用 Token{" "}
                <Tooltip title={exactTokens(state.account.balance)}>
                  <b>{formatTokens(state.account.balance)}</b>
                </Tooltip>
                <span className="admin-exact-balance">
                  {exactTokens(state.account.balance)}
                </span>
              </p>
            </section>
            <section className="admin-demo-tools">
              <span className="admin-mini-caption">
                <ReloadOutlined /> 演示数据
              </span>
              <p>重置会同时清除当前配置及门店端记录。</p>
              <Space wrap>
                <Button size="small" onClick={() => confirmReset("business")}>
                  重置经营演示
                </Button>
                <Button size="small" onClick={() => confirmReset("purchase")}>
                  重置购买演示
                </Button>
              </Space>
            </section>
          </div>
          <div className="admin-footer-note">
            <span>
              <CheckCircleFilled /> 本地已保存{clock && ` · ${clock}`}
            </span>
            <span>模拟配置与计费 · 价格仅为演示占位 · 不代表真实模型报价</span>
          </div>
        </main>
      </div>

      <Drawer
        title={`${editing ? "编辑" : "新增"}${kindLabels[kind]}`}
        open={editing !== undefined}
        onClose={() => !saving && setEditing(undefined)}
        width={480}
        className="admin-editor"
        destroyOnHidden
        footer={
          <div className="admin-drawer-actions">
            <Button onClick={() => setEditing(undefined)} disabled={saving}>
              取消
            </Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => void commitProduct()}
            >
              保存配置
            </Button>
          </div>
        }
      >
        <Alert
          type="info"
          showIcon
          title="保存后，门店端同步更新"
          description={
            kind === "bundle"
              ? "套餐固定售价独立设置，不随包含内容变化自动求和。"
              : "商品改价不追溯历史订单；下架不撤销已经获得的权益。"
          }
          className="admin-editor-note"
        />
        <Form<Product>
          form={productForm}
          layout="vertical"
          requiredMark="optional"
        >
          <Form.Item
            name="name"
            label="商品名称"
            rules={[
              { required: true, whitespace: true, message: "请填写商品名称" },
              { max: 40, message: "名称最多 40 个字" },
            ]}
          >
            <Input placeholder={`例如：${kindLabels[kind]}`} maxLength={40} />
          </Form.Item>
          <Form.Item
            name="price"
            label={
              kind === "bundle"
                ? "套餐固定售价（元 / 套）"
                : `售价（元 / ${kindUnits[kind]}）`
            }
            extra={
              kind === "bundle"
                ? "固定售价独立配置，不自动求和。"
                : "仅为演示价格，不代表真实模型用量报价。"
            }
            rules={[
              { required: true, message: "请填写有效售价" },
              {
                type: "number",
                min: 0.01,
                max: 1000000,
                message: "售价需大于 0 且不超过 1,000,000 元",
              },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0.01}
              max={1000000}
              precision={2}
              prefix="¥"
              placeholder="0.00"
            />
          </Form.Item>
          {(kind === "subscription" || kind === "tokens") && (
            <Form.Item
              name="tokens"
              label={
                kind === "subscription" ? "每月发放 Token" : "补充 Token 数量"
              }
              extra="使用完整整数填写：1B = 1,000,000,000 Token。"
              rules={[
                { required: true, message: "请填写 Token 数量" },
                {
                  type: "integer",
                  min: 1,
                  max: Number.MAX_SAFE_INTEGER,
                  message: "Token 数量需为有效正整数",
                },
              ]}
            >
              <InputNumber
                {...inputLimits}
                style={{ width: "100%" }}
                placeholder="1,000,000,000"
                formatter={(value) =>
                  String(value ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => Number(value?.replace(/,/g, "") || 0)}
              />
            </Form.Item>
          )}
          {(kind === "subscription" || kind === "feature") && (
            <Form.Item
              name="capabilityIds"
              label={kind === "subscription" ? "包含功能" : "开放功能"}
              extra="直接选择具体能力，不配置权限等级；平台停用仍会阻止使用。"
              rules={[
                {
                  required: true,
                  type: "array",
                  min: 1,
                  message: "请至少选择一项功能",
                },
              ]}
            >
              <Select
                mode="multiple"
                maxTagCount="responsive"
                options={capabilityOptions}
                placeholder="请选择具体功能"
                optionFilterProp="label"
              />
            </Form.Item>
          )}
          {kind === "bundle" && (
            <>
              <Divider titlePlacement="start">固定包含项</Divider>
              <Form.Item name="subscriptionId" label="包含订阅">
                <Select
                  allowClear
                  placeholder="不包含订阅"
                  options={state.products
                    .filter((p) => p.kind === "subscription")
                    .map((p) => ({
                      value: p.id,
                      label: `${p.name}${p.enabled ? "" : "（已下架）"}`,
                    }))}
                />
              </Form.Item>
              {formSubscription && (
                <Form.Item
                  name="months"
                  label="订阅月数"
                  initialValue={1}
                  extra="本版仅演示首次订阅，固定为 1 个月。"
                >
                  <InputNumber
                    min={1}
                    max={1}
                    disabled
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              )}
              <Form.Item name="tokenProductId" label="包含额度包">
                <Select
                  allowClear
                  placeholder="不包含额度包"
                  options={state.products
                    .filter((p) => p.kind === "tokens")
                    .map((p) => ({
                      value: p.id,
                      label: `${p.name} · ${formatTokens(p.tokens)}${p.enabled ? "" : "（已下架）"}`,
                    }))}
                />
              </Form.Item>
              <Form.Item name="featureProductIds" label="包含额外功能">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="不包含额外功能"
                  options={state.products
                    .filter((p) => p.kind === "feature")
                    .map((p) => ({
                      value: p.id,
                      label: `${p.name}${p.enabled ? "" : "（已下架）"}`,
                    }))}
                />
              </Form.Item>
              <div className="admin-bundle-preview">
                <span>套餐权益预览</span>
                <strong>
                  {formatTokens(
                    bundleTokens({
                      subscriptionId: formSubscription,
                      tokenProductId: formTokenProduct,
                    }),
                  )}{" "}
                  Token
                </strong>
                <p>
                  {
                    bundleFeatures({
                      subscriptionId: formSubscription,
                      featureProductIds: formFeatureProducts,
                    }).length
                  }{" "}
                  项功能 · 首次购买一次发放
                </p>
                <small>包含项仅决定权益，固定售价仍使用上方填写的金额。</small>
              </div>
            </>
          )}
          <Form.Item name="enabled" label="上架状态" valuePropName="checked">
            <Switch checkedChildren="已上架" unCheckedChildren="已下架" />
          </Form.Item>
        </Form>
      </Drawer>
      <Drawer
        title="编辑能力配置"
        open={!!editingCapability}
        onClose={() => !saving && setEditingCapability(null)}
        width={460}
        className="admin-editor"
        destroyOnHidden
        footer={
          <div className="admin-drawer-actions">
            <Button
              disabled={saving}
              onClick={() => setEditingCapability(null)}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => void commitCapability()}
            >
              保存配置
            </Button>
          </div>
        }
      >
        {editingCapability && (
          <>
            <div className="admin-capability-owner">
              <Avatar
                shape="square"
                size={44}
                style={{
                  background: `${agentById(editingCapability.agentId).color}18`,
                  color: agentById(editingCapability.agentId).color,
                }}
              >
                {agentById(editingCapability.agentId).initial}
              </Avatar>
              <div>
                <strong>{agentById(editingCapability.agentId).name}</strong>
                <span>固定 Agent · 归属不可更改</span>
              </div>
            </div>
            <Form<Capability> form={capabilityForm} layout="vertical">
              <Form.Item
                name="name"
                label="能力名称"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "请填写能力名称",
                  },
                  { max: 30, message: "名称最多 30 个字" },
                ]}
              >
                <Input maxLength={30} />
              </Form.Item>
              <Form.Item
                name="description"
                label="能力说明"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "请填写能力说明",
                  },
                  { max: 160, message: "说明最多 160 个字" },
                ]}
              >
                <Input.TextArea rows={3} maxLength={160} showCount />
              </Form.Item>
              <Form.Item
                name="enabled"
                label="平台开放状态"
                valuePropName="checked"
                extra="停用后保留 H5 入口与历史结果，但阻止新执行。"
              >
                <Switch checkedChildren="已开放" unCheckedChildren="已停用" />
              </Form.Item>
            </Form>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="所属插件">
                {state.plugins.find((p) => p.id === editingCapability.pluginId)
                  ?.name || "未配置"}
              </Descriptions.Item>
              <Descriptions.Item label="展示方式">
                预置表单、任务卡片与结果详情
              </Descriptions.Item>
              <Descriptions.Item label="模拟消耗">
                {exactTokens(editingCapability.cost)} Token / 次成功生成
              </Descriptions.Item>
            </Descriptions>
            <Alert
              type="warning"
              showIcon
              title="平台配置优先"
              description="能力和所属插件均启用后，才继续检查个人权益与余额。购买功能不能绕过平台停用。"
              style={{ marginTop: 20 }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
