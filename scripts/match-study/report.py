from pathlib import Path
import json, html, csv
root=Path(__file__).resolve().parents[2]
report=root/'reports/match-study-2026-09-11';out=report/'artifacts'
s=json.loads((out/'summary.json').read_text());d=json.loads((out/'diagnostics.json').read_text());b=json.loads((out/'browser-summary.json').read_text())
posts=[json.loads(line) for line in (out/'posts.jsonl').read_text().splitlines()];roles=[json.loads(line) for line in (out/'roles.jsonl').read_text().splitlines()]
pct=lambda n,total: f'{100*n/total:.2f}%' if total else '—'
names={'current-feed':'当前线上机制（最新 100 条）','full-exact':'对照 A：全量帖子，仍精确比字符串','full-normalized':'对照 B：全量＋有效宿舍名归一化'}
metricrows=[]
for key,m in s['metrics'].items():
 metricrows.append(f"| {names[key]} | {m['returned']:,} | {m['tp']:,} | {pct(m['tp'],m['returned'])} | {pct(m['tp'],m['gold'])} | {m['empty']}/500 | {m['hitRoles']}/500 |")
route_rows=[]
for key,m in s['metrics'].items():
 route_rows.append(f"| {names[key]} | {m['routeTp']:,} | {pct(m['routeTp'],m['returned'])} | {pct(m['routeTp'],m['routeGold'])} |")
labels={'hall':'换宿','goods':'物品','study':'学习','transport':'交通','other':'其他社交活动'}
corpus_rows='\n'.join(f"| {labels[k]} | {s['intentTypes'][k]} | {s['submittedCategories'][k]} | {s['metrics']['current-feed']['byKind'][k]['gold']:,} |" for k in labels)
style_rows='\n'.join(f"| {k} | {v} |" for k,v in s['styles'].items())
case_labels={'current-false-positive':'当前机制的占位字段误配','missed-hall':'漏掉有效换宿需求','missed-goods':'漏掉物品供求','missed-study':'漏掉学习互助','missed-transport':'漏掉交通需求','missed-other':'漏掉活动同伴','housing-alias':'同一宿舍的不同写法','housing-constraints':'反向路线相同，但其他条件不合'}
case_reasons={'current-false-positive':'两帖均误选宿舍并填写互为反向的占位字段，实际需求不兼容。','missed-hall':'双方真实换宿需求兼容，但没有同时通过最新 100 条和字段精确相等的限制。','missed-goods':'当前规则没有物品供求匹配机制。','missed-study':'当前规则没有学习互助匹配机制。','missed-transport':'当前规则没有交通匹配机制。','missed-other':'当前规则没有活动同伴匹配机制。','housing-alias':'规范宿舍 ID 互为反向，但存储的字符串写法不同。','housing-constraints':'反向路线相同，但本人没有任何需求同时满足候选的学期、房型和明确 eligibility 条件。'}
case_lines=[]
for i,c in enumerate(d['cases'],1):
 a=c['own'];p=c['candidate']
 case_lines.append(f"""### 案例 {i}：{case_labels[c['label']]}

角色 `{c['studentId']}`；本人帖子 `{a['localId']}`；候选 `{p['localId']}`。

- 本人（选 `{a['category']}`）：{a['body']}
- 候选（选 `{p['category']}`）：{p['body']}
- 存储的宿舍字段：`{a['currentHall']} → {a['targetHall']}` 对 `{p['currentHall']} → {p['targetHall']}`。
- 判定依据：{case_reasons[c['label']]}
""")
minempty=min(x['empty'] for x in d['sensitivity']);maxempty=max(x['empty'] for x in d['sensitivity']);maxtp=max(x['truePositive'] for x in d['sensitivity']);maxrec=max(x['recall'] for x in d['sensitivity'])
text=f'''# NODE Match 机制评估与交通类别上线报告

2026-09-11（香港时间）；代码基线 `6011339`，交通版本构建 `K-J2oPFCmJQOkDipbss3_`。

**交通类别已上线；当前 Match 还不能承担通用校园需求匹配。** 本轮 500 个学生中，498 个看到空列表，另 2 个各看到 1 条不相关推荐。关键问题首先是候选与本人帖子都被截断到最新 100 条，其次是仅支持宿舍字符串反向相等；增加交通分类本身并没有增加交通匹配算法。

[逐角色交互查看](review.html) · [完整日志压缩包](logs.zip) · [机器可读统计](summary.json)

## 1. 已完成的产品更新

- 新增 `transport`，英文 Transport、简繁体均为“交通”，配套交通图标。发布、编辑、草稿、列表/地图筛选、类别恢复、帖子详情和个人帖子均接通。
- 320、390、844、1440px × 英文、简体、繁体，共 12 组真实界面检查；6 个类别筛选按钮能正常换行，无重叠或水平溢出。交通帖不要求填写宿舍字段。
- 真实隔离 API 验证交通帖创建、读取、筛选、编辑和作者权限。10 项单元检查、22 项管理接口检查、生产构建与针对性静态检查通过。
- 枚举迁移 `0003_add_transport_category.sql` 只在已有枚举末尾追加交通。上线后公开主页、新版脚本和服务健康均通过，维修模式保持关闭。
- Match 原算法仅抽取成 `lib/matching.ts`，供页面和评估共同调用；**没有更换线上匹配行为，也未部署下面的改进算法。**

## 2. 怎样模拟，哪些结果可以相信

先只读查看正式库当时的 16 条帖子（15 条 active、1 条 removed）。样本包含中英混写、繁体/口语、闲聊、非常短的正文、错分类，以及无意义的宿舍字段。因此本次没有假定人人认真填写规范需求。样本很小，不能据此估计真实人群分布；正式帖子原文和身份信息未放入报告或可下载日志。

随后在权限限制到独立 schema 的 MySQL 账号下，通过实际 `POST /api/posts` 发布 **500 人、3,746 条帖子，每人 5–10 条**，固定语义生成种子 `{s['seed']}`。所有角色按普通 member 权限评估。没有把测试帖子、学生或聊天写入生产库。

| 生成时的实际意图 | 帖子数 | 用户实际选择该类别的数量 | 可兼容“角色→候选帖”数 |
| --- | ---: | ---: | ---: |
{corpus_rows}

“实际意图”是合成场景的预设标注，**不会传给匹配算法**。帖子原文、实际选择的类别和合法的公开字段才是算法输入。

- 错分类 {s['misclassified']} 条（{pct(s['misclassified'],s['posts'])}）。误选宿舍的帖子可能填 `x`、`-` 等占位，模拟现有数据中观察到的做法。
- 信息不足/非需求内容 {s['insufficient']} 条（{pct(s['insufficient'],s['posts'])}），例如只有打招呼或感叹；这些帖子标为应暂不推荐，不能凭空猜意图。
- 发帖顺序打散，使学生交错出现。500 人都读取真实个人身份下的帖子接口，再执行和 UI 同一份匹配函数。
- 实际接口阶段共 {s['api']['requests']:,} 次请求，失败 {s['api']['failures']} 次。记录了每次身份、操作、状态码、耗时和帖子 ID。耗时仅用于排查测试过程，不代表正式站的并发容量或用户体验。
- **500 个角色又全部打开真实浏览器匹配页：250 个手机视角、250 个桌面视角。** 逐个核对列表条数和正文，均与日志一致；无 API mock、无页面运行错误或水平溢出。
- 每个角色的本人帖子、实际 100 条候选、返回列表、正确命中、误配和漏配完整保存在 `roles.jsonl`；`browser-log.jsonl` 保存逐角色浏览器核对结果。

| 帖子的表达风格 | 数量 |
| --- | ---: |
{style_rows}

### 评分口径

单位是 **一个学生看到的一条候选帖子**。只要其本人任意一条真实需求与候选兼容，就计一次潜在有用推荐；排除自己的帖子，同一候选不重复计数。总共有 **23,753** 个这样的角色→候选关系，不是 23,753 个独立学生或真实成交。

预设的兼容条件如下：

- 换宿：反向宿舍路线，且学期、当前/目标房型、明确的 eligibility 条件相容。
- 物品：同一物品的供求互补，卖方价格不超过买方预算；两个买家不因文字相似就算匹配。
- 学习：同一课程、交流语言相容、时间相容，能帮忙的人对需要讲解的人，或一起复习的同伴。
- 交通：同方向、同日期、出发时间相差不超过 30 分钟；司机空位够乘客人数，或合计不超过 4 人的拼出租组合。**30 分钟、4 人是本模拟的场景设定，不是线上既有业务规则。**
- 其他：同一活动和地点、同日期/相容时间的同伴；闲聊和不明确需求不建立推荐关系。

这些是“有理由联系”的标注，不保证最后成交、学校批准、陌生人信任或现实可行性。评分并没有验证这些现实结果。

**Precision（查准率）**＝有用推荐 / 所有返回；**Recall（召回率）**＝找出的有用推荐 / 语料中全部可兼容关系。另记录有至少 1 条有用推荐的角色数。当前规则没有相关性排序，沿用时间顺序。

## 3. 当前机制实际做了什么

1. 前端调用 `/api/posts`，服务器仅返回最新 100 条 active 帖子。
2. 从这 100 条中找出 `isMine && category === 'hall'` 作为本人需求。
3. 仅返回他人的 `hall` 帖，要求 `mine.from === other.to && mine.to === other.from`。
4. 不读取标题/正文、不理解语言或意图、不核对时间/房型、不支持交通等其他需求，也没有相关性分数。

这意味着不仅老候选看不到，**自己的帖子也可能不在匹配输入里**。本轮有 **406/500 人（81.2%）**的任何帖子都不在最新 100 条中；有 **479/500 人（95.8%）**没有自己的宿舍帖进入这个窗口。

## 4. 结果与对照实验

以下按上面的“双方潜在可兼容”标准评分。对照 A/B 都只是对同一已存语料的离线实验，未部署：

| 方案 | 返回关系 | 有用关系 | 查准率 | 召回率 | 空列表角色 | 至少命中 1 条的角色 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(metricrows)}

当前线上机制只返回 2 条关系，二者均为误选宿舍类别、占位字段相同造成的误配。**本轮查准率/召回率为 0，不代表所有真实用户、所有时间都恒为 0。**

对照 A 取消窗口后发现更多帖子，但也大幅扩大了 `x ↔ x` 等伪匹配。不能直接把 `.limit(100)` 删除就称为算法升级，更不应把全站内容长期拉到每台手机上。

对照 B 还把 `Hall I`、`Hall 1`、`hall1`、`一舍`、大小写和特殊空格统一，并丢弃不认识或同起终点的宿舍字段；仍只按反向路线筛选，**尚不读取正文条件**。这里的归一化仅覆盖本合成集的 6 个本科宿舍，不是完整校区解析器。

为公平区分“现有功能的反向路线”与“用户真正兼容”，再用较宽松的标准：只要求两条确实是换宿需求，规范宿舍 ID 反向，不要求其余条件。

| 方案 | 真正换宿反向路线关系 | 路线查准率 | 路线召回率 |
| --- | ---: | ---: | ---: |
{chr(10).join(route_rows)}

可见归一化对于**路线识别**有明显帮助，但路线正确不等于学期/房型等条件正确。这不是说旧 UI 承诺了所有条件，而是说明它目前仅能做粗筛，不能当成熟的双向需求匹配器。

全类别查准率中，即使错类别/占位字段“碰巧”推中了另一条本人的真实需求，也会按有用推荐计数；这种偶然命中**不代表算法理解了物品或交通**。各类细分统计保存在 `summary.json`。全局召回被物品类较多的兼容关系影响，因此报告同时给出换宿路线口径，不用一个总分概括所有类别。

### 发帖顺序敏感性

用同一语料再随机打乱顺序 30 次，离线重算每个学生最新 100 条视角：每次 **{minempty}–{maxempty}/500** 人列表为空，正确返回关系 **0–{maxtp}** 条，最好一次全类别召回也只有 **{maxrec*100:.4f}%**。这表明问题不只是主实验碰巧截到了不好的 100 条。它是同一合成语料上的敏感性检查，**不是独立人群实验或统计置信区间**。

## 5. 可追溯案例

以下均是合成学生，不是真实帖子。完整字段和标注可在交互页与日志中查看。

{chr(10).join(case_lines)}

## 6. 建议的算法与实施顺序

### 第一阶段：先修候选获取与宿舍规则

为 Match 增加独立服务器接口：分别读取本人的全部有效需求，再利用索引检索相关候选、分页返回。避免广场最新 100 条窗口决定匹配成败。仍需排除本人、关闭/过期/移除的帖子和不可交互账号。

宿舍用规范 ID 和受控别名；保留本科/研究生等命名空间，不能把 `PG Hall I` 错归为本科 Hall I。`x`、空值、相同起终点等不进入确定匹配。遇到自由文本或多目标宿舍，提取后让用户确认，而不是把原文强改成某个宿舍。

在双方明确提供时，再检查学期、可换房型等约束；缺失字段不能自动当成“满足”，应显示“待确认条件”。这一步可先采用可解释的规则和数据库查询，不必一上来就接大模型。

### 第二阶段：多类别的“语义召回＋互补性筛选”

用户选的类别只作弱提示，不能作唯一筛选条件。先从正文建立可多值的意图：**我提供什么、需要什么、地点、时间、约束、是否仍有效、证据与置信度**。一帖多事可以形成多条内部需求，但保留原帖和用户所选类别。

候选同时来自词语/实体索引和多语言语义相似度，再检查供需与双方约束。多语言句向量可让不同语言表达进入可比较的向量空间；方法依据见 [Sentence-BERT](https://aclanthology.org/D19-1410/) 和 [多语言句向量研究](https://aclanthology.org/2020.emnlp-main.365/)。**这并不保证粤语缩写、错别字、否定句在本产品里好用，需要独立评估。**

| 类别 | 合适的匹配依据 | 必须排除或待确认的情况 |
| --- | --- | --- |
| 交通 | 起终点、实际出行日期、时间范围、拼车/司机/乘客角色、人数与空位 | 同地不同日、反向路线、座位不足；发布地点标签不能直接当出发地 |
| 物品 | 物品/型号、出售/求购、价格区间、交收条件 | 两个求购者；不同版本或无法满足的价格 |
| 学习 | 课程、可帮助/求助/同伴、主题、语言、时间 | 两人都要求对方讲解；时间或交流方式冲突 |
| 换宿 | 规范宿舍 ID、多目标、学期、房型及明确限制 | 随意字段；相反路线但现实条件不合 |
| 社交/其他 | 活动、地点、时间和双方是否确实找同伴 | 单纯感叹、歌词、无法确定的内容；不能硬塞成需求 |

“我要买计算器”和“我要买计算器”非常相似，但不互补；“出计算器”与“想收一个 calculator”才可能有用。因此不建议仅凭关键词重合、向量距离或同类别推荐。

### 第三阶段：双向排序、解释与主动补充信息

对通过硬约束的候选，分别估计 A 对 B 的需求满足程度、B 对 A 的需求满足程度，再用较保守的组合（例如两者较小值，或经校准的几何平均）排序。将新鲜度、已知时间与地点兼容、解析置信度加入排序，不要把单向文本相似当成成功率。双向推荐需要双方兴趣的研究背景见 [Fair Reciprocal Recommendation in Matching Markets](https://arxiv.org/abs/2409.00720/)；这里的具体排序方案是针对本项目的建议，未在本轮实现或验证。

每条推荐给简短理由与待确认项，例如“同一天科大去机场，出发相差 20 分钟；还需确认行李”。信息不足时给一个相关问题，如“你打算哪一天出发？”，而不是把“明天”“随便”当成精确条件。跨日应按发帖时间和香港时区解释；过期交通帖需要独立失效规则。

大模型可以作为可选的结构化提取/候选复核层，返回原文证据、多个意图及不确定项；不让它编造缺失时间、座位或宿舍，也不对所有帖子两两调用。先用便宜的检索缩小候选，再复核。**本次没有调用外部模型处理真实或合成帖子，也没有测得这些建议的准确率或成本。**

### 如何验证下一版

1. 先在影子模式记录新旧候选，开关控制上线和回退；新推断数据独立存储，不覆盖原帖、原类别或既有匹配结果。
2. 使用独立编写、盲标的真实风格样本评估；标注者不能看到算法输出。包括否定/反悔、一帖多需求、模糊日期、粤语/中英混写、别名、错分类和非常相似但不兼容的难负例。
3. 按类别分别看 P@5、召回、至少一条有用推荐的用户比例、误配原因和应该弃权却硬配的比例。验证 100 条以外候选、自己的旧帖和重新打开页面仍能匹配。
4. 预先约定上线门槛，例如每类高置信候选 P@5 达到 90% 后才逐步放量；**90% 是拟议的验收目标，不是现有结果**。语义不明确的帖子另算覆盖率，不能靠全部返回空列表获得高精度。
5. 真正上线后，再用“有用/不相关”、双方回复及后续确认评估推荐价值；单纯打开聊天窗口不算匹配成功。

## 7. 本轮的局限

- 这是可复现的**模板组合式合成数据**，不是 500 个真人自由创作，也没有用真人独立双盲标注。固定主题、意图分布和兼容规则会影响数值，不应将查准率外推为正式环境指标。有限主题使物品需求较密集，本合成集中每位学生都有可兼容对象，不代表真实平台也如此。
- 涵盖正式/随意英文、拼写简化、简繁体、混语、错分类和无信息内容；没有穷尽所有语言、复杂一帖多意图、否定/讽刺、相对时间、全部地点别名。原机制不读正文，所以这一不足不改变其当前能力边界；未来语义算法必须用更独立、更难的数据测试。
- 兼容规则与语料设计来自同一测试方案，存在偏差。本轮对照只有扩大候选范围与宿舍别名归一化；未拿 oracle 的意图标注当成新算法输入，也未把理想标注的结果冒充模型成绩。
- 主场景是所有帖子 active 的最终快照，未模拟真实学期内的流量、撤帖、过期、消息互动或持续在线。30 次顺序对照仅检查窗口影响。生产迁移及交通类别权限另有功能回归检查。
- 语义生成种子固定；真实 API 的 UUID、创建时间和并发落库顺序不固定。**归档语料与时间/ID 可以精确离线重放本轮；重新发帖运行不保证最新 100 条完全相同。** 已逐角色验证归档重放与主实验一致。
- 其他类别目前根本未实现匹配。表中的全类别结果用于评估“通用校园需求匹配”目标，不意味着旧版曾承诺这些功能。

## 8. 文件、备份与恢复

- `review.html`：离线交互查看全部 500 个角色、本人帖子、当前/对照推荐与漏配；没有网络请求。
- `logs.zip`：500 名学生、3,746 条完整合成帖、5,246 次主实验 API 日志、500 份角色日志、500 份浏览器日志、敏感性检查、案例与截图。
- `summary.json`：主实验机器可读统计；`roles-summary.csv`：每个角色的简表，可用表格软件查看。
- `scripts/match-study/`：生成、执行、浏览器验证、重放分析与报告脚本；运行说明见该目录 README。
- 语料 SHA-256：`{s['corpusSha256']}`。
- 上线备份：`/home/ubuntu/nodeust-backups/20260910T174951Z-transport`。迁移前数据库备份已在另一个临时库恢复并核对 16 条原始帖子。
- 原应用回滚入口为该目录 `rollback.py`。**已有交通帖子时，它会拒绝回退到不识别交通的旧 UI**；这时需要带交通兼容的恢复构建。不要缩窄枚举，也不要用旧 SQL 快照覆盖上线后的用户数据。迁移为追加型，普通应用回退不撤销它。

独立测试库、数据库账号和临时预览服务在日志归档后清理，完整结果保留在本地报告目录；生产服务保持开放。
'''
(report/'report.md').write_text(text)
(report/'summary.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
with (report/'roles-summary.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['student','style','own_posts','own_in_feed','own_housing_in_feed','relevant_candidates','current_returned','current_correct','current_false','full_exact_correct','normalized_correct'])
 for r in roles:
  a=r['algorithms'];w.writerow([r['studentId'],r['style'],len(r['ownPosts']),r['ownPostsInFeed'],r['ownHousingInFeed'],len(r['gold']),len(a['current-feed']['returned']),len(a['current-feed']['truePositive']),len(a['current-feed']['falsePositive']),len(a['full-exact']['truePositive']),len(a['full-normalized']['truePositive'])])
compact_roles=[{k:r[k] for k in ['studentId','style','ownPosts','ownPostsInFeed','ownHousingInFeed','algorithms','gold']} for r in roles]
viewer='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NODE · 500 学生匹配评估</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#121429;color:#f4f6ff;font:16px/1.6 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:32px 20px}h1{font-size:clamp(26px,4vw,42px);line-height:1.2}p{color:#c6cde1}a{color:#c8b8ff}.tiles{display:flex;gap:12px;flex-wrap:wrap}.tile{background:#20253f;padding:16px 22px;border-radius:12px;min-width:140px}.tile b{display:block;font-size:28px}label{display:block;font-weight:600}input,select{font:inherit;color:inherit;background:#20253f;border:1px solid #71799a;border-radius:8px;padding:10px;width:100%;min-width:0}.controls{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:30px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}.post{border:1px solid #454e70;border-radius:12px;background:#1b2039;padding:16px;overflow-wrap:anywhere}.post h3{margin:8px 0}.meta{font-size:13px;color:#c5b6ff}.body{white-space:pre-wrap}summary{cursor:pointer;padding:12px 0;font-weight:600}details{margin:16px 0}.small{font-size:13px}pre{white-space:pre-wrap;overflow-wrap:anywhere}#stats{border-left:3px solid #b6ff75;padding:8px 16px}.bad{color:#ffb0bf}.good{color:#b6ff75}@media(max-width:640px){.controls{grid-template-columns:1fr}main{padding:20px 14px}}
</style><main><p>NODE / MATCH STUDY / 2026-09-11</p><h1>500 个学生，各自看到了什么？</h1><p>这是离线合成数据报告。没有真实用户信息，也不会访问生产服务。当前算法只认宿舍字段的精确反向关系；对照方案未上线。</p><div class="tiles"><div class="tile"><b>500</b>学生</div><div class="tile"><b>3,746</b>帖子</div><div class="tile"><b>498</b>当前空列表</div><div class="tile"><b>500 / 500</b>真实浏览器核对通过</div></div><p><a href="report.md">完整报告</a> · <a href="logs.zip">完整日志</a> · <a href="roles-summary.csv">角色 CSV</a></p><div class="controls"><label>查找学生<input id="search" placeholder="例如 student-042 或 mixed"></label><label>学生<select id="student"></select></label><label>对照方案<select id="algorithm"><option value="current-feed">当前线上：最新 100 条</option><option value="full-exact">全量＋字符串精确比较</option><option value="full-normalized">全量＋宿舍名归一化</option></select></label></div><div id="stats"></div><details open><summary>本人发布的帖子</summary><div class="cards" id="own"></div></details><details open><summary id="returned-title">返回的候选</summary><div class="cards" id="returned"></div></details><details><summary id="missed-title">漏掉的潜在联系人</summary><p class="small">依据合成场景标注，并非真人判断或成交保证。这里只展示潜在可兼容的帖子，不把打招呼、闲聊等强行视为需求。</p><div class="cards" id="missed"></div></details></main><script>
const DATA=__DATA__;const byId=new Map(DATA.posts.map(p=>[p.id,p]));const el=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function card(id,status=''){const p=byId.get(id);return '<article class="post"><div class="meta">'+esc(p.localId)+' · '+esc(p.style)+' · 所选类别 '+esc(p.payload.category)+'</div><h3>'+esc(p.payload.title)+'</h3><div class="body">'+esc(p.payload.body)+'</div>'+(p.payload.currentHall?'<p class="small">宿舍字段：'+esc(p.payload.currentHall)+' → '+esc(p.payload.targetHall)+'</p>':'')+(status?'<p class="'+(status==='标注兼容'?'good':'bad')+'">'+status+'</p>':'')+'<details><summary class="small">生成时的场景标注（不传给算法）</summary><pre>'+esc(JSON.stringify(p.truth,null,2))+'</pre></details></article>';}
function render(){const r=DATA.roles.find(r=>r.studentId===el('student').value);if(!r){el('stats').textContent='没有该学生';el('own').innerHTML=el('returned').innerHTML=el('missed').innerHTML='';return;}const a=r.algorithms[el('algorithm').value];el('stats').textContent=r.studentId+' · '+r.style+'｜本人帖子 '+r.ownPosts.length+'；其中进入最新 100 条 '+r.ownPostsInFeed+'，宿舍帖 '+r.ownHousingInFeed+'｜候选 '+a.returned.length+'，兼容 '+a.truePositive.length+'，误配 '+a.falsePositive.length+'，漏配 '+a.falseNegative.length;el('own').innerHTML=r.ownPosts.map(id=>card(id)).join('');el('returned-title').textContent='返回的候选（'+a.returned.length+'）';el('returned').innerHTML=a.returned.length?a.returned.map(id=>card(id,a.truePositive.includes(id)?'标注兼容':'标注不兼容')).join(''):'<p>此角色的匹配列表为空。</p>';el('missed-title').textContent='漏掉的潜在联系人（'+a.falseNegative.length+'）';el('missed').innerHTML=a.falseNegative.map(id=>card(id)).join('');}
function filter(){const query=el('search').value.toLowerCase();el('student').innerHTML=DATA.roles.filter(r=>(r.studentId+' '+r.style).toLowerCase().includes(query)).map(r=>'<option value="'+r.studentId+'">'+r.studentId+' · '+r.style+'</option>').join('');render();}el('search').addEventListener('input',filter);el('student').addEventListener('change',render);el('algorithm').addEventListener('change',render);filter();
</script></html>'''
payload=json.dumps({'posts':posts,'roles':compact_roles},ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
(report/'review.html').write_text(viewer.replace('__DATA__',payload))
print('Report, interactive role viewer, summary and CSV generated.')
