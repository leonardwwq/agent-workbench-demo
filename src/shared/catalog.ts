import type { Agent, AgentId } from "./types";
export const AGENTS: Agent[] = [
  {
    id: "control",
    name: "总控助手",
    sender: "总控助手",
    description: "把经营目标变成可执行的行动",
    initial: "总",
    color: "#237A57",
  },
  {
    id: "recruit",
    name: "人才招聘",
    sender: "招聘助手",
    description: "让合适的人，看见你的门店",
    initial: "聘",
    color: "#537BA5",
  },
  {
    id: "growth",
    name: "获客引流",
    sender: "引流助手",
    description: "从一场好活动，开始新的到店",
    initial: "引",
    color: "#BB8544",
  },
  {
    id: "operations",
    name: "门店运营",
    sender: "运营助手",
    description: "理清今天的重点，有序推进",
    initial: "营",
    color: "#738668",
  },
  {
    id: "customer",
    name: "客户经营",
    sender: "客情助手",
    description: "让每一次关心，都恰到好处",
    initial: "客",
    color: "#B27783",
  },
  {
    id: "video",
    name: "短视频",
    sender: "短视频助手",
    description: "把门店的专业，变成好内容",
    initial: "影",
    color: "#8A7CB0",
  },
];
export const agentById = (id: AgentId) => AGENTS.find((a) => a.id === id)!;
export const formatTokens = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(2).replace(/\.00$/, "")}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(2).replace(/\.00$/, "")}M`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`
        : n.toLocaleString();
export const exactTokens = (n: number) => n.toLocaleString("en-US");
