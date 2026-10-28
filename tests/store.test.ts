import "fake-indexeddb/auto";
import { buildResult } from "../src/shared/mock-results";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  accessFor,
  adoptActivity,
  confirmPlan,
  getState,
  initStore,
  markArrival,
  purchase,
  resetDemo,
  runTask,
  saveCapability,
  savePlugin,
  saveProduct,
  saveResult,
  sendChat,
  sendInvitation,
} from "../src/shared/store";

beforeAll(async () => {
  await initStore();
});
beforeEach(async () => {
  await resetDemo("business");
});
const growthInput = {
  project: "面部护理",
  period: "未来 7 天",
  target: "12",
  constraint: "不强制办卡",
};

describe("购买、配置与执行共享状态", () => {
  it("套餐发放一次完整权益，重复点击只成功一次", async () => {
    await resetDemo("purchase");
    const results = await Promise.allSettled([
      purchase("bundle-starter"),
      purchase("bundle-starter"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const s = getState();
    expect(s.account.balance).toBe(4_000_000_000);
    expect(s.account.subscriptionId).toBe("sub-standard");
    expect(s.account.featureIds).toContain("video-script");
    expect(s.orders).toHaveLength(1);
    expect(s.ledger).toHaveLength(1);
    expect(s.orders[0].tokens).toBe(4_000_000_000);
  });
  it("套餐引用已下架商品时，交易失败且不部分发放", async () => {
    await resetDemo("purchase");
    const tokens = getState().products.find((p) => p.id === "tokens-1b")!;
    await saveProduct({ ...tokens, enabled: false });
    await expect(purchase("bundle-starter")).rejects.toThrow("下架");
    expect(getState().account.balance).toBe(0);
    expect(getState().account.subscriptionId).toBeNull();
    expect(getState().orders).toHaveLength(0);
  });
  it("当前订阅功能修改即时生效，平台和插件停用优先", async () => {
    expect(accessFor("video-script").kind).toBe("membership");
    const sub = getState().products.find((p) => p.id === "sub-standard")!;
    await saveProduct({
      ...sub,
      capabilityIds: [...sub.capabilityIds, "video-script"],
    });
    expect(accessFor("video-script").allowed).toBe(true);
    const cap = getState().capabilities.find((c) => c.id === "video-script")!;
    await saveCapability({ ...cap, enabled: false });
    expect(accessFor("video-script").kind).toBe("platform");
    await saveCapability({ ...cap, enabled: true });
    const plugin = getState().plugins.find((p) => p.id === "video-plugin")!;
    await savePlugin({ ...plugin, enabled: false });
    expect(accessFor("video-script").kind).toBe("platform");
  });
  it("商品改价和下架不更改历史订单或已购权益", async () => {
    await resetDemo("purchase");
    await purchase("sub-standard");
    const sub = getState().products.find((p) => p.id === "sub-standard")!;
    await saveProduct({ ...sub, price: 999, enabled: false, tokens: 1 });
    expect(getState().orders[0].price).toBe(128);
    expect(getState().account.balance).toBe(3_000_000_000);
    expect(accessFor("growth-plan").allowed).toBe(true);
  });
  it("单买功能不附带额度；相同功能不能重复购买", async () => {
    await resetDemo("purchase");
    await purchase("feature-video");
    expect(getState().account.balance).toBe(0);
    expect(accessFor("video-script").kind).toBe("balance");
    await expect(purchase("feature-video")).rejects.toThrow("重复购买");
    await purchase("tokens-1b");
    expect(accessFor("video-script").allowed).toBe(true);
  });
  it("重复生成点击共享一个任务，只扣一次", async () => {
    const [a, b] = await Promise.all([
      runTask("growth", growthInput),
      runTask("growth", growthInput),
    ]);
    expect(a).toBe(b);
    expect(getState().tasks).toHaveLength(1);
    expect(getState().ledger).toHaveLength(1);
    expect(getState().account.balance).toBe(2_999_998_000);
  });
  it("失败不扣额，再次生成只在成功后扣额", async () => {
    const failedId = await runTask("growth", growthInput, { fail: true });
    expect(getState().tasks.find((t) => t.id === failedId)?.status).toBe(
      "failed",
    );
    expect(getState().account.balance).toBe(3_000_000_000);
    expect(getState().ledger).toHaveLength(0);
    await runTask("growth", growthInput);
    expect(getState().account.balance).toBe(2_999_998_000);
  });
  it("运行中被平台停用，提交前复查并不扣额", async () => {
    const job = runTask("growth", growthInput);
    await new Promise((r) => setTimeout(r, 50));
    const cap = getState().capabilities.find((c) => c.id === "growth-plan")!;
    await saveCapability({ ...cap, enabled: false });
    await job;
    expect(getState().tasks[0].status).toBe("failed");
    expect(getState().ledger).toHaveLength(0);
  });
  it("重置使旧任务失效，不将结果写入新演示", async () => {
    const job = runTask("growth", growthInput);
    await new Promise((r) => setTimeout(r, 50));
    await resetDemo("purchase");
    await job;
    expect(getState().mode).toBe("purchase");
    expect(getState().tasks).toHaveLength(0);
    expect(getState().account.balance).toBe(0);
    expect(getState().ledger).toHaveLength(0);
  });
  it("活动采用后不可改写；邀约引用快照，模拟到店去重", async () => {
    const activityId = await runTask("growth", growthInput);
    await saveResult(activityId, "已编辑的模拟活动");
    await adoptActivity(activityId);
    await expect(saveResult(activityId, "覆盖活动")).rejects.toThrow(
      "不能修改",
    );
    const invitationId = await runTask("customer", {
      activityId,
      group: "近期活跃",
      target: "邀约 6 位客户",
    });
    let invitation = getState().tasks.find((t) => t.id === invitationId)!;
    expect(invitation.result?.fields.activitySnapshot).toBe("已编辑的模拟活动");
    await sendInvitation(invitationId);
    await sendInvitation(invitationId);
    invitation = getState().tasks.find((t) => t.id === invitationId)!;
    expect(invitation.result?.customerIds).toHaveLength(6);
    expect(invitation.result?.feedbackIds).toHaveLength(3);
    const customerId = invitation.result!.feedbackIds![0];
    await markArrival(invitationId, customerId);
    await markArrival(invitationId, customerId);
    expect(
      getState().tasks.find((t) => t.id === invitationId)!.result?.arrivedIds,
    ).toEqual([customerId]);
    expect(getState().account.balance).toBe(2_999_996_500);
  });
  it("运行中的报价固定，后台改价不追溯本次任务", async () => {
    const job = runTask("growth", growthInput);
    await new Promise((r) => setTimeout(r, 50));
    const cap = getState().capabilities.find((c) => c.id === "growth-plan")!;
    await saveCapability({ ...cap, cost: 4_000_000_000 });
    await job;
    expect(getState().tasks[0].status).toBe("success");
    expect(getState().tasks[0].cost).toBe(2000);
    expect(getState().account.balance).toBe(2_999_998_000);
  });
  it("汇总经营进展优先识别为汇总，不新增行动建议", async () => {
    await sendChat("control", "汇总经营进展");
    expect(getState().plans).toHaveLength(0);
    expect(getState().messages.at(-1)?.text).toContain("当前已完成");
  });
  it("自然语言仅生成建议，确认行动幂等且不自动扣费", async () => {
    await sendChat("control", "这周想增加到店，先做护理体验活动，再邀约老客");
    const plan = getState().plans[0];
    expect(plan.confirmed).toBe(false);
    expect(getState().tasks).toHaveLength(0);
    await confirmPlan(plan.id);
    const count = getState().messages.length;
    await confirmPlan(plan.id);
    expect(getState().messages).toHaveLength(count);
    expect(getState().plans[0].confirmed).toBe(true);
    expect(getState().account.balance).toBe(3_000_000_000);
  });
});

describe("生成文案的输入规范化", () => {
  it("活动名称不重复体验或活动后缀，目标保留已有单位或自由文本", () => {
    const state = getState();
    for (const [project, expected] of [
      ["水润护理体验", "水润护理体验活动"],
      ["面部护理", "面部护理体验活动"],
      ["护理体验活动", "护理体验活动"],
    ]) {
      const result = buildResult(
        "growth",
        { project, period: "未来 7 天内", target: "20 人" },
        state,
      );
      expect(result.title).toBe(expected);
      expect(result.body).toContain("到店目标：20 人");
      expect(result.body).not.toContain("体验体验");
      expect(result.body).not.toContain("人 位");
      expect(result.body).not.toContain("内内");
    }
    expect(
      buildResult("growth", { project: "面部护理", target: "20" }, state).body,
    ).toContain("到店目标：20 位");
    expect(
      buildResult(
        "growth",
        { project: "面部护理", target: "先确认意向，不设固定人数" },
        state,
      ).body,
    ).toContain("到店目标：先确认意向，不设固定人数\n");
  });
  it("招聘人数、邀约话术及脚本标题不重复单位或后缀", () => {
    const state = getState();
    const recruit = buildResult(
      "recruit",
      { role: "美容师", count: "2 名" },
      state,
    );
    expect(recruit.body).toContain("招聘人数：2 名");
    expect(recruit.body).not.toContain("名 位");
    expect(
      buildResult("recruit", { role: "美容师招聘文案", count: "2" }, state)
        .title,
    ).toBe("美容师招聘文案");
    const customer = buildResult(
      "customer",
      { project: "水润护理体验", target: "邀约 6 位客户" },
      state,
    );
    expect(customer.body).not.toContain("体验体验");
    expect(customer.body).toContain("本次目标：邀约 6 位客户\n");
    const video = buildResult(
      "video",
      { title: "护理短视频脚本", duration: "45" },
      state,
    );
    expect(video.title).toBe("护理短视频脚本");
    expect(video.body).toContain("建议时长：45 秒");
    expect(video.body).toContain("–45 秒");
    expect(
      buildResult("video", { title: "护理科普", duration: "1 分钟" }, state)
        .body,
    ).toContain("–60 秒");
  });
});
