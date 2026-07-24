# 文清 AI 1.2.2 — 学术表达优化工具

面向中文本科和硕士论文的**段落级学术表达优化工具**。用户逐段选择处理内容，保留原意、数字、引用和专业术语，原文与修改结果对照显示，确认后写入版本，按实际处理字数计费。

> 本工具仅辅助语言表达优化，用户应自行核对事实、数据、引用和学校相关学术规范。

## 功能（V1）

- 邮箱验证码登录（预留短信通道）
- 新建项目：粘贴文本或上传 `.docx`，自动按段落拆分
- 三档改写强度：**普通降重** / **深度降重** / **至尊降重**（按倍率计费）
- 锁定术语（AI 不改动指定词）
- 原文 / 结果对照，接受 / 重试 / 手动编辑 / 撤销
- AI 输出自动质量校验（术语、数字、引用编号、空值、截断）
- 异步任务队列 + 失败自动重试一次 + 失败不扣费
- 字数套餐购买（微信扫码支付）、余额与消费记录
- 导出干净版 Word

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| 后端 | Next.js API Routes |
| 数据库 | PostgreSQL + Prisma |
| 任务队列 | Redis + BullMQ（独立 Worker 进程） |
| Word 解析/导出 | Mammoth / docx |
| AI | OpenAI 兼容适配层（可接 DeepSeek / 智谱 / 通义等） |
| 支付 | 微信支付 V3 |

## 目录结构

```
src/
├── app/
│   ├── login/                 登录页
│   ├── (dashboard)/           登录后布局
│   │   ├── projects/          项目列表 + 工作台 [id]
│   │   ├── credits/           购买字数
│   │   └── orders/            使用记录
│   └── api/                   auth / projects / process / tasks / paragraphs / credits / payment
├── components/
│   ├── ui/                    Button, Badge
│   ├── layout/                Sidebar
│   └── editor/                WorkBench, ParagraphCard, DiffView, ModeSelector, TermLockInput
├── lib/
│   ├── ai/                    adapter（模型调用）, prompts（提示词）, validator（质量校验）
│   ├── word/                  parser（解析）, exporter（导出）
│   ├── queue/                 processor（BullMQ 任务处理）
│   ├── payment/               wechat（微信支付）
│   ├── billing.ts             计费规则（汉字/字母/数字计费）
│   ├── session.ts             iron-session 登录态
│   └── db.ts                  Prisma 客户端
└── worker/                    独立 Worker 进程入口
```

## 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env   # 填写 DATABASE_URL / REDIS_URL / AI_API_KEY 等

# 3. 初始化数据库
npm run db:push
npm run db:seed        # 写入套餐数据

# 4. 启动 Web（终端 1）
npm run dev

# 5. 启动 Worker（终端 2，处理 AI 任务）
npm run worker
```

前置依赖：本地或远端的 **PostgreSQL** 与 **Redis**。

## 计费规则

- 按提交正文中的**汉字、字母、数字**统计字数，不计标点和空格
- 实际扣费 = 字数 × **改写强度倍率**：普通降重 ×1.0、深度降重 ×1.8、至尊降重 ×3.0（向上取整）
- 生成前展示预计消耗（含等级对比预览）；**通过质量校验即扣费**，与是否接受结果无关
- **每段首次重试免费**（同一原文 + 同一等级）
- 生成失败不扣费；购买字数有效期 12 个月

## AI 质量规则

模型不改变事实/数字/引用/锁定术语，不伪造参考文献，只输出正文。生成后自动校验，失败自动重试一次，仍失败则不扣费并提示用户。详见 [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts) 与 [src/lib/ai/validator.ts](src/lib/ai/validator.ts)。

## 部署

```bash
npm install
npm run build
npx prisma migrate deploy   # 生产环境用 migrate deploy，不要用 db push
npm run db:seed
pm2 start ecosystem.config.js   # 同时拉起 web + worker
```

环境变量见 [.env.example](.env.example)。上线前务必配置：
- `SESSION_SECRET`（≥32 位随机串）
- SMTP_*（验证码邮件发送）
- WECHAT_*（含 `WECHAT_APIV3_KEY` 与 `WECHAT_PLATFORM_CERT_PATH`，用于回调验签解密）

健康检查：`GET /api/health`

## 已实现（本轮加固）

- ✅ 微信支付回调**签名验证 + resource AES-256-GCM 解密**（[src/lib/payment/wechat.ts](src/lib/payment/wechat.ts)）
- ✅ OTP 验证码**邮件实际发送**（nodemailer，[src/lib/mailer.ts](src/lib/mailer.ts)）
- ✅ 验证码发送/校验**频率限制 + 防爆破**（Redis，[src/lib/rateLimit.ts](src/lib/rateLimit.ts)）
- ✅ 上传文件**类型校验**、登出**跳转健壮性**、健康检查接口
- ✅ 前端**支付状态轮询 + 二维码渲染**（[credits/CreditsClient.tsx](src/app/(dashboard)/credits/CreditsClient.tsx)）

## 1.2.0 三档改写强度

将原来的“保守改写 / 学术润色”两种模式升级为面向客户的三档服务，统一表述为“表达优化 / 改写强度”，不承诺具体查重结果。

| 等级 | 强度 | 处理内容 | 计费倍率 |
|------|------|----------|----------|
| 普通降重 standard | 低 | 同义替换、句式微调、删冗余、轻微语序优化 | ×1.0 |
| 深度降重 deep | 中 | 重组句子、调整衔接、主被动转换、合并拆分、口语转书面 | ×1.8 |
| 至尊降重 premium | 高 | 重构表达逻辑、重写句群、增强学术风格、处理重复模板 | ×3.0 |

- 等级配置集中在 [src/lib/modes.ts](src/lib/modes.ts)：名称、说明、倍率、温度、输出上限、预计耗时。
- 计费改为 `实际字数 × 等级倍率`（向上取整），三档共用统一质量约束（不改数字/引用/术语、不伪造文献、不补写事实）。
- 提交前新增**等级对比预览**：原文字数、所选等级、预计扣除字数、预计完成时间。
- 历史任务的旧枚举（conservative→普通、polish→深度）自动兼容展示。

## 1.1.1 安全修复

- 余额扣除改为数据库条件更新，避免并发覆盖和超额消费
- 退款仅对已扣费任务生效，避免 AI 失败时凭空增加余额
- 支付订单使用状态条件更新，重复回调不会重复充值
- 支付回调校验商户、应用、金额和币种
- 微信支付未配置或渠道异常时返回明确错误
- 验证码使用密码学安全随机数，并以 HMAC 摘要形式存储
- 代理请求头默认不受信任，需通过 `TRUST_PROXY_HEADERS` 显式开启
- 同步依赖锁文件并升级 Next.js 14 补丁及关键生产依赖

### 本地模拟支付

在 `.env` 中设置 `PAYMENT_MODE="mock"` 并以开发模式启动。创建订单后，支付弹窗会显示“确认模拟支付”按钮；该接口在生产环境始终不可用，也不会产生真实扣款。

## 待完善（后续版本）

- 微信支付**平台证书自动轮换**（当前从固定路径读取，证书更新需手动替换）
- 短信验证码通道接入
- 后台管理（用户/订单查询、人工补发字数、模型成本监控）
- 内容安全检查、异常账号封禁
- 文件存储接入 OSS / COS（当前预留 local 模式）
- 修订标记 Word、查重报告解析
