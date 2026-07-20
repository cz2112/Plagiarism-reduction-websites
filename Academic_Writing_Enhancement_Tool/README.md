# 文清 AI — 学术表达优化工具

面向中文本科和硕士论文的**段落级学术表达优化工具**。用户逐段选择处理内容，保留原意、数字、引用和专业术语，原文与修改结果对照显示，确认后写入版本，按实际处理字数计费。

> 本工具仅辅助语言表达优化，用户应自行核对事实、数据、引用和学校相关学术规范。

## 功能（V1）

- 邮箱验证码登录（预留短信通道）
- 新建项目：粘贴文本或上传 `.docx`，自动按段落拆分
- 两种处理模式：**保守改写** / **学术润色**
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

- 按提交正文中的**汉字、字母、数字**计费，不计标点和空格
- 生成前展示预计消耗；**通过质量校验即扣费**，与是否接受结果无关
- **每段首次重试免费**（同一原文 + 同一模式）
- 生成失败不扣费；购买字数有效期 12 个月

## AI 质量规则

模型不改变事实/数字/引用/锁定术语，不伪造参考文献，只输出正文。生成后自动校验，失败自动重试一次，仍失败则不扣费并提示用户。详见 [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts) 与 [src/lib/ai/validator.ts](src/lib/ai/validator.ts)。

## 待完善（后续版本）

- 微信支付回调**签名验证与 resource 解密**（当前为占位）
- OTP 验证码**实际发送**（SMTP / 短信）
- 后台管理（用户/订单查询、人工补发字数、模型成本监控）
- 请求频率限制、内容安全检查、异常账号封禁
- 文件存储接入 OSS / COS（当前预留 local 模式）
- 深度降重模式、修订标记 Word、查重报告解析
```
