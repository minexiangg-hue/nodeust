# 本地模型对照建议

核验日期：2026-09-11。仅使用模型发布者与 ggml-org 官方资料；本次没有下载权重、调用模型或修改运行配置。现有 Qwen3-4B-Instruct-2507 Q8 约 5.5 output tokens/s 是本项目此前实测，本次没有独立复测。

**建议先完成现有模型的提示修正对照，再优先试 Qwen3.5-4B；Qwen3.5-9B 是容量允许时的质量对照，Gemma 4 E4B 是不同模型系列的备选。** 以下顺序是工程判断，尚无 NODE 匹配效果证明。

## 当前模型是否配置遗漏

- **无需额外关闭 thinking。** 发布者明确说明 Qwen3-4B-Instruct-2507 只支持 non-thinking，不再要求 `enable_thinking=False`；其官方 tokenizer 的生成前缀直接结束于 assistant 起始标记，没有 thinking 分支。不要套用普通 Qwen3 或 Qwen3.5 的切换要求。[官方模型卡](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)、[官方 tokenizer 配置](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507/blob/main/tokenizer_config.json)
- **默认 GGUF 模板是正确的使用方向。** 固定 commit `5266f24da` 的 server 文档写明 Jinja 默认启用、模板默认来自模型 metadata。`reasoning-format=none` 只改变输出解析，不等于关闭模型思考。本次没有逐字比对本机 GGUF 模板与发布者 tokenizer，故不能宣称已经证明模板完全一致；但没有找到必须额外添加模板参数的官方要求。[本机版本对应的 server 文档](https://github.com/ggml-org/llama.cpp/blob/5266f24da/tools/server/README.md)
- **明确存在的提示问题是 schema 不可见。** 同一 commit 文档说明 JSON schema 仅转换为输出 grammar，不会自动放入模型提示。因此必须显式描述字段、类型和语义；只写 “supplied schema” 不够。grammar 也不保证证据真实或判断正确，且不支持所有 JSON Schema 关键字，仍需应用层校验。[固定版本 grammar 文档](https://github.com/ggml-org/llama.cpp/blob/5266f24da/grammars/README.md#json-schemas--gbnf)
- **采样设置有差异，但还不能归因。** 官方建议 `temperature=0.7, top_p=0.8, top_k=20, min_p=0`，当前实验使用 greedy。可固定提示与数据，分别测试两种设置并重复采样报告波动；不应因单次换宿误判直接认定 greedy 或模型规模是原因。官方长输出建议针对通用任务，不能直接变成本项目的必要 token 预算。[官方最佳实践](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507#best-practices)

## 最多三个新候选

| 候选 | 发布者已公开的信息 | 对本机的判断与尚未验证之处 |
| --- | --- | --- |
| **Qwen3.5-4B** | 2026 系列、4B 语言模型、Gated DeltaNet 与 attention 的混合结构；系列宣称覆盖 201 种语言/方言，公布 IFEval 89.8、MMLU-ProX 71.5。默认 thinking，可以模板参数关闭。[官方卡](https://huggingface.co/Qwen/Qwen3.5-4B) | 同量级升级优先候选。上述官方分数不是本项目短输出、非 thinking、量化 CPU 条件下的结果，不能直接与当前模型横比。4-bit 裸权重理论量级约 2 GB，实际 GGUF、缓存和工作区会更大。本次未核实到 Qwen/ggml-org 的 4B GGUF，需要后续核验转换产物与哈希。 |
| **Qwen3.5-9B** | 9B 语言模型；同表 IFEval 91.5、MMLU-ProX 76.3 高于该系列 4B；官方提供 non-thinking 设置。[官方卡](https://huggingface.co/Qwen/Qwen3.5-9B) | 用于验证额外容量是否改善约束理解。4-bit 裸权重理论量级约 4.5 GB，完整内存仍需测量；Q8 加工作区会明显压缩本机余量。4 CPU 下速度未知，不能由参数量或官方吞吐宣传推定。对应发布者/ggml-org GGUF 本次同样未核实。 |
| **Gemma 4 E4B-it** | 有原生 system role、可配置 thinking；宣称开箱支持 35+ 语言、预训练覆盖 140+。E4B 是 **4.5B effective、含 embeddings 约 8B**，不能当作普通 4B 内存规模。[Google 官方卡](https://huggingface.co/google/gemma-4-E4B-it) | 有 ggml-org 官方 GGUF，主模型 Q4_0 **4.59 GB**、Q8_0 **8.03 GB**；这些是文件体积而非 RAM 峰值。Q4 更适合保留应用余量。作为不同系列对照有价值，中文口语、粤语及本项目硬约束效果均未测。[官方 GGUF 文件列表](https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/tree/main) |

本机 commit 已登记 `qwen35` 和 `gemma4` 架构；Gemma 4 E4B 也在该版本官方预量化支持列表。它们因此是可进一步验证的本地候选，但代码中有架构支持不等于此机器已经成功加载或通过 JSON/语义回归。[固定版本架构源码](https://github.com/ggml-org/llama.cpp/blob/5266f24da/src/llama-arch.cpp)、[固定版本多模态文档](https://github.com/ggml-org/llama.cpp/blob/5266f24da/docs/multimodal.md)

## 下一轮最小对照

1. 保持同一份公开输入、schema、证据校验与预先固定的判定标准，先测修正提示后的当前模型；分别记录 JSON 合法率、原文证据通过率、三分类错误和实际延迟。合法 JSON 与引用存在都不代表兼容性正确。
2. 新模型先采用纯文本、单实例、短上下文与有限输出。4K/8K context 是针对本任务和内存约束的实验选择，不是复现发布者长推理 benchmark 的条件。通过 `-hf` 使用多模态 GGUF 时，可按官方文档用 `--no-mmproj` 禁用多模态；4B/9B Qwen 权重量级仅为计算估算，不能代替 RSS、KV/workspace 及系统余量实测。[llama.cpp 参数](https://github.com/ggml-org/llama.cpp/blob/5266f24da/tools/server/README.md)、[纯文本加载方式](https://github.com/ggml-org/llama.cpp/blob/5266f24da/docs/multimodal.md)
3. 对 Qwen3.5 显式设置 `chat_template_kwargs: {"enable_thinking": false}`；它默认 thinking，且官方不支持依赖 `/nothink` 软开关。Gemma 4 按其自身模板关闭 thinking。两者都不能直接沿用当前 Instruct-2507 的模板假设。[Qwen3.5 官方说明](https://huggingface.co/Qwen/Qwen3.5-4B#instruct-or-non-thinking-mode)、[Gemma 官方配置](https://huggingface.co/google/gemma-4-E4B-it#best-practices)

三者均有公开权重，可走本机运行路径而无需付费推理 API；模型许可仍以相应发布者仓库为准。现有速度意味着仅生成 300 token 就约需 55 秒，尚未计入 prompt 处理；这是由项目测量推算，支持优先考虑后台提取和缓存，不能把模型换代当作同步匹配请求延迟的保证。

抓取的官方资料节选保存在本机被忽略的 `.firecrawl/nodeust-local-model-options/`，包含模型卡、文件列表及固定 commit 文档。本报告未使用社区讨论、第三方量化宣传或不同条件的排行榜推导本机效果。

## 补充：可选字段顺序会限制输出

**确认标准 GBNF 转换存在该限制：选中靠后的 optional 字段后，不能再输出其前面的字段。** 这不是 JSON 本身的规则，而是此版本生成 grammar 时缩小了合法输出排列。

- `common_json` 保留对象键的插入顺序；转换器按 `properties` 收集字段，再分成 required 与 optional，先输出 required。**仅重排 required 数组没有用，顺序来源仍是 properties。** [固定版本 JSON 类型说明](https://github.com/ggml-org/llama.cpp/blob/5266f24da/common/json.h#L18)、[收集与分组代码](https://github.com/ggml-org/llama.cpp/blob/5266f24da/common/json-schema-to-grammar.cpp#L711)
- optional 的每个分支只递归剩余的后缀 `optional_props[i..end]`，不会回到更小的索引。官方测试同时覆盖三个可选字段、以及 required/optional 各按原始顺序输出。[递归实现](https://github.com/ggml-org/llama.cpp/blob/5266f24da/common/json-schema-to-grammar.cpp#L769)、[官方顺序测试](https://github.com/ggml-org/llama.cpp/blob/5266f24da/tests/test-json-schema-to-grammar.cpp#L876)

因此，**若当前请求采用 price → model → transaction → otherRequirements 的可选字段顺序**，模型先选择 transaction，就已经丢失继续输出 price/model 的合法路径；随后选择 otherRequirements 也符合该机制。提示却先介绍 transaction 会增加顺序不协调的可能。这能解释所观察到的缺字段模式，但尚未证明它是全部语义误判的主因；需要冻结输入后做下列对照。

| 应对 | 能解决的部分 | 限制 |
| --- | --- | --- |
| 同时重排 properties 与提示中的字段顺序 | 降低模型自然表达顺序与 grammar 的冲突 | optional 仍可提前跳过重要字段，不能保证提取完整。 |
| 关键字段 required + nullable，并采用精简的分类结构 | 必须生成字段，可用 null 表示未知；不会因跳到后面就把该键永久省略 | 顺序仍固定；可能误填 null 或猜测，必须保留证据/类型校验。更多必填空字段会增加 token 与延迟，不能把“不相关/未知”强制写成事实。 |
| 只使用 `response_format: {"type":"json_object"}`，不附业务 schema，之后运行严格 validator | 最直接隔离固定字段顺序对提取的影响；模型可自行安排键顺序 | grammar 只保证 JSON，不能保证键、枚举、字段完整或证据真实；不合格输出必须计作失败，不能静默补全。该模式由同版本 server 文档明确支持。[API 文档](https://github.com/ggml-org/llama.cpp/blob/5266f24da/tools/server/README.md#post-v1chatcompletions-openai-compatible-chat-completions) |

实施范围说明：上述结论来自固定 commit 的 **标准 GBNF** 路径；同文件的 `json_schema_to_grammar` 在编译启用 `LLAMA_USE_LLGUIDANCE` 且未强制 GBNF 时，另有委托路径。本次没有验证正在运行的二进制是否启用该可选后端，不能把本结论泛化到它；已有输出形态与标准路径一致只是旁证。[转换入口及条件分支](https://github.com/ggml-org/llama.cpp/blob/5266f24da/common/json-schema-to-grammar.cpp)

建议先做相同模型/输入的“原 schema、关键字段 required+nullable、纯 JSON + strict validator”小对照，保持语义验收标准不变，再决定是否换模型。此补充没有修改任何客户端、schema 或生产代码，也没有执行模型调用。
