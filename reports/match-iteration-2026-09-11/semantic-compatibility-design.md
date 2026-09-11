# 语义提取之后仍然需要解决的兼容规则

审查日期：2026-09-11。审查基线：`3c5539fe569d0d9de4fed2050a5d6f17e4538d27`，另以本轮实际读取的工作树为准。本轮只新增本文，没有修改 TypeScript、验证场景或标签，没有调用语言模型。

本文假设模型已经正确理解原文，检查这些理解能否穿过 `semantic-schema.ts → MatchIntent → 检索 → compareIntents`。结论是：目前不能。借用归还、互换不同物品、活动邀请与加入等没有完整表达；一部分明确条件被安全地降为待确认，另一些条件在比较时被默认值或粗略字符串比较覆盖。单独提升模型理解能力不能修复这些问题。

检查来源：

- [语义 schema 与适配器](../../lib/match/semantic-schema.ts)、[当前意图类型](../../lib/match/types.ts)、[比较及召回规则](../../lib/match/engine.ts)。
- 已公开、现作为开发资料使用的 [validation-v2.json](../../scripts/match-evaluation/validation-v2.json) 及其 [说明](../../scripts/match-evaluation/validation-v2-notes.md)。读取时 SHA-256：`d5427d91f41b0feab012cb593d432ac7cf13dfa8ba25e2443bcf0e60949d1b93`。
- 150 对场景的标签未改变。下面的案例编号仅帮助追溯需求，不得成为解析或比较条件。重新实现后，此文件不能再支持“未见过的盲测”声明。

## 1. 已实际运行的接口层复现

以下探针直接构造已经理解正确的意图，或给适配器提供合法 JSON 与原文证据，绕过自然语言提取。固定 `now=2026-09-11T04:00:00Z`。它们是接口测试，不是模型效果统计。

| 输入事实 | 当前实际结果 | 问题 |
| --- | --- | --- |
| 互换房间，双方 `term` 分别为 `2026-09-01 to 2027-08-31`、`2026-09-01 to 2026-12-31` | `high` | `termConflict` 只取首个年份和四季名；不同住宿终止日期消失 |
| 同样的互换房间，接受房型 `wantedRoom=any`，对方提供 single | `reject` | schema 允许 `any`，比较却把它当普通房型字符串 |
| 双方用不同型号电池互换，均 `side=swap` | `reject` | goods 只允许 offer/seek；不同物品也无法通过相同 entity 召回 |
| 羽毛球活动已有位置，邀请者 `offer`、加入者 `seek`，时间地点相同 | `reject` | other 只允许 peer/peer；适配器另加 `service-direction` 缺失项 |
| 卖价 100 未知币种，买方预算 150 HKD | `high` | 未知币种被默认成 HKD |
| 卖方两件每件 100，买方两件预算 150、计价单位未说明 | `high` | 未知计价单位被默认成 unit，未验证总预算 |
| 明确借电钻 30 HKD，13 日取、14 日还，模型正确输出 loan | `possible` 所需缺失项包括 `transaction:loan`、日期/时间 grounding | 双事件被单个 date/minute 承载，借用本身也未支持 |
| 明确免费辅导，模型正确输出 `studyFee=0` | 缺失项 `study-fee` | 即使零费用已明确，也无条件降级 |
| 明确不能放行李箱，模型正确输出 `luggage=0` | 缺失项 `luggage` | 连明确为零的容量也尚无比较规则 |
| 司机 0 个空位、乘客 1 人 | `reject` | 正常对照；已有直接容量比较有效，不应重写掉 |

其中前三类不是“多写几条同义词”可以解决的。探针直接输入了正确字段。

## 2. 最小公共协议：区分事实、要求与未知

建议保留三种比较结果：`compatible`、`conflict`、`unknown`，之后再映射为 high、reject、possible。不能把“字段未出现”当成 false、免费、没有行李、任何房型、任何语言，或者已经同意一项规则。

- **事实**：作者声称自己有什么、能提供什么、能参加什么。例如已有房间、现有人数、可用座位、本人是 PG、拥有 Java 版。
- **要求**：必须由对方或共同活动满足的条件。例如两人必须同车、只能免费、对方必须 PG、不能饮酒。
- **范围**：某一条独立请求、一个方向的行程、借出或归还事件。不能把整帖所有事实任意组合。
- **未知**：未说明，或者明确说尚未确定。保留来源和缺失理由；未说明与明确否定不是同一个值。
- **软偏好**：如“黑色优先”“免费最好”。不应自动转为硬过滤；“只要黑色”“最高 80”才是硬条件。

### 最少必需字段与被触发的可选约束

应先区分“这个匹配本来必须回答什么”和“原文明示了哪项额外硬条件”。JSON 里可省略的字段，不代表可以忽略原文里已经说出的条件；反过来，原文从未提出的所有想象条件也不应一律加 missing。

| 意图 | 能构成该类匹配的最小信息 | 有明确约束时才额外核验 |
| --- | --- | --- |
| 住宿交换 | 两边实际可提供的房间与目标、命名空间、相容住宿期、可接受房型；当前验收要求的分配/交换资格自述 | 更多入住细节、额外设施偏好；房型/资格的明确排除必须处理 |
| 商品 | 确定的供需或双向互换角色、相容交易模式、能确定同一物品范围；收费交易中已提出的报价/预算条件 | 具体型号、大小、颜色、品相、搬运、指定交收；借用另外必需覆盖使用和归还 |
| 学习 | 明确 tutor/learner 或 peer 角色、足够具体的共同内容、可相遇的学习时间及必要交流条件 | 明示的费用、必须线上或指定场地、必须同课、整小时/整场、组内名额 |
| 交通 | 确定方向、实际起终点、出发时间、互补角色；司机空位覆盖乘客人数，或共同出租车计划的总占用可核验 | 明示费用、行李、不能拆分/绕路/等待等；没有约束不等于替用户承诺免费或有后备箱空间 |
| 社交 | 明确发起/加入或共同结伴、同一活动、时间及会合方式 | PG/性别/技能限制、装备、版本、规则接受、访客权限、已经提出的名额与完整参加要求 |

具体边界：双方都没提出费用，不需要凭空编造收费或把所有普通结伴永久放进 possible；但也不能显示“免费相容”的理由。一旦一方明确免费限定、报价或预算，就需要足以核验该费用的事实。双方明确免费时直接比较费用 0，不应因“费用字段属于额外字段”而仍然 possible。

技能也是如此：普通不限水平的约球，不要求用户先填写等级；明确 beginners-only 时，对方明确新手即可通过，对方不清楚水平才是 unknown。仅凭添加一个可选字段，就无条件把所有带该字段的帖子降级，既损害召回，也没有增加正确的语义判断。

同理，商品双方都未指定取货时间时，没有“双方时间冲突”可以声称；一方提出必须某天取货，另一方完全未说明是否可行，则该硬约束尚未核验。地点和费用、数量等都采用相同的“被明示条件触发”规则，而不是全字段填满表。

本轮验收把住宿的分配和交换资格作为帖子自述的必要前提，并不是核验校方系统。如果产品以后决定先提供潜在联系人、再私聊确认资格，应通过 possible 阶段表达，不能在本轮测评中无声删除这一前提。

下面是建议的内部兼容表示，不要求把所有字段塞给小模型，也不是本轮已经实现的代码：

```ts
type Presence = 'confirmed' | 'denied' | 'unknown';
type Role = 'offer' | 'seek' | 'peer' | 'host' | 'join' | 'driver' | 'rider' | 'share' | 'swap';
type EvidenceRef = { text: string; fields: string[] };
type Window = { start?: string; end?: string }; // 经校验的带时区 ISO 时间

type Money = {
  amount?: number;
  currency?: string;
  basis?: 'item' | 'bundle' | 'person' | 'party' | 'session' | 'hour';
  scope?: 'asking' | 'maximum';
};
type ItemSpec = {
  entity: string;
  model?: string;
  edition?: string;
  quantity?: number;
  attributes?: Attribute[];
};
type Attribute = {
  key: string;                 // 必须来自服务端有限注册表，不能执行任意表达式
  op: 'eq' | 'in' | 'not-in' | 'gte' | 'lte' | 'between';
  value: string | number | boolean | Array<string | number>;
  unit?: string;
  hard: boolean;
  evidence: EvidenceRef[];
};

type CompatibleIntent = {
  kind: string;
  role: Role;
  state: 'active' | 'withdrawn' | 'uncertain';
  transaction?: 'sale' | 'gift' | 'loan' | 'rent' | 'barter';
  offeredItem?: ItemSpec;
  wantedItem?: ItemSpec;
  pickup?: { place?: string; window?: Window };
  returnHandover?: { place?: string; window?: Window };
  usePeriod?: Window;
  money?: Money;
  deposit?: Money;             // 押金与费用不能合并
  offeredResidence?: ResidencePeriod;
  wantedResidence?: ResidencePeriod;
  allocation?: Presence;
  exchangeEligible?: Presence;
  wantedRooms?: string[];
  partySize?: number;
  openPlaces?: number;
  vehicleCapacity?: number;
  bagsBrought?: Bag[];
  bagsAllowed?: Bag[];
  courseIds?: string[];
  topics?: string[];
  requiredCourseIds?: string[];
  fixedSession?: Window;
  availability?: Window[];
  requiredDurationMinutes?: number;
  facts?: Attribute[];
  requirements?: Attribute[];
  unresolvedRequirements?: string[]; // 原文；未实现比较就保留 unknown
};
type ResidencePeriod =
  | { type: 'academic-year'; startYear: number; endYear: number }
  | { type: 'semester'; year: number; semester: 'fall' | 'spring' | 'summer' | 'winter' }
  | { type: 'dates'; start: string; end: string };
type Bag = { kind: 'backpack' | 'small-bag' | 'cabin-case' | 'large-case'; count?: number; perPerson?: boolean };
```

最小落地不必一次实现全部 `Attribute` 键。先实现下文的类型化分支；其余原文条件继续 unknown。不要为了达到召回率而把 `otherRequirements` 直接清空。

## 3. 商品：交易模式、归还、互换与实物规格

### 3.1 借用有两个交接事件

借物双方首先必须有相容的交易模式，之后才比较价格。出售与只借不买直接冲突；“可以借，也可以卖”是两种明确接受的交易选择，不是一个未知模式。

- `loan` 或 `rent` 的 offer/seek 必须比较取物、还物、使用时段及借用费用。
- 物主可出借时段应覆盖借方完整的使用时段；两个时段有交集远远不够。
- 归还时间、地点是独立交接约束，不能压到同一个 `date/minute/endMinute`。跨日归还不是时间歧义。
- 费用与押金分别比较；30 元借用费不能因为 100 元押金而变成售价 130。
- 免费借用有明确费用 0；“免费最好”属于偏好，不能擅自变成“预算严格等于 0”。

公开场景中的电钻借用、转接器隔夜借用展示了这些区别（`v2-goods-m02`、`m07`、`r06`）。建议先实现 `transaction + pickup + returnHandover + usePeriod + money`，其余旧 sale 流程无需重构。

### 3.2 互换不同物品必须双向检查

互换相机电池不能归为两个独立出售意图：作者只愿意换，不一定愿意卖。

- A 提供的物品满足 B 想要的完整规格。
- B 提供的物品满足 A 想要的完整规格。
- 两边数量、真实性、工作状态、地点与时间都成立。
- 召回索引以“对方所需物品”查“本人所提供物品”，同时保留交换另一半；不能要求两个 offered entity 一样。

`v2-goods-m09` 展示这一结构。最小实现是 `offeredItem + wantedItem + transaction=barter`，比较和索引都加一个 barter 分支。不能把 swap 改写成 sale 让旧逻辑勉强通过。

### 3.3 规格不等于自由文本 model

至少需要支持三类已有明确需求：数值大小范围、工作状态、真实性/格式。

- 卖方宽度 100 cm 与买方上限 110 cm：统一长度单位后比较 `100 ≤ 110`。
- 卖方 40 L 与买方范围 35–50 L：比较区间包含；容量未知是 unknown。
- 卖方厚 6 mm 与买方最低 5 mm：比较下界。
- `used` 不代表已经证明 `working`；“正常使用”“未测试”“坏机拆件”应分别保留。
- 原厂、纸本、无缺页等是物品事实或要求，不能靠 model 字符串附加几个词来凑完全相等。

可先注册 `width`、`volume`、`thickness`、`working`、`genuine`、`format` 等有限属性。禁止未知单位强行换算。相关公开例子：`v2-goods-m03/m06/m08/m11/u07`。

## 4. 住宿：住宿期、实际分配与资格必须分开

现有一个 `term` 字符串不足以表示完整学年、学期、具体起止日期；`eligibility=male/female` 也不能表示是否获分配、是否有交换资格。

- 同一学年 `2026/27`、`2026–2027 academic year` 可规范为同一个学年对象。
- 同一个具体起止日期范围可精确比较，不再只拿首个年份。
- 明确要求全年、对方只有一个学期，不能因为起始年份一样就判相容。
- 学年对象与具体日期对象之间只有在项目已有经过确认的校历映射时才能互转。不能凭常识把所有学年的开始/结束都补成 9 月 1 日与 8 月 31 日。没有映射时应 unknown。
- 各人“持有的住宿期”和“所需住宿期”分开；要求的时段必须由对方实际可交换的分配覆盖。部分时段互换是否可行，不能自行设定校方政策。
- `allocation=denied` 或 `exchangeEligible=denied` 应冲突；unknown 不应变成已确认。
- UG、PG、University Apartments 命名空间保留；未标命名空间不能默认 UG。
- `wantedRooms=['single','double']` 是允许集合。已知 actual room 为 single 即可满足；actual room 未知仍是 unknown。不要用 `any` 同时表示“不限房型”和“不知道自己的房型”。

公开例子覆盖全年、精确日期、春季分配、候选房型与明确无资格（`v2-hall-m01/m03/m06/m07/m08/r10`）。这些是帖子声明的事实，不代表系统核验了真实宿舍政策。

## 5. 活动与学习小组：邀请、加入和一般结伴不同

把所有人压成 peer，会掩盖容量和参与条件；把邀请写成 offer、加入写成 seek，又会被现有 other 分支直接拒绝。

最小角色矩阵：

| A / B | 相容条件 |
| --- | --- |
| host / join | 同一活动与场次，剩余位置足够，加入者满足参与条件 |
| peer / peer | 双方确实在约同一种共同活动，安排与约束有交集 |
| host / host | 默认不互补；只有明确愿意合并活动才另建意图 |
| join / join | 都在找现成活动时默认不互补；明确可以自组才有 peer 意图 |
| study tutor / learner | 专题、授课形式、语言、时间、费用相容 |
| study group host / learner-peer join | 学习活动确为 peer，且剩余位置足够 |

`partySize`、`openPlaces` 必须可以用于活动和学习组，不限 transport。五人球局还差一位，应检查对方是一人；两人一起不可拆分不能塞进一个名额。位置为 0 的活动不是可加入供给。

固定活动时段与个人可用时段也不能混成一种区间。一个要完整参加 60 分钟辅导的人，只和老师重叠 5 分钟时，不应该因为区间有交集就 high。建议 `fixedSession` 与 `availability` 分开；当整场参加或最短时长是硬要求时，求交集后再检查覆盖或时长。

邀请和加入集中出现在 `v2-other-m01` 至 `m12`，学习组见 `v2-study-m05`。场地应保留到明确的球场号、桌号、入口或线上频道；不能把全校园、所有 Discord 频道都归为一个地点。

## 6. 费用、行李与资源容量

### 6.1 各类金额使用同一个有单位的比较器

当前适配器对所有 `fare/studyFee` 无条件加 missing 是安全过渡，但保证了正确提取也无法 high；删除 missing 而不比较价格会产生反方向的错误。

- 明确同币种、同计价基准时比较供给价格与需求上限。
- 每人费用与团体总价转换必须知道实际人数；每小时费用与整节预算转换必须知道收费时长及最短购买时长。
- 未知币种不能默认 HKD；未知 basis 不能默认 unit。两边都明确免费时金额 0 的比较不需要凭空确定币种。
- 免费本身是已知约束。提供收费服务与只接受免费者冲突；愿付最多 100 与免费供给相容。
- 货币不同且未配置汇率/结算规则时 unknown；不要把币种不同的数值直接比较。
- 价格是否“优先/最好”或“绝对上限”要保留硬/软区别。

公开例子：乘客费用每人 30 与预算每人 40（`v2-transport-m02`）、180 元辅导对 100 元上限（`v2-study-r07`）、免费辅导多组。

**旧训练指标的口径冲突必须保留。** 旧 3,746 帖语料的兼容 oracle 直接比较 `price`，没有独立 currency/计价约束维度；其标签包含按校园港币语境处理未显式币种的约定（例如仅写“蚊”）。采用新的“币种未明确就不能靠默认 HKD 证明预算相容”语义后，某些旧 gold match 会降为 unknown，旧召回率可能下降。这不应通过暗中补 HKD、把不利样例剔除或改原标签来隐藏。

保留原始标签与其原分母照常报告；另列“旧 oracle 约定与新严格未知规则的分歧”及受影响数量。若以后要按新语义重标，必须创建新的数据版本并同时保留两套结果，不能仍宣称对同一验收口径达到原分数。只有产品明确建立并告知用户的币种/单位默认规则，才可以成为可见的业务事实；模型不能自行设定该规则。


### 6.2 行李需要类型和方向

单一 `luggage:number` 不知道是在描述乘客带什么还是司机能装什么，也不能区分一个小袋与一个大行李箱。

- `bagsBrought` 表示乘客必须同行的物件；`bagsAllowed` 表示司机或实际车辆允许的物件。
- 数量按同一包型比较，明确 `perPerson` 才能按人数计算。
- “绝对不接行李箱”是该类型容量 0；有 1 个座位不证明有装箱空间。
- 未检查后备箱空间且乘客要求携带两个大箱，应 unknown。
- 小背包与小手提袋是否可互替，除非原文或明确产品规则允许，否则不能自行做体积等价推断。
- 对 taxi share，已知乘客容量属于具体共同车辆/方案；并非要求每个加入者重复声明一次容量。加入者明确接受同一车辆时可使用组织方容量。若双方各自坚持互不相容的车辆方案，需额外检查。

相关例子：`v2-transport-m02/m05/m06/r07/u06`。已有司机座位数与乘客人数比较可以保留。

## 7. 否定条件与参与资格使用有限谓词表

`requiredSkill` 一项远不够表达 PG-only、women-only、需要自备球拍、Java 版、无酒精、90 分钟行走能力、宿舍访客进入权限等。全部塞到 `otherRequirements` 并永远 unknown 虽不误配，也不可能达到覆盖目标。

建议第一批通用属性键：

- `participant.studyLevel`、`participant.statedGender`、`participant.skill`。
- `participant.ownsEquipment`、`participant.gameEdition`、`participant.canWalkMinutes`。
- `participant.acceptsNoAlcohol`、`participant.acceptsVegetarianOnly`。
- `event.languages`、`event.guestAccess`、`event.requiredEquipment`。
- 上文的物品规格与收费、行李字段使用类型化分支，避免重复造属性。

所有值仅来自本帖作者自己的明确声明。不能根据昵称、写作语言、个人资料或模型猜测推导性别、课程层级、技能、设备拥有情况或规则接受度。

对每条硬要求：

1. 对方事实明确满足 → compatible。
2. 对方明确相反、明确拒绝 → conflict。
3. 对方没有说明或明确未决定 → unknown。

例如无酒精活动的加入者明确会带酒，应冲突；尚未决定是否接受，应 unknown。不是看到两边都有“酒”就认定相同主题，也不是因对方没有主动反对就推定接受。

邀约者提供球拍时，可以满足加入者需要借拍；要求自带但对方未说明有拍则 unknown。不同主体的事实必须保留，不能把邀约者有拍当成加入者已经自备。

`v2-other-m01/m06/m07/m08/m09/r05/r06/r07/r08/u03/u04/u05` 说明这些都是跨活动通用约束，不是某个案例专有规则。

## 8. 学习主题与召回不能继续只有一个 entity

当前 study 的 entity 经常是课程号，但有些帖子只明确题目和结伴需求，没有重复课程号。把课程号与具体主题折叠成一个字符串，会在进入比较之前就丢候选。

建议：

- 分开 `courseIds`、`topics`、`exam/format`；题目同义词与课程信息各自保留。
- `requiredCourseIds` 只表示作者明确要求同课、同一课程考核或指定课程内容的硬条件。知道作者在读哪门课，不总等于他拒绝其他课的同伴。
- 可按明确的具体主题或课程建立多个召回入口，再检查是否真有足够的共同范围。
- 对“computing 都可以帮忙”不能推定会讲 pointers；不具体的 topic 仍 unknown。
- IELTS speaking 与 TOEFL-only speaking 不能只因都是 speaking 就互配。
- 泛泛课程辅导与明确特定主题，仍需证明供给覆盖；不要因为召回放宽就去掉已有 topics 约束。
- 单独帖子中的“同课”若没有可解析的所指，不要从眼前候选倒推出课程号。这会让任何候选都成为自证的“同课同学”。

相关公开场景：`v2-study-m02/m04/m10/m11/r09/u01/u06`。建议先区分检索键和硬约束键，避免重新写一套对所有类别都用字符串完全相同的路由。

## 9. 状态、证据与适配错误不能静默吞掉

### 状态要支持 uncertain

`active/withdrawn/uncertain` 应属于具体意图。多件商品“其中一个卖了”、两趟车“其中一个取消了”但没说哪条，不能自行保留刚好能配上的那项。把整帖所有意图都取消也不正确。

不明确撤销范围时，把受到影响的候选意图设为 uncertain。已明确的独立需求照常保留。单纯的 `evidence` 片段不能绕过全文中明确指向该意图的更新。

### 证据存在不等于字段成立

现在 `numberSupported` 只证明数值在证据里出现。例如原文有“两个人”和“车费 100”，数值 2 的存在不证明价格也是 2。需要少量字段绑定证据：`{text:'每人HK$30', fields:['money.amount','money.basis']}`，再按字段的单位和方向校验。

这仍不等于解决了所有语义真实性。模型把不存在的型号或资格写进合法 JSON，JSON schema 不会识别；独立标注评估仍必需。

### 日期 grounding 不能重新引入旧解析器的召回天花板

一个模型正确提取隔日归还，却把取物和归还一起交给单事件 `extractSchedule`，会被误降为 ambiguous。处理顺序应是：模型先标注事件类型和各自的证据，再分别校验时间；不能把同一意图所有证据串起来只跑一次日期解析。

对真正清楚但当前文本校验器还不支持的自然时间，保留 `grounding_unsupported` 与原文，不冒充已证明正确；也不要把它与“模型输出和原文明显矛盾”混成一个错误。后者应更严格拒绝。

### 紧凑输出与有限字段

不必强迫模型输出全部 nullable 字段。保留省略未知字段的短 JSON，每条意图给必要事实、要求和少量绑定证据。适配器按 kind 验证字段，限制数组和字符串长度，拒绝未知谓词名。谓词是静态白名单上的比较器，绝不执行模型输出的代码或表达式。

当前至多 4 条意图应明确暴露 `truncated/remaining-unparsed` 状态，否则四个地点选择会耗尽输出名额，独立第五条需求悄悄消失。明确的地点/房型备选最好留在同一意图的允许集合中，避免笛卡尔积膨胀。

## 10. 推荐的最小实现顺序与验证方式

1. **拆开语义记录和可匹配状态**：添加意图 `state`，保留未知原因；明确抽取错误、表示不支持、规则不支持、grounding 不支持这四种日志分类。修复未知 currency/basis 默认值和 `wantedRoom=any` 契约不一致。
2. **补最小类型化兼容规则**：transaction 与借还事件；住宿期及允许房型；host/join 与名额；费用、行李方向和类型。只对已经实现并验证的条件解除 adapter 的对应 missing。
3. **补有限事实/要求规则表**：技能、身份自述、设备、游戏版本、行为接受与访客进入。未实现的条件继续 unknown。不要把模型自评 confidence 当作通过规则的依据。
4. **同步召回结构**：barter 双向物品、study topic/course 多入口、活动实例/类型。召回只能扩大需要核对的候选，不得改变兼容标准。
5. **再测模型整体链路**：同一份保存的模型输出分别记录 schema、grounding、表示、检索、比较结果，定位失败究竟在哪一层。避免每改一次规则就重新推理所有文本，造成输出漂移混淆原因。

每类规则先写不经模型的单位测试，直接构造正确语义对象，至少覆盖 compatible/conflict/unknown 三态；再复用公开开发案例做回归。所有标签与原文件哈希保留。最后重新冻结新的独立场景和候选池，才能再次报告盲测精度、召回以及 P@5。本文没有测量也没有声称这些改进能达到目标阈值。

建议新增的最小属性测试包括：交换 A/B 后结果应对称；去掉一个明确满足硬条件的事实只能保持 unknown 或降级，不能把 conflict 提升成 high；人数或费用超过明确上限必须冲突；缩小可用时间不能增加可参加完整场次；独立请求的撤销不能污染另一条；未知币种/单位/资格不得通过默认值“修复”。
