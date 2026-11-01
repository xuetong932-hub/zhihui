# 第 8 项设计：服务端年龄准入、登录方式绑定与重复账号合并

状态：设计稿（2026-11-01）。本文的 SQL 和接口均**未在真实 Supabase 项目执行或验证**，不能据此声称功能已可用。实现前需要用户提供或创建云项目。

依据：Supabase 官方文档（2026-11-01 查阅）——[身份关联](https://supabase.com/docs/guides/auth/auth-identity-linking)、[注册前钩子](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)、[访问令牌钩子](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)。

## 1. 现状与问题

| 现状 | 问题 |
|---|---|
| 生日只在浏览器判断，写入本机 `profile.adultVerification` | 改本机存储或直接调用云 API 即可绕过 |
| 发送验证码时附带 `data:{adult_confirmed:true}` | 客户端自填的元数据，服务端不能信任 |
| `learning_snapshots` 的 RLS 只检查 `auth.uid()` | 没有成年记录的账号也能读写云数据 |
| 邮箱、手机号、Google、Apple 各自登录 | 同一人用不同方式登录会得到多个账号，没有绑定和合并 |

## 2. 目标与诚实边界

- **目标**：每个云账号在读写任何云数据前，必须在服务端留下一条成年准入记录；同一人的多种登录方式归到一个账号；已产生的重复账号可由用户自己安全合并。
- **边界**：生日仍是用户**自报**。服务端做的是“用可信时钟判断、只记结果、拒绝后不允许同一账号反复改生日重试”，**不是身份验证**。更强的验证（应用商店年龄信号、证件核验服务）有成本和合规要求，列为后续可选项，不在第一版。
- **最小化数据**：生日只在一次请求中用于计算，不写库、不写日志；只保存成年状态、方式、时间和政策版本。
- **只用本机、不登录**的用户仍是前端判断。文案已如实说明，这里不改变。

## 3. 年龄准入

### 3.1 流程

1. 用户登录（任意方式）后，客户端调用 `account_status()` 查询准入状态。
2. 状态为 `missing`：显示一次性准入页，要求输入生日（可预填“本机已确认”的提示，但仍需重新输入）。客户端调用 `attest_adult(birthdate, policy_version)`。
3. 服务端计算年龄：
   - 满 18 岁：写入 `adult`。
   - 未满 18 岁：写入 `denied`。该账号以后不能再提交（防止换生日重试），客户端退出登录并显示“仅限成年人”。
4. 状态为 `adult` 才能访问 `learning_snapshots` 等数据。由 RLS 强制，与客户端无关。
5. 注册时不再发送 `adult_confirmed` 元数据（即使发送，服务端也忽略）。

### 3.2 为什么不在注册前拦截

注册前钩子（before-user-created）可以拒绝创建用户，但 Google/Apple 登录时拿不到生日；验证码登录的元数据又是客户端自填的。所以用“**允许创建账号，未准入前不能访问任何数据**”的方式：

- 拦截点统一，四种登录一致。
- 注册前钩子留作 IP、频率、地区限制等滥用防护，不承担年龄判断。

### 3.3 跨时区的生日判定

服务端统一用**全球最晚的日期**判断：UTC−12 的当前日期，即 `(now() at time zone 'UTC' - interval '12 hours')::date`。

- 不会有人在当地生日之前提前通过。
- 东部时区的人最多晚约一天通过。准入页会提示“今天生日可明天再试”。

### 3.4 数据库草案（未执行）

```sql
-- 账号准入记录：不含生日
create table public.account_eligibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('adult','denied')),
  method text not null check (method in ('self-declared-birthdate')),
  policy_version text not null check (length(policy_version) <= 20),
  decided_at timestamptz not null default now()
);
alter table public.account_eligibility enable row level security;
revoke all on public.account_eligibility from anon, authenticated;
-- 只能通过下面的函数读写，客户端不能直接写 status。

create or replace function public.is_adult() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_eligibility
                where user_id = auth.uid() and status = 'adult');
$$;

create or replace function public.account_status() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select status from public.account_eligibility where user_id = auth.uid()), 'missing');
$$;

create or replace function public.attest_adult(birthdate date, policy_version text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  latest_date date := ((now() at time zone 'UTC') - interval '12 hours')::date;
  result text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.account_eligibility where user_id = auth.uid()) then
    raise exception 'Eligibility already decided';  -- adult 不需重复；denied 不允许重试
  end if;
  if birthdate is null or birthdate < date '1900-01-01' or birthdate > latest_date then
    raise exception 'Invalid birthdate';
  end if;
  -- age() 对 2 月 29 日生日在平年按 3 月 1 日满岁，与前端 isAdult 一致
  result := case when extract(year from age(latest_date, birthdate)) >= 18 then 'adult' else 'denied' end;
  insert into public.account_eligibility(user_id, status, method, policy_version)
  values (auth.uid(), result, 'self-declared-birthdate', policy_version);
  return result;  -- birthdate 只在本次调用中使用，不写入任何表
end;
$$;
revoke all on function public.attest_adult(date, text) from public, anon;
grant execute on function public.attest_adult(date, text), public.account_status(), public.is_adult() to authenticated;

-- 现有快照表的 RLS 增加准入条件
drop policy if exists own_snapshot on public.learning_snapshots;
create policy own_snapshot on public.learning_snapshots for all to authenticated
using ((select auth.uid()) = user_id and (select public.is_adult()))
with check ((select auth.uid()) = user_id and (select public.is_adult()));
```

注意事项：

- 生日作为 RPC 参数经 HTTPS 发送，Supabase 的 API 网关或数据库日志可能记录请求参数。实现时要确认项目的日志设置，必要时改用 Edge Function 接收并只把计算结果写库。这一点需要在真实项目上核实。
- `denied` 账号仍可调用 `delete_own_account()` 自行注销。
- 访问令牌钩子可以把准入状态加进 JWT 以减少查询，但状态变化要等令牌刷新才生效。第一版用表查询即可，不使用钩子。

## 4. 登录方式绑定（避免产生重复账号）

### 4.1 Supabase 已有能力

- **自动关联**：用 OAuth（Google/Apple）登录时，如果已有用户使用**相同且已验证的邮箱**，新身份会自动关联到该用户。所以邮箱验证码账号和同邮箱的 Google 账号天然是一个账号。
- **手动关联**（需在项目中开启 manual linking）：已登录用户调用 `linkIdentity({provider})` 跳转授权，关联另一个邮箱的 Google/Apple。
- **解除关联**：用户至少有 2 个身份时才能解除。
- 手机号、邮箱可通过更新用户资料并完成验证码确认，加到当前账号上。

### 4.2 容易产生重复账号的情况

| 情况 | 结果 | 设计应对 |
|---|---|---|
| 邮箱验证码 + 同邮箱 Google | 自动同一账号 | 无需处理 |
| Apple“隐藏邮箱”（中继地址） | 邮箱不同 → 新账号 | 登录页提示；账号页提供“关联 Apple” |
| 先用手机号，后用邮箱或 Google | 无共同标识 → 新账号 | 登录后检查本机归属（见下），引导绑定或合并 |
| 换设备后忘了上次的方式 | 可能新建账号 | 本机记住“上次登录方式”（只存方式名，不存账号） |

### 4.3 客户端设计（账号页）

- **已关联的登录方式**：列出当前账号的身份（邮箱/手机号打码显示），提供“关联 Google”“关联 Apple”“添加手机号”“添加邮箱”“解除关联”（仅剩一个时禁用）。
- **登录后防重复提示**：复用已实现的本机数据归属记录（`knowledge-review.local-owner.v1`）。如果本机记录属于账号 A（打码显示），而这次登录的是一个**新建的、没有云数据的**账号 B，显示：

  > 这台设备上的记录属于另一个账号（al***@example.com）。你可能用了不同的登录方式。
  > [切换回原账号] [把这种登录方式合并到原账号] [继续使用新账号]

- 判断“新建”：账号创建时间在 5 分钟内，且没有快照。只提示，不自动做任何事。

## 5. 重复账号合并

### 5.1 原则

- 只由用户主动发起，且必须**同时证明拥有两个账号**：两个账号在 10 分钟内都重新登录过。
- 学习数据是端到端加密的，服务端无法合并密文，所以**数据合并在客户端完成**，需要两个账号的同步口令。
- Supabase 不能把一个身份从用户 B 直接移给用户 A。做法是：数据并入 A → 删除 B → 在 A 上重新关联 B 原来的登录方式。
- 任何一个账号是 `denied` 状态，都不允许合并。

### 5.2 步骤

1. 用户在账号 A（保留）中点“合并另一个账号”，阅读说明后用 B 的方式重新登录。客户端同时持有 A、B 的会话，只在内存中。
2. 客户端用两个口令分别下载并解密 A、B 的快照，在本机合并（规则见 5.3），显示合并预览（各类数量、冲突数），用户确认。
3. 合并结果按 A 的版本号条件上传（沿用现有冲突检查）。失败则停止，什么都不删。
4. 调用 Edge Function `merge-delete-source`，同时提交 A、B 的访问令牌。服务端校验：
   - 两个令牌都有效，签发时间都在 10 分钟内；
   - A 是 `adult`，且 A 的快照版本已更新；
   - 以服务端权限删除 B（快照随之级联删除），写一条合并记录（只存 A 的 ID、B 的 ID 哈希、时间、B 的登录方式类型）。
5. 客户端引导用户在 A 上关联 B 原来的登录方式（`linkIdentity` 或添加手机号/邮箱）。即使这一步没完成，用户仍能用 A 原来的方式登录，不会丢数据。
6. 本机先把合并前的两份数据保存为本机备份（复用现有备份与撤销）。

服务端权限（service role）只存在于 Edge Function 中，绝不进入客户端。

### 5.3 本机合并规则（纯函数，可在本地完整测试）

| 数据 | 规则 |
|---|---|
| 学习设置 | 用 A 的；各模块“启用”取并集，水平取 A 的 |
| 问答对话 | 按对话 ID 合并；同 ID 时按消息 ID 合并，按时间排序 |
| 知识卡片 | 按卡片 ID 合并；同 ID 取 `updatedAt` 较新的内容，原始问答按 ID 取并集；同模块内同一规范化问题的不同卡片标为“可能重复”，交给用户手动合并，不自动合并 |
| 忽略列表 | 并集 |
| 复习记录 | 按事件 ID 取并集；排程由事件推导，无需另算 |

合并后必须通过现有的 `validateSnapshot`（含大小上限），否则停止。

## 6. 中国大陆与海外

- Supabase 在中国大陆的可达性、短信服务商、Google 登录不可用等问题，决定了大陆区需要单独的后端或服务商。
- 第一版设计按**区域独立账号**：账号属于一个区域，不做跨区域合并。区域选择放在登录页，并写入本机云配置。
- 年龄准入、绑定、合并的接口保持与具体服务商无关（`account_status / attest_adult / 合并步骤`），换后端时只替换适配层。

## 7. 实施顺序与验证

| 步骤 | 内容 | 本地可验证 | 需真实项目 |
|---|---|---|---|
| 1 | 客户端：停止发送 `adult_confirmed`；登录后查询准入状态；准入页；`denied` 退出 | 用模拟响应验证界面流程 | RPC 与 RLS 实际生效 |
| 2 | SQL：准入表、函数、RLS 更新 | 可用本机 Postgres 跑函数逻辑（不含 Supabase auth） | 真实 auth.uid()、日志是否记录参数 |
| 3 | 账号页：身份列表、关联与解除 | 界面 | OAuth 回调、manual linking 开关 |
| 4 | 防重复提示 | 完整（复用本机归属） | — |
| 5 | 合并：本机合并纯函数与预览 | 完整单元测试 | — |
| 6 | 合并：Edge Function 删除源账号 | 函数逻辑单元测试 | 部署、令牌校验、删除与级联 |

进度（2026-11-01）：1、4、5 已实现并在本地测试（第 1 步的 SQL 已写入 `cloud-schema.sql`，但只用模拟响应验证过客户端）。第 5 步的合并函数在 `snapshot-merge.js`，目前已用于 JSON 导入的合并选项。疑似重复的卡片只报告数量，不加标记，用户可在知识库手动合并。2、3、6 需要用户准备好 Supabase 项目后再联调。

## 8. 需要用户决定的事项

1. **第一版年龄准入强度**：本设计为“服务端判断的自报生日 + 拒绝后不可重试”。是否需要第三方年龄或身份核验（会产生费用，并涉及证件数据合规）？
2. **被拒账号**：设计为永久不可重试，只能注销。是否需要人工申诉渠道？
3. **是否提供合并功能**：合并需要两个同步口令，流程较长。也可以第一版只做“绑定 + 防重复提示”，合并延后。
