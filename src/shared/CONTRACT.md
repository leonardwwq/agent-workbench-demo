# Shared mock API contract (implementation instructions)
`types.ts` and `catalog.ts` are owned by root; do not edit without coordination.
`store.ts` exports the following (React hook plus plain async functions). Import types from types.ts. All mutations reject Error with readable Chinese message on validation errors. All money in yuan, Token integer, timestamps epoch ms.

- `initStore(): Promise<void>` initializes DB and recovery. Root calls before mount.
- `useApp(): AppState` stable snapshot via useSyncExternalStore.
- `getState(): AppState` current synchronous snapshot.
- `accessFor(capabilityId: string, state?: AppState): Access`
- `saveCapability(value: Capability): Promise<void>`; savePlugin(value:Plugin); saveProduct(value:Product). Existing IDs stable; new products allowed; no new Agent/capabilities/plugins.
- `saveProfile(value: Pick<Account,'name'|'storeName'|'service'>): Promise<void>`
- `purchase(productId:string): Promise<void>` validate eligibility and grant atomic order, tokens, features.
- `resetDemo(mode:'business'|'purchase'): Promise<void>` all config + business reset, change resetId; UI resets conversation draft itself.
- `sendChat(agentId:AgentId,text:string): Promise<void>` append user and deterministic supported reply; control intent produces unconfirmed plan card. No arbitrary model promise. No auto-paid task execution.
- `confirmPlan(planId:string): Promise<void>` creates 2 pending workflow instructions as chat cards to growth + customer, marks confirmed; actual generate via runTask. Use planId association. No duplicate.
- `runTask(agentId:AgentId,input:Record<string,string>,options?:{fail?:boolean;planId?:string}): Promise<string>` current corresponding capability auto determined, check balance etc. append user action and running task message; deterministic delay ~1200ms; success result or failed, charge only success; return task ID (after completed). input convention keys: title,project,period,target,constraint (growth); role,count,salary,highlights (recruit); focus (operations); activityId,group,target (customer); title,direction,duration (video). UI can use all string values.
- `saveResult(taskId:string,body:string): Promise<void>` editable result draft, freeze adopted/sent result.
- `adoptActivity(taskId:string): Promise<void>` growth only.
- `sendInvitation(taskId:string): Promise<void>` customer only, requires adopted linked activity; generate deterministic mock feedback, set sent; no token cost.
- `markArrival(taskId:string,customerId:string): Promise<void>` only sent invitations and eligible feedback customer.
- `toggleTodo(taskId:string,todoId:string): Promise<void>` operations only.

IDs seeded: capabilities `control-plan` (basic control), `recruit-copy`, `growth-plan`, `operations-todo`, `customer-invite`, `video-script`.
plugins `core`, `recruit-plugin`, `growth-plugin`, `operations-plugin`, `customer-plugin`, `video-plugin`.
products `sub-standard` (128, 3B, four non-video paid capabilities), `tokens-1b` (28,1B), `feature-video` (18, video-script), `bundle-starter` (158,sub-standard 1mo+tokens-1b+feature-video, 4B total dynamically resolved).
Business mode account subscription=sub-standard balance=3B, no orders/ledger/tasks; purchase mode none balance=0. 12 customers two group labels `近期活跃`/`待唤醒` each six.

Derived UI stats calculate from successful tasks/result adopted, customer sent customerIds, feedbackIds, arrivedIds. Counts dedupe globally as appropriate. `accessFor` includes token sufficiency (basic controls zero cost). Subscription live features + account featureIds union, platform plugin/cap enabled highest priority. All history survives disabling. Disabled products can't buy; subscription/bundle conflict guarded; same feature dup guarded; topup repeat allowed.
