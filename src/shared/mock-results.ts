import type { AppState, AgentId, BusinessResult } from "./types";

const text = (value: string | undefined, fallback: string) =>
  value?.trim() || fallback;
const humanCount = (value: string | undefined, fallback: string) => {
  const clean = text(value, fallback);
  return /^[\d０-９]+(?:\s*[-—~～至]\s*[\d０-９]+)?$/.test(clean)
    ? `${clean} 位`
    : clean;
};
const activityTitle = (project: string) =>
  /活动$/.test(project)
    ? project
    : /体验$/.test(project)
      ? `${project}活动`
      : `${project}体验活动`;

export function buildResult(
  agentId: AgentId,
  input: Record<string, string>,
  state: AppState,
): BusinessResult {
  const project = text(input.project, state.account.service || "面部护理");
  const title = text(input.title, activityTitle(project));
  const period = text(input.period, "未来 7 天");
  const goal = humanCount(input.target, "12");
  const role = text(input.role, "美容师");
  const recruitTitle = /招聘文案$/.test(role)
    ? role
    : /招聘$/.test(role)
      ? `${role}文案`
      : `${role}招聘文案`;
  const videoTitle = text(input.title, "门店护理体验");
  const duration = text(input.duration, "30 秒");
  const durationLabel = /^\d+(?:\.\d+)?$/.test(duration)
    ? `${duration} 秒`
    : duration;
  const secondsMatch = duration.match(/^(\d+(?:\.\d+)?)\s*(秒|分钟|分)?$/);
  const seconds = secondsMatch
    ? Math.max(
        6,
        Math.round(
          Number(secondsMatch[1]) *
            (secondsMatch[2]?.startsWith("分") ? 60 : 1),
        ),
      )
    : 30;
  const cuts = [
    0,
    Math.round(seconds / 6),
    Math.round(seconds / 2),
    Math.round((seconds * 5) / 6),
    seconds,
  ];
  const base = { title: "", body: "", fields: { ...input } };
  if (agentId === "growth")
    return {
      ...base,
      title,
      adopted: false,
      body: `${title}\n\n活动目标\n活动周期：${period}\n到店目标：${goal}\n通过老客邀约与预约体验，逐步推进目标；不将目标人数视为实际到店。\n\n主推内容\n围绕「${project}」推出预约制体验，每天安排两个体验时段，先确认顾客需求再推荐服务。\n\n执行安排\n1. 提前准备服务介绍、预约表和顾客常见问题。\n2. 从近期活跃及待唤醒老客中选择适合人群，发送个性化邀约。\n3. 每天闭店前整理预约、反馈和到店记录，第二天调整沟通内容。\n\n优惠边界\n${input.constraint || "不承诺效果，不强制办卡；具体价格和名额由门店确认。"}\n\n下一步\n确认采用后，客户经营助手可引用本活动生成邀约。此方案及后续执行数据均为模拟。`,
    };
  if (agentId === "recruit")
    return {
      ...base,
      title: recruitTitle,
      body: `寻找一起认真做服务的你\n\n${state.account.storeName}正在招聘${role}。\n招聘人数：${humanCount(input.count, "1")}\n我们相信，专业的手法和细致的沟通，值得被看见。\n\n你将负责\n• 接待顾客，了解护理需求并完成服务。\n• 做好服务记录、器具清洁和后续关怀。\n• 与店长一起维护舒适、有序的门店体验。\n\n我们提供\n${input.salary || "薪酬面议，尊重专业与服务经验。"}\n${input.highlights || "稳定的工作环境、清晰的成长路径和互相支持的团队。"}\n\n欢迎带着你的服务经验与我们聊聊。请通过门店公开联系方式预约沟通。\n\n本内容为模拟招聘文案，尚未向任何招聘平台发布。`,
    };
  if (agentId === "operations") {
    const items = [
      "检查今日体验服务物料与预约时段",
      "复核邀约反馈，跟进有意向但未预约的顾客",
      "闭店前整理活动进展与服务反馈",
    ];
    return {
      ...base,
      title: "今日门店行动清单",
      body: `今天先做好三件事\n\n关注事项：${input.focus || "围绕护理体验活动，提升预约与到店衔接。"}\n\n1. 开店前检查体验服务准备，预留稳定的接待时段。\n2. 午后集中跟进客户反馈，确认需求与预约时间。\n3. 闭店前复盘，记录阻碍到店的原因。\n\n待办完成情况会同步到工作面板。这里不涉及真实排班或收银数据。`,
      todos: items.map((text, i) => ({
        id: `todo-${i + 1}`,
        text,
        done: false,
      })),
    };
  }
  if (agentId === "customer") {
    const activity = state.tasks.find((t) => t.id === input.activityId);
    const customers = state.customers.filter(
      (c) => c.group === (input.group || "近期活跃"),
    );
    return {
      ...base,
      title: `${input.group || "近期活跃"} · 活动邀约`,
      activityId: activity?.id,
      customerIds: customers.map((c) => c.id),
      feedbackIds: [],
      arrivedIds: [],
      sent: false,
      fields: {
        ...input,
        activityTitle: activity?.result?.title || "",
        activitySnapshot: activity?.result?.body || "",
      },
      body: `邀约目标\n围绕「${activity?.result?.title || title}」，邀请${input.group || "近期活跃"}客户了解本次体验，优先确认有意向顾客的需求和时间。\n本次目标：${humanCount(input.target, "确认有意向顾客的需求和时间")}\n\n开场话术\n你好呀，最近护理状态怎么样？我们这周准备了「${activity?.result?.title || title}」，想先了解一下你最近的护理需求。感兴趣的话，我帮你看一个方便的时间。\n\n有兴趣时\n可以的，我先给你介绍本次内容和注意事项。你更方便工作日还是周末？确认时间后我们再为你预留。\n\n暂时没空时\n没关系，按你的时间来。如果最近有护理问题，也可以先告诉我们，不着急做决定。\n\n执行提醒\n只跟进主动回应的顾客；不反复催促。确认后仅生成模拟触达与反馈，不会发送真实消息。`,
    };
  }
  if (agentId === "video")
    return {
      ...base,
      title: /短视频脚本$/.test(videoTitle)
        ? videoTitle
        : `${videoTitle} · 短视频脚本`,
      body: `主题：${videoTitle}\n方向：${input.direction || "专业科普与真实服务体验"}\n建议时长：${durationLabel}\n\n镜头 1｜${cuts[0]}–${cuts[1]} 秒 · 提出问题\n画面：门店自然光下，护理师整理服务物料。\n口播：「换季皮肤紧绷，先别急着叠加护肤步骤。」\n\n镜头 2｜${cuts[1]}–${cuts[2]} 秒 · 专业解释\n画面：护理师面对镜头，搭配洁净的服务环境近景。\n口播：「先了解当下状态，选择适合自己的清洁与保湿方式，比一味加量更重要。」\n\n镜头 3｜${cuts[2]}–${cuts[3]} 秒 · 展示服务\n画面：需求沟通、服务准备、顾客休息区域，不拍摄未经许可的顾客面部。\n口播：「这次体验，我们从需求沟通开始，把每一步讲清楚。」\n\n镜头 4｜${cuts[3]}–${cuts[4]} 秒 · 轻量行动\n画面：门店招牌与预约提示。\n字幕：「想了解本次体验？先和我们聊聊你的需求。」\n\n拍摄提醒\n避免效果保证和夸大前后对比；人物出镜先获得许可。当前仅产出模拟脚本文本，不生成、剪辑或发布视频。`,
    };
  return {
    ...base,
    title: "经营行动建议",
    body: "先确认经营目标，再由引流与客户经营助手分别推进。",
  };
}
