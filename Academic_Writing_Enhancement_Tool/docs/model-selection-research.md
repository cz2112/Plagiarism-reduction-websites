# 文清三档改写的模型选型调研

调研日期：2026-07-23（价格、可用模型和限额会变化；上线前应以厂商控制台为准）。本调研只引用厂商官方文档或官方定价页。建议将模型名放在环境变量中，不要把以下名称硬编码到业务逻辑。

## 结论先行

| 改写档位 | 首选 | 备用 | 原因 |
| --- | --- | --- | --- |
| 普通降重 `standard` | DeepSeek 的低成本聊天模型（当前控制台中可用的 V3/V3.2 系列） | Qwen 的较小 Instruct 模型 | 句式微调任务对推理要求低，优先控制成本和延迟；两家均提供 OpenAI 兼容接口 |
| 深度降重 `deep` | Qwen3-Plus（或阿里云百炼控制台中对应的最新通用模型） | GLM-4.5-Air/同级模型 | 中文表达、长上下文和价格之间较均衡，适合作为默认主力 |
| 至尊降重 `premium` | OpenAI GPT-5 系列中控制台可用的高能力模型 | Kimi K2 系列或 GLM-4.5 | 复杂段落需要更强的指令遵循、事实保留和自检；应配合更严格的输出校验 |

这是一种“同一服务商优先、可替换”的部署方案：先用一家服务商的三个可用模型完成基准测试，再按成本和中文质量调整。不要仅通过提高 temperature 区分等级，temperature 变高会增加随机性，并不等于质量提高。

## 厂商比较

### DeepSeek

- 官方 API 文档：[platform.deepseek.com/api-docs](https://api-docs.deepseek.com/)
- 官方定价：[platform.deepseek.com/api-docs/pricing](https://api-docs.deepseek.com/quick_start/pricing)
- 官方模型/能力说明：[api-docs.deepseek.com/quick_start/models](https://api-docs.deepseek.com/quick_start/models)
- DeepSeek API 遵循 OpenAI 风格的 Chat Completions 调用方式，适合直接接入现有 `adapter.ts`。具体可用模型 ID、上下文上限和缓存价格以官方页面为准。
- 适合：普通档的低成本批处理，以及深度档的性价比方案。
- 风险：国际 API 的账号、付款和地区可用性需要在实际部署网络中验证；不要把“官网能打开”当作 API 一定可用。

### 阿里云通义千问（Qwen）

- 官方模型文档：[help.aliyun.com/zh/model-studio/models](https://help.aliyun.com/zh/model-studio/models)
- 官方模型服务定价：[help.aliyun.com/zh/model-studio/billing](https://help.aliyun.com/zh/model-studio/billing)
- 官方 OpenAI 兼容调用：[help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope](https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope)
- Qwen 提供通用、推理和长上下文模型，百炼兼容 OpenAI SDK；模型 ID 和区域端点应从控制台复制。
- 适合：深度档主力，以及中文论文中较长段落的处理。若普通档追求极低成本，可选择控制台提供的小参数 Instruct 模型。
- 风险：部分模型或地域端点的价格、限流、上下文长度不同；必须在应用配置中记录实际 `provider/model`。

### 智谱 GLM

- 官方开放平台模型列表：[open.bigmodel.cn/dev/api#模型列表](https://open.bigmodel.cn/dev/api#模型列表)
- 官方价格页：[open.bigmodel.cn/pricing](https://open.bigmodel.cn/pricing)
- 官方 OpenAI 兼容说明：[open.bigmodel.cn/dev/api#openai-sdk](https://open.bigmodel.cn/dev/api#openai-sdk)
- GLM 系列提供中文通用模型和不同成本档位，接口可按 OpenAI Chat Completions 方式调用。
- 适合：深度档备用、中文表达质量对比实验，以及国内网络环境下的替代供应商。
- 风险：模型名称和价格更新较快；上线前应使用控制台的真实模型 ID 做一次完整的数字、引用和术语保留测试。

### 月之暗面 Kimi

- 官方 API 文档：[platform.moonshot.cn/docs](https://platform.moonshot.cn/docs)
- 官方模型与价格：[platform.moonshot.cn/docs/pricing](https://platform.moonshot.cn/docs/pricing)
- 官方 OpenAI 兼容调用：[platform.moonshot.cn/docs/guide/start-using-kimi-api](https://platform.moonshot.cn/docs/guide/start-using-kimi-api)
- Kimi 系列的长上下文能力适合跨段落或较长章节，但单段普通降重通常不需要付出长上下文模型的成本。
- 适合：至尊档处理较长上下文、需要保持术语和章节衔接的任务；也可作为高质量备用。
- 风险：长上下文不代表自动更会改写，仍需限制输出不得新增事实；长文本应按段落计费和限流。

### 火山引擎豆包

- 官方模型服务文档：[www.volcengine.com/docs/82379](https://www.volcengine.com/docs/82379)
- 官方模型/价格入口：[console.volcengine.com/ark](https://console.volcengine.com/ark)
- 官方 Ark OpenAI 兼容说明：[www.volcengine.com/docs/82379/1263482](https://www.volcengine.com/docs/82379/1263482)
- 火山方舟提供模型接入、限流和用量管理，实际模型 ID 以方舟控制台创建的 Endpoint 为准。
- 适合：中国大陆部署时作为低延迟供应商候选；可为三档分别创建低、中、高能力 Endpoint。
- 风险：Endpoint ID、区域和计费配置是账户级资源，不能只凭公开模型名写死。

### OpenAI

- 官方模型概览：[platform.openai.com/docs/models](https://platform.openai.com/docs/models)
- 官方价格：[openai.com/api/pricing](https://openai.com/api/pricing/)
- 官方 Chat Completions 文档：[platform.openai.com/docs/api-reference/chat](https://platform.openai.com/docs/api-reference/chat)
- 高能力模型通常在复杂改写、指令遵循和自检方面更强，适合至尊档基准模型。OpenAI API 的国家/地区支持、付款和网络出口必须在部署环境中单独确认。
- 适合：作为 premium 的质量基准或海外部署方案。
- 风险：用户此前遇到的 `403 Country, region, or territory not supported` 表明当前网络/账号条件不能假设 OpenAI 可用；在中国大陆本地部署不应把它作为唯一供应商。

## 落地配置建议

服务端仅接收 `standard | deep | premium`，由服务端配置路由模型：

```env
AI_PROVIDER=qwen
AI_STANDARD_MODEL=<控制台中可用的低成本模型ID>
AI_DEEP_MODEL=<控制台中可用的通用模型ID>
AI_PREMIUM_MODEL=<控制台中可用的高能力模型ID>
AI_API_BASE_URL=<服务商的OpenAI兼容端点>
AI_API_KEY=<仅存服务器环境变量>
```

如果三档使用不同供应商，改为 `AI_STANDARD_PROVIDER` 等三组配置，并为每次任务记录 `provider`、`model`、输入/输出 token、耗时、重试和是否降级。API Key 绝不能由前端传入。

## 上线前基准测试

准备 30-50 个匿名中文论文段落，覆盖定义、数据分析、引用密集和长句。每个候选模型测试：

1. 数字、单位、引用编号和锁定术语是否逐字保留。
2. 是否新增原文没有的事实或参考文献。
3. 改写后语义一致性和中文学术风格（人工盲评）。
4. p50/p95 延迟、失败率、重试率和每千字成本。
5. 真实部署网络下的 429、5xx、地区限制和超时行为。

只有通过这组测试后，才将模型绑定到对应等级。建议先采用 Qwen/DeepSeek/GLM 之一作为国内主链路，保留另一家作为故障备用；OpenAI 或 Kimi 用作 premium 的对照和可选路由，而不是唯一依赖。

