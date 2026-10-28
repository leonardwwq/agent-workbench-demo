import { test, expect } from "@playwright/test";

test("经营主线、编辑采用、邀约、到店和刷新恢复", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/app/chat/control");
  await page
    .getByRole("textbox", { name: "发送给总控助手的消息" })
    .fill("这周想增加到店，先做护理体验活动，再邀约老客");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await page.getByRole("button", { name: "确认行动计划", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "去做引流活动", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "去做引流活动", exact: true }).click();
  await page
    .getByRole("button", { name: "开始引流活动", exact: false })
    .click();
  await page.getByRole("button", { name: "生成方案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "任务详情", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑内容", exact: true }).click();
  await page
    .locator("textarea")
    .fill(
      "本周水润护理体验活动\n预约制体验，先了解顾客需求再安排服务。\n每日限8个预约名额，全部数据为模拟。",
    );
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.getByRole("button", { name: "确认采用活动", exact: true }).click();
  await page
    .getByRole("button", { name: "引用活动，去邀约客户", exact: true })
    .click();
  await page.getByRole("button", { name: "生成方案", exact: true }).click();
  await page.getByRole("button", { name: "确认模拟触达", exact: true }).click();
  await page
    .locator(".adm-dialog")
    .getByRole("button", { name: "确认模拟触达", exact: true })
    .click();
  await expect(page.getByText("已模拟触达", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "登记到店", exact: true })
    .first()
    .click();
  await expect(
    page.locator("#root").getByText("已记录模拟到店", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/app/data");
  await expect(
    page.locator(".m-stat").filter({ hasText: "模拟到店" }).locator("strong"),
  ).toContainText("1");
  await page.reload();
  await expect(
    page.locator(".m-stat").filter({ hasText: "模拟到店" }).locator("strong"),
  ).toContainText("1");
  await page.goto("/#/app/ledger");
  await expect(
    page.getByText("2,999,996,500", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/h5-main.png", fullPage: true });
});

test("跨标签页能力开关优先、购买和四类商品金额一致", async ({
  page,
  context,
}) => {
  await page.goto("/#/app/form/video");
  await expect(
    page.getByText("当前账号未开通此功能", { exact: false }),
  ).toBeVisible();
  const admin = await context.newPage();
  await admin.setViewportSize({ width: 1440, height: 1000 });
  await admin.goto("/#/admin");
  await admin.getByRole("button", { name: "配置", exact: true }).click();
  await admin.getByRole("combobox", { name: "包含功能" }).click();
  await admin.getByText("短视频 · 短视频脚本", { exact: true }).click();
  await admin.getByText("编辑订阅方案", { exact: true }).click();
  await admin.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "生成方案", exact: true }),
  ).toBeVisible();
  await admin
    .getByRole("button", { name: "robot Agent 配置", exact: true })
    .click();
  await admin
    .getByRole("switch", { name: "短视频脚本开放状态", exact: true })
    .click();
  await expect(
    admin.getByRole("switch", { name: "短视频脚本开放状态", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByText("平台暂未开放此功能", { exact: false }),
  ).toBeVisible();
  await admin
    .getByRole("switch", { name: "短视频脚本开放状态", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "生成方案", exact: true }),
  ).toBeVisible();
  await page.goto("/#/app/purchase");
  await page.getByText("额度", { exact: true }).click();
  await page.getByRole("button", { name: "模拟购买", exact: true }).click();
  await page.getByRole("button", { name: "确认模拟购买", exact: true }).click();
  await expect(
    page.getByText("4,000,000,000 Token", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/app/form/video");
  await page.getByRole("button", { name: "生成方案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "任务详情", exact: true }),
  ).toBeVisible();
  await page.goto("/#/app/ledger");
  await expect(
    page.getByText("3,999,997,500", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/#/app/purchase");
  await admin
    .getByRole("button", { name: "重置购买演示", exact: true })
    .click();
  await admin.getByRole("button", { name: "确认重置", exact: true }).click();
  await expect(
    page.getByText("0 Token", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("套餐", { exact: true }).click();
  await expect(page.getByText("4B Token", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "模拟购买", exact: true }).click();
  await page.getByRole("button", { name: "确认模拟购买", exact: true }).click();
  await expect(
    page.getByText("4,000,000,000 Token", { exact: true }),
  ).toBeVisible();
  await admin.screenshot({
    path: "test-results/pc-config.png",
    fullPage: true,
  });
});

test("360px到430px布局无横向溢出、聊天面板和输入可共存", async ({ page }) => {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#/app");
    await expect(
      page.getByRole("heading", { name: "青禾工作台", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/#/app/chat/control");
  await page.getByRole("button", { name: "打开工作概览", exact: true }).click();
  await page
    .getByRole("button", { name: "完全打开工作面板", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "发送给总控助手的消息" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "发送给总控助手的消息" })
    .fill("汇总进展");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "打开工作概览", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/h5-chat.png", fullPage: true });
});

test("招聘文案与运营待办形成独立闭环", async ({ page }) => {
  await page.goto("/#/app/form/recruit");
  await page.getByRole("button", { name: "生成方案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "任务详情", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑内容", exact: true }).click();
  await page
    .locator("textarea")
    .fill("招聘美容师，重视沟通与服务，欢迎了解门店。");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(
    page.getByText("招聘美容师，重视沟通与服务，欢迎了解门店。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#/app/form/operations");
  await page.getByRole("button", { name: "生成方案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "任务详情", exact: true }),
  ).toBeVisible();
  const todo = page.locator(".m-todo").first();
  await todo.click();
  await expect(todo.locator("span.done")).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".m-todo").first().locator("span.done"),
  ).toBeVisible();
});

test("刷新运行中任务后不扣额且可以重试", async ({ page }) => {
  await page.goto("/#/app/form/growth");
  await page.getByRole("button", { name: "生成方案", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve, reject) => {
            const open = indexedDB.open("qinghe-agent-workbench-v1");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const req = db
                .transaction("state")
                .objectStore("state")
                .get("app");
              req.onsuccess = () => {
                resolve(
                  req.result?.value.tasks.some(
                    (t: { status: string }) => t.status === "running",
                  ),
                );
                db.close();
              };
              req.onerror = () => reject(req.error);
            };
          }),
      ),
    )
    .toBe(true);
  await page.reload();
  await page.goto("/#/app/chat/growth");
  await expect(page.getByText("已中断", { exact: true })).toBeVisible();
  await page.locator(".m-chat-task").click();
  await expect(
    page.getByRole("heading", { name: "任务已中断", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "使用原输入重试", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "确认采用活动", exact: true }),
  ).toBeVisible();
  await page.goto("/#/app/ledger");
  await expect(
    page.getByText("2,999,998,000", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".m-record")).toHaveCount(1);
});
