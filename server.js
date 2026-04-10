const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "study-data.sqlite");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-before-selling-access";
const ACTIVATION_CODES = parseActivationCodes(process.env.ACTIVATION_CODES || "STUDY-DEMO-2026");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function parseActivationCodes(raw) {
  return String(raw)
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function openDatabase() {
  ensureDataDir();
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS activation_codes (
      code TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_users (
      token TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_reports (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      report_json TEXT NOT NULL,
      FOREIGN KEY(token) REFERENCES study_users(token) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS study_profiles (
      token TEXT PRIMARY KEY,
      summary_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(token) REFERENCES study_users(token) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS knowledge_snippets (
      id TEXT PRIMARY KEY,
      scenario TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]'
    );
  `);
  seedActivationCodes(db);
  seedKnowledgeSnippets(db);
  return db;
}

function seedActivationCodes(db) {
  const stmt = db.prepare("INSERT OR IGNORE INTO activation_codes (code, created_at) VALUES (?, ?)");
  ACTIVATION_CODES.forEach((code) => stmt.run(code, new Date().toISOString()));
}

function seedKnowledgeSnippets(db) {
  const snippets = [
    {
      id: "study-tier-balance",
      scenario: "general",
      title: "选校梯度原则",
      content: "选校不要只看排名，要把课程匹配、先修要求、预算、地区就业资源和截止日期一起放进组合里，保持冲刺、匹配、保底平衡。",
      tags: ["选校", "梯度", "预算", "匹配"]
    },
    {
      id: "study-fit-over-ranking",
      scenario: "general",
      title: "匹配度优先于单纯排名",
      content: "公开申请案例里，真正提高成功率的往往不是盲冲更高排名，而是把课程内容、教授方向、项目资源和自己的经历证据对上。排名可以决定上限，匹配度决定说服力。",
      tags: ["匹配度", "排名", "课程", "项目资源"]
    },
    {
      id: "study-specific-story",
      scenario: "general",
      title: "经历要能落到具体证据",
      content: "高质量申请文书和案例总结的共同点，是把经历写成可验证的证据链：做过什么、怎么做、结果如何、为什么导向这个专业，而不是只说热爱或兴趣浓厚。",
      tags: ["文书", "经历", "证据链", "故事线"]
    },
    {
      id: "study-whole-profile",
      scenario: "general",
      title: "招生方看的是整体画像",
      content: "公开招生建议反复强调，学校不会只看一个数字。成绩、经历、推荐信、文书、目标契合度和长期路径通常会一起判断，所以申请策略也不能只围绕一个短板打转。",
      tags: ["整体画像", "多维判断", "成绩", "契合度"]
    },
    {
      id: "study-employability-path",
      scenario: "career-oriented",
      title: "就业导向申请更看路径可落地",
      content: "公开就业与升学结果里，正向样本通常不是单纯名校最高，而是课程训练、实习机会、地区资源、签证/求职路径和个人背景能接得上。就业导向用户要优先看可落地路径，而不是只看头部名气。",
      tags: ["就业导向", "可落地路径", "地区资源", "实习机会"]
    },
    {
      id: "study-cn-pragmatic-choice",
      scenario: "china-pattern",
      title: "中国学生选校越来越务实",
      content: "近年的留学白皮书和公开机构趋势里，一个稳定变化是：越来越多中国学生不会只盯综合排名，而会把就业率、学费、专业排名、申请要求和毕业起薪一起纳入判断。申请建议也要更务实，而不是只讲名校光环。",
      tags: ["中国学生", "务实选校", "就业率", "学费"]
    },
    {
      id: "study-cn-multi-destination",
      scenario: "china-pattern",
      title: "混申和多地区比较变得更常见",
      content: "中国家庭近年的申请路径越来越常见多地区混申：英美加澳港新会被放到同一决策盘里做比较。对这类用户，建议不能只在单一国家里找最优解，而要给出多条跨地区路线。",
      tags: ["中国学生", "混申", "多地区", "路线比较"]
    },
    {
      id: "study-cn-stem-shift",
      scenario: "china-pattern",
      title: "理工科和医科热度上升",
      content: "公开白皮书趋势显示，中国学生近年申请偏好更向理工科、计算机、数据、工程和部分医科靠拢，商科相对回落。对于理工背景用户，可以更强调技术准备、项目证据和就业路径的连贯性。",
      tags: ["中国学生", "理工科", "计算机", "就业趋势"]
    },
    {
      id: "study-cn-document-mismatch",
      scenario: "china-pattern",
      title: "中国申请者常见问题是文书和国家逻辑错配",
      content: "公开机构复盘里，一个高频误区是把英美项目文书用同一套模板写，忽略国家和项目差异。判断申请策略时，要提醒用户：不同国家、不同项目看重的叙事逻辑不一样，不能简单复制。",
      tags: ["中国学生", "文书", "英美差异", "模板"]
    },
    {
      id: "study-cn-hk-competition",
      scenario: "hk-sg",
      title: "中国学生申请港新常见高热高竞争",
      content: "公开趋势资料反复提到，中国学生对港新热度持续很高，但竞争也明显变强。对港新意向强的用户，建议里应该自然加入梯度控制，不要默认把所有预算和期望都压在最热门项目上。",
      tags: ["港新", "中国学生", "竞争激烈", "梯度控制"]
    },
    {
      id: "study-cn-budget-rational",
      scenario: "budget",
      title: "中国家庭更在意投入产出比",
      content: "近年的中国留学趋势里，预算和性价比已经从辅助因素变成主决策因素。对预算敏感用户，判断时应该更主动讨论总成本、奖学金、地区资源和毕业去向，而不是简单推荐更贵的学校。",
      tags: ["中国家庭", "预算", "性价比", "投入产出"]
    },
    {
      id: "study-cn-undergrad-family",
      scenario: "undergrad",
      title: "本科申请通常是家庭共同决策",
      content: "中国学生的本科申请常见特点是家长参与度更高，因此学校支持体系、生活环境、费用、升学出口和安全感会比研究生申请更重要。对本科用户，建议里要把这些现实因素说清楚。",
      tags: ["本科", "家庭决策", "支持体系", "费用"]
    },
    {
      id: "study-cn-cross-major-bridge",
      scenario: "china-case",
      title: "中文案例里跨专业成功通常靠桥梁路径",
      content: "公开中文案例里，跨专业成功往往不是直接硬转，而是通过先修课、预科、桥梁项目、相关工作经验或项目经历把故事接起来。对跨专业用户，系统应优先推荐能承接转向的路径。",
      tags: ["中国案例", "跨专业", "桥梁路径", "预科"]
    },
    {
      id: "study-cn-double-non-path",
      scenario: "china-case",
      title: "双非背景更依赖组合设计",
      content: "公开中文案例里，双非背景拿到好结果通常更依赖组合设计：少量冲刺、更多匹配、清晰文书主线和可验证经历。系统在判断这类用户时，应该更强调结构，而不是单点冲高。",
      tags: ["中国案例", "双非", "组合设计", "文书主线"]
    },
    {
      id: "study-cn-foundation-route",
      scenario: "china-case",
      title: "本科和转向申请常见预科或衔接路径",
      content: "公开中文案例显示，本科申请或学术背景不完全匹配时，预科、foundation year 或衔接课程是常见可行路径。系统在推荐本科和转向方案时，应该把衔接路径视作正经选项，而不是失败备胎。",
      tags: ["中国案例", "本科", "预科", "衔接课程"]
    },
    {
      id: "study-cn-art-portfolio",
      scenario: "media-design",
      title: "中文案例里艺术设计更依赖作品集兑现",
      content: "公开中文艺术设计录取案例里，作品集通常是最关键变量，语言和 GPA 只是基础门槛。系统对设计、传媒、创意方向用户，应优先判断作品证据和表达风格，而不是套用普通专业逻辑。",
      tags: ["中国案例", "艺术设计", "作品集", "表达风格"]
    },
    {
      id: "study-cn-high-score-upside",
      scenario: "china-case",
      title: "高分用户也需要防止申请过窄",
      content: "中文案例里，高分用户并不等于可以只投顶尖项目。很多正向结果来自高分背景加合理梯度设计，而不是全压头部。系统应提醒高分用户也保留匹配和保底结构。",
      tags: ["中国案例", "高分", "梯度设计", "风险控制"]
    },
    {
      id: "study-positive-outcomes",
      scenario: "career-oriented",
      title: "正向结果样本通常有共同特征",
      content: "公开的正向就业结果样本往往具备几个共同点：课程和目标行业贴得近、在读期间有实习或项目、申请时就考虑毕业去向、并且学校所在地区能提供真实机会。申请策略应主动朝这些特征靠近。",
      tags: ["就业结果", "行业贴合", "实习", "毕业去向"]
    },
    {
      id: "study-recommendation-quality",
      scenario: "general",
      title: "推荐信看熟悉度不是头衔",
      content: "公开招生建议里反复强调，推荐人最重要的是了解你的学术能力或专业表现，能写出细节和判断，而不是只有名气。材料包越完整，推荐信越容易写得强。",
      tags: ["推荐信", "熟悉度", "材料包", "细节"]
    },
    {
      id: "study-timeline-packing",
      scenario: "general",
      title: "申请材料要按时间线打包",
      content: "很多失败案例不是背景差，而是节奏乱：选校太晚、推荐信没提前准备、文书版本混乱、截止日期前集中堆任务。申请路径要提前拆成月度动作，而不是最后两周硬赶。",
      tags: ["时间线", "截止日期", "推荐信", "文书版本"]
    },
    {
      id: "study-late-cycle",
      scenario: "late-timeline",
      title: "时间线偏晚时要先保交付",
      content: "如果离提交只剩几个月，策略重点要从“广撒网”切换成“先把能交稳的项目准备完整”。公开申请经验里，后期最容易失分的是材料质量失控，而不是学校选得不够多。",
      tags: ["时间线", "晚申", "交付", "材料质量"]
    },
    {
      id: "study-early-cycle",
      scenario: "early-timeline",
      title: "时间线充足时要先建素材库",
      content: "如果还有 9 到 12 个月以上准备期，最值得先做的不是急着定终版文书，而是先建立项目清单、经历素材库、推荐信素材包和考试节奏，这样后面更容易拉开申请质量。",
      tags: ["时间线", "早准备", "素材库", "考试节奏"]
    },
    {
      id: "study-low-gpa",
      scenario: "low-gpa",
      title: "低 GPA 申请思路",
      content: "GPA 不占优势时，重点不是硬冲头部项目，而是补课程项目、量化成果、解释材料和更稳的保底组合，避免申请结构失衡。",
      tags: ["GPA", "低分", "保底", "项目"]
    },
    {
      id: "study-low-gpa-trend",
      scenario: "low-gpa",
      title: "低 GPA 更要讲清趋势",
      content: "如果早期成绩拖后腿，但后期明显回升，可以把趋势、难课表现、量化课程和补强项目放在一起讲清楚。招生方更容易接受“有成长轨迹”的申请人，而不是没有解释的低分。",
      tags: ["GPA", "趋势", "难课", "解释"]
    },
    {
      id: "study-transfer-major",
      scenario: "transfer",
      title: "转专业申请",
      content: "转专业更看先修课、桥梁经历、项目证据和文书主线，不能只说感兴趣，要证明自己已经具备转向目标领域的基础。",
      tags: ["转专业", "先修课", "项目", "文书"]
    },
    {
      id: "study-transfer-proof",
      scenario: "transfer",
      title: "转专业最怕动机和证据脱节",
      content: "公开成功案例里，转专业申请通常会形成闭环：原专业带来的能力基础、具体桥梁课程或项目、新方向想解决的问题、未来路径。只讲热情不讲准备，会显得跳跃。",
      tags: ["转专业", "桥梁经历", "动机", "闭环"]
    },
    {
      id: "study-budget",
      scenario: "budget",
      title: "预算有限策略",
      content: "预算有限时，要把申请费、学费和生活成本一起算，不要把时间和预算过度压在高风险冲刺项目上。",
      tags: ["预算", "成本", "冲刺", "保底"]
    },
    {
      id: "study-budget-roi",
      scenario: "budget",
      title: "预算有限更要看投入产出",
      content: "预算有限时，公开经验里最常见的后悔点是只盯名校名气，忽略总成本、奖学金概率、实习资源和毕业去向。申请结构应该优先保证可落地，再谈更高排名。",
      tags: ["预算", "奖学金", "就业", "投入产出"]
    },
    {
      id: "study-us-research-fit",
      scenario: "us",
      title: "美国申请更强调研究与职业路径说明",
      content: "美国硕博申请的公开招生建议里，常见要求是把研究兴趣、过往训练、项目/实习成果和未来路径连起来。只写学校有多好，通常不如讲清楚你为什么和这个项目匹配。",
      tags: ["美国", "研究兴趣", "职业路径", "匹配"]
    },
    {
      id: "study-us-recommendation",
      scenario: "us",
      title: "美国项目更看推荐信可比性",
      content: "公开推荐信要求里常出现对申请人在同类群体中的位置判断，所以推荐人除了熟悉你，还要能比较你的能力层级。申请人越早准备材料包，推荐信越容易写出含金量。",
      tags: ["美国", "推荐信", "比较", "材料包"]
    },
    {
      id: "study-uk-course-structure",
      scenario: "uk",
      title: "英国申请更适合先看课程结构",
      content: "英国项目数量多、项目差异细，公开官方建议普遍强调先看课程设置、模块、是否有 placement、学费和录取要求，再决定是否申请。只看学校名气很容易选错项目。",
      tags: ["英国", "课程结构", "modules", "placement"]
    },
    {
      id: "study-uk-apply-early",
      scenario: "uk",
      title: "英国硕士很多项目适合尽早申请",
      content: "公开英国申请指南常建议尽早递交，尤其是滚动录取或热门项目。时间拖太晚，可能不是背景不行，而是名额、奖学金和宿舍资源都变得不友好。",
      tags: ["英国", "尽早申请", "滚动录取", "奖学金"]
    },
    {
      id: "study-uk-career-signal",
      scenario: "uk",
      title: "英国就业导向要关注课程与行业连接",
      content: "英国申请里，正向就业样本通常更看课程模块、placement、行业项目、校友网络和所在城市资源。对就业优先的人来说，课程和行业连接度常常比综合排名更影响结果。",
      tags: ["英国", "就业", "placement", "行业连接"]
    },
    {
      id: "study-hk-sg-balance",
      scenario: "hk-sg",
      title: "港新申请要兼顾排名与落地性",
      content: "港新项目普遍节奏快、申请集中，公开经验里常见误区是只盯最热门项目，忽略课程匹配、量化要求和整体梯度。更稳的做法是把热门项目和更适合自己背景的项目同时放进组合。",
      tags: ["港新", "梯度", "量化", "热门项目"]
    },
    {
      id: "study-hk-sg-career",
      scenario: "hk-sg",
      title: "港新正向就业样本更看适应快和技能对口",
      content: "公开港新就业结果里，正向样本常见于量化能力、英语表达、实习经历和行业匹配都较完整的申请人。对求职导向用户，申请时就应优先选择和目标行业技能要求更贴合的项目。",
      tags: ["港新", "就业", "量化能力", "实习经历"]
    },
    {
      id: "study-au-course-choice",
      scenario: "australia",
      title: "澳洲申请先看课程类型和实际路径",
      content: "澳洲官方留学指引会先区分本科、授课型硕士、研究型硕士和博士。申请判断不能只看学校名气，还要先分清自己适合 coursework 还是 research，以及项目是否真的承接你的下一步目标。",
      tags: ["澳洲", "coursework", "research", "路径"]
    },
    {
      id: "study-au-cost-support",
      scenario: "australia",
      title: "澳洲要把成本和支持体系一起看",
      content: "澳洲官方信息会提醒国际学生同时比较课程、学校、地区生活成本、支持服务和奖助学金。对预算有限的人来说，城市和总成本经常和学校名气一样重要。",
      tags: ["澳洲", "生活成本", "支持体系", "奖学金"]
    },
    {
      id: "study-au-employability",
      scenario: "australia",
      title: "澳洲正向就业样本常伴随实习和工作经验",
      content: "澳洲官方就业建议强调实习、工作经验、可迁移技能和毕业后求职路径。正向结果样本通常不是只读完课就等 offer，而是在申请时就考虑课程能否带来实践、签证路径和本地经验。",
      tags: ["澳洲", "就业", "实习", "本地经验"]
    },
    {
      id: "study-undergrad-subject-commitment",
      scenario: "undergrad",
      title: "本科申请更看学科承诺和长期性",
      content: "本科申请里，活动数量不是核心，长期投入、学科相关性和成长轨迹更重要。公开指导反复强调，招生方更容易被稳定的兴趣路径和真实反思打动，而不是堆砌很多零散活动。",
      tags: ["本科", "活动", "长期投入", "学科承诺"]
    },
    {
      id: "study-undergrad-balance",
      scenario: "undergrad",
      title: "本科选校要同时看课程与支持体系",
      content: "本科申请不能只看学校名气，还要看课程结构、国际生支持、生活成本、奖助学金和升学出口。对家庭决策来说，这些因素经常比单一排名更影响最终体验。",
      tags: ["本科", "课程结构", "支持体系", "奖学金"]
    },
    {
      id: "study-undergrad-activities",
      scenario: "undergrad",
      title: "本科活动要围绕主题收束",
      content: "公开本科申请指导反复提醒，活动不必面面俱到，更重要的是围绕一个主题形成连续性：学科兴趣、领导力、服务、创作或竞赛，只要能解释成长脉络，就比堆数量更有说服力。",
      tags: ["本科", "活动", "主题", "连续性"]
    },
    {
      id: "study-business-leadership",
      scenario: "business",
      title: "商科更看领导力、量化和成长轨迹",
      content: "公开商学院招生标准通常会同时看三件事：是否有商业问题意识、是否展现领导力或影响力、以及是否能证明量化能力和成长性。没有正式管理 title 也可以，但要能讲清影响。",
      tags: ["商科", "领导力", "量化", "成长轨迹"]
    },
    {
      id: "study-business-values",
      scenario: "business",
      title: "商科文书更怕空泛成功学",
      content: "公开 MBA / 管理类申请建议很强调真实价值观和未来影响，不喜欢只有套话的成功叙事。比起说想做领导者，更重要的是讲清你为什么在意某类问题、怎么形成判断、未来想创造什么影响。",
      tags: ["商科", "价值观", "影响力", "文书"]
    },
    {
      id: "study-business-career",
      scenario: "business",
      title: "商科正向结果更看职业目标是否清晰",
      content: "商科类正向录取和就业样本往往都有明确职业方向，例如咨询、金融、产品、运营或创业。申请时如果目标模糊，后续不论选校还是实习都会发散，结果也更难稳定。",
      tags: ["商科", "职业目标", "咨询", "金融"]
    },
    {
      id: "study-cs-proof",
      scenario: "cs-data",
      title: "计算机和数据申请更看准备度和技术证据",
      content: "公开 CS 申请要求通常强调准备度：先修课、数学基础、研究兴趣、技术项目和推荐信细节。仅仅写对 AI 感兴趣不够，最好能拿出课程、代码、论文、项目结果或竞赛证明。",
      tags: ["计算机", "数据", "先修课", "技术项目"]
    },
    {
      id: "study-cs-academic-recommendations",
      scenario: "cs-data",
      title: "CS 更依赖学术型推荐信和具体例子",
      content: "公开计算机项目说明里，推荐信通常更看分析能力、独立思考、组织表达和研究潜力，而且越具体越有说服力。相比泛泛夸赞，能写出课程、项目或研究细节的推荐信更值钱。",
      tags: ["计算机", "推荐信", "分析能力", "研究潜力"]
    },
    {
      id: "study-cs-career",
      scenario: "cs-data",
      title: "CS 与数据方向更容易被就业结果反推",
      content: "计算机和数据方向的正向结果样本通常很容易反推：课程是否补足核心能力、项目是否能展示技术深度、地区是否有岗位、实习是否能接上。申请策略可以更直接围绕这些结果变量设计。",
      tags: ["计算机", "数据", "就业", "技术深度"]
    },
    {
      id: "study-education-reflection",
      scenario: "education",
      title: "教育类申请更看实践反思和问题意识",
      content: "教育类项目往往不只是看教学经历本身，更看你如何理解学习者、课堂、制度和教育公平问题。公开申请建议里，能把实践经验转成反思和方法判断的文书更强。",
      tags: ["教育", "教学实践", "反思", "问题意识"]
    },
    {
      id: "study-law-policy-logic",
      scenario: "law-policy",
      title: "法律与公共政策更看逻辑和公共性",
      content: "法政和公共政策类申请通常更在意你如何定义问题、分析利益相关方、理解制度约束并提出路径。相比宏大口号，清晰的问题结构和现实感更重要。",
      tags: ["法律", "公共政策", "逻辑", "问题定义"]
    },
    {
      id: "study-media-portfolio",
      scenario: "media-design",
      title: "传媒与创意方向更看作品和表达风格",
      content: "公开传媒、传播和创意类项目要求常提示作品集、写作样本、视频、项目链接或内容成果的重要性。光说热爱表达不够，最好能拿出你如何表达、影响了谁、形成了什么风格的证据。",
      tags: ["传媒", "作品集", "写作样本", "表达风格"]
    },
    {
      id: "study-media-career",
      scenario: "media-design",
      title: "传媒创意方向更看作品是否能转成机会",
      content: "传媒和创意方向的正向就业结果样本，通常都不是纸面热爱，而是作品、平台、内容生产能力和行业理解已经能对接真实机会。申请时最好把作品和职业方向一起讲清楚。",
      tags: ["传媒", "就业", "作品", "职业方向"]
    },
    {
      id: "study-au-undergrad-structure",
      scenario: "au-undergrad",
      title: "澳洲本科更适合先看学位结构",
      content: "澳洲官方课程介绍会明确学位时长、专业方向和 majors/minors 结构。申请澳洲本科时，不要只看学校排名，要先判断课程结构、专业方向和自己未来计划是否一致。",
      tags: ["澳洲本科", "课程结构", "major", "minor"]
    },
    {
      id: "study-au-masters-types",
      scenario: "au-masters",
      title: "澳洲硕士先分清授课型还是研究型",
      content: "澳洲官方路径里，授课型硕士和研究型硕士的目标完全不同。授课型更偏职业和课程训练，研究型更偏论文和进一步读博。用户如果目标没说清，这一步很容易选错。",
      tags: ["澳洲硕士", "授课型", "研究型", "读博路径"]
    },
    {
      id: "study-au-masters-experience",
      scenario: "au-masters",
      title: "澳洲硕士有时会接受相关工作经验",
      content: "澳洲官方项目介绍会明确，一些硕士除了本科背景，也可能接受显著相关工作经验。对跨专业或背景不完全匹配的人，这意味着项目筛选时要更仔细核对要求，而不是直接放弃。",
      tags: ["澳洲硕士", "工作经验", "项目要求", "转专业"]
    },
    {
      id: "study-phd-fit",
      scenario: "phd",
      title: "博士申请核心是研究契合",
      content: "博士申请更像双向匹配。公开招生标准通常会看研究兴趣是否对口、是否有合适导师、研究计划是否具体、学术训练是否扎实。博士不能按硕士逻辑只看学校层级。",
      tags: ["博士", "导师", "研究计划", "匹配"]
    },
    {
      id: "study-phd-proof",
      scenario: "phd",
      title: "博士材料要证明研究能力",
      content: "博士材料里最能打动人的通常不是泛泛而谈的理想，而是研究问题、方法、写作样本、论文或项目经历，以及推荐人对研究潜力的明确判断。",
      tags: ["博士", "研究能力", "写作样本", "推荐信"]
    },
    {
      id: "study-phd-supervisor",
      scenario: "phd",
      title: "博士要先判断有没有合适导师",
      content: "博士申请最怕先按学校层级冲，再发现研究方向没有真正匹配的导师。公开博士申请经验普遍会先看导师、研究组、方法论和近年课题，再判断这所学校值不值得投。",
      tags: ["博士", "导师", "研究组", "方向匹配"]
    },
    {
      id: "study-au-research-entry",
      scenario: "au-research",
      title: "澳洲研究型项目会看研究训练和导师支持",
      content: "澳洲公开研究型申请要求常明确看研究项目经历、研究计划、是否有导师支持、以及本科或硕士阶段的研究训练比例。研究经历不足时，申请人要先判断自己是否真的适合直接申研究型项目。",
      tags: ["澳洲研究", "导师支持", "研究训练", "研究计划"]
    }
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO knowledge_snippets (id, scenario, title, content, tags_json) VALUES (?, ?, ?, ?, ?)");
  snippets.forEach((item) => stmt.run(item.id, item.scenario, item.title, item.content, JSON.stringify(item.tags)));
}

const db = openDatabase();

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("请求内容太长"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (_error) {
        reject(new Error("请求格式不正确"));
      }
    });
  });
}

function signActivationCode(code) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(String(code || "").trim().toUpperCase()).digest("hex");
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code || "").trim().toUpperCase()).digest("hex");
}

function ensureStudyUserByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const row = db.prepare("SELECT code FROM activation_codes WHERE code = ?").get(normalized);
  if (!row) throw new Error("激活码无效，请检查后重试。");

  const token = signActivationCode(normalized);
  const existing = db.prepare("SELECT * FROM study_users WHERE token = ?").get(token);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare("UPDATE study_users SET last_active_at = ? WHERE token = ?").run(now, token);
    return { token, provider: DEEPSEEK_API_KEY ? "deepseek" : "demo" };
  }

  db.prepare(`
    INSERT INTO study_users (token, code_hash, provider, created_at, last_active_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, hashCode(normalized), DEEPSEEK_API_KEY ? "deepseek" : "demo", now, now);
  return { token, provider: DEEPSEEK_API_KEY ? "deepseek" : "demo" };
}

function verifyActivationToken(token) {
  if (!token) return false;
  return Boolean(db.prepare("SELECT token FROM study_users WHERE token = ?").get(String(token)));
}

function touchUser(token) {
  db.prepare("UPDATE study_users SET last_active_at = ? WHERE token = ?").run(new Date().toISOString(), token);
}

function getStudyHistory(token) {
  return db.prepare("SELECT * FROM study_reports WHERE token = ? ORDER BY timestamp DESC").all(token).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    profile: JSON.parse(row.profile_json),
    report: JSON.parse(row.report_json)
  }));
}

function saveStudyReport(token, profile, report) {
  db.prepare(`
    INSERT INTO study_reports (id, token, timestamp, profile_json, report_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), token, new Date().toLocaleString(), JSON.stringify(profile), JSON.stringify(report));
}

function rankTags(items = [], limit = 6) {
  const counts = new Map();
  items.flat().filter(Boolean).forEach((item) => {
    const key = String(item).trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, limit)
    .map(([label]) => label);
}

function buildStudyProfileSummary(token) {
  const history = getStudyHistory(token);
  if (!history.length) {
    return {
      totalReports: 0,
      favoriteTargets: [],
      recurringRisks: [],
      focusTags: [],
      nextActions: ["先完成 1 次定位报告，再开始建立个人申请档案。"]
    };
  }
  const recent = history.slice(0, 6);
  const reports = recent.map((item) => item.report);
  const profiles = recent.map((item) => item.profile);
  return {
    totalReports: history.length,
    favoriteTargets: rankTags(profiles.map((item) => [item.destination, item.major]), 4),
    recurringRisks: rankTags(reports.map((item) => item.improvements || []), 5),
    focusTags: rankTags([
      ...reports.map((item) => item.tags || []),
      ...reports.map((item) => item.improvements || [])
    ], 6),
    nextActions: reports[0]?.roadmap?.slice(0, 3) || ["先补充目标地区、专业和核心经历。"]
  };
}

function saveStudyProfileSummary(token, summary) {
  db.prepare(`
    INSERT OR REPLACE INTO study_profiles (token, summary_json, updated_at)
    VALUES (?, ?, ?)
  `).run(token, JSON.stringify(summary), new Date().toISOString());
}

function getStudyProfileSummary(token) {
  const row = db.prepare("SELECT * FROM study_profiles WHERE token = ?").get(token);
  if (!row) return buildStudyProfileSummary(token);
  return JSON.parse(row.summary_json);
}

function collectScenarios(profile) {
  const scenarios = new Set(["general"]);
  const gpa = Number(profile.gpa || 0);
  const stageText = `${profile.stage || ""}${profile.educationStage || ""}`;
  const destinationText = String(profile.destination || "");
  const timelineText = String(profile.timeline || "");
  const majorText = String(profile.major || "").toLowerCase();
  const budgetText = String(profile.budget || "");
  const experienceText = String(profile.experience || "");
  if (gpa > 0 && gpa < 84) scenarios.add("low-gpa");
  if (/转|跨专业/.test(`${profile.experience || ""}${profile.major || ""}`)) scenarios.add("transfer");
  if (/控制成本|预算|奖学金|性价比/.test(budgetText)) scenarios.add("budget");
  if (/本科/.test(stageText)) scenarios.add("undergrad");
  if (/博士|phd|doctoral/i.test(stageText)) scenarios.add("phd");
  if (/美国|USA|US/i.test(destinationText)) scenarios.add("us");
  if (/英国|UK/i.test(destinationText)) scenarios.add("uk");
  if (/香港|新加坡|港新/.test(destinationText)) scenarios.add("hk-sg");
  if (/澳大利亚|澳洲|Australia|AU/i.test(destinationText)) scenarios.add("australia");
  if (/6-9|3-6|3 个月|6 个月|尽快|本轮/.test(timelineText)) scenarios.add("late-timeline");
  if (/9-12|12 个月|一年|长期准备/.test(timelineText)) scenarios.add("early-timeline");
  if (/澳大利亚|澳洲|Australia|AU/i.test(destinationText) && /本科/.test(stageText)) scenarios.add("au-undergrad");
  if (/澳大利亚|澳洲|Australia|AU/i.test(destinationText) && /硕士/.test(stageText)) scenarios.add("au-masters");
  if (/澳大利亚|澳洲|Australia|AU/i.test(destinationText) && /博士|phd|doctoral/i.test(stageText)) scenarios.add("au-research");
  if (/商|管理|finance|mba|business|marketing|accounting|economics/.test(majorText)) scenarios.add("business");
  if (/计算机|数据|ai|computer|cs|software|analytics|machine learning|data/.test(majorText)) scenarios.add("cs-data");
  if (/教育|teaching|education|tesol|curriculum/.test(majorText)) scenarios.add("education");
  if (/法律|法学|policy|public policy|governance|law|international relations/.test(majorText)) scenarios.add("law-policy");
  if (/传媒|传播|media|journalism|communication|film|design|creative/.test(majorText)) scenarios.add("media-design");
  scenarios.add("china-pattern");
  scenarios.add("china-case");
  if (/就业|找工作|实习|留用|落地|移民|求职/.test(`${budgetText}${timelineText}${experienceText}`)) scenarios.add("career-oriented");
  return Array.from(scenarios);
}

function getKnowledgeSnippets(profile) {
  const scenarios = collectScenarios(profile);
  const placeholders = scenarios.map(() => "?").join(", ");
  return db.prepare(`SELECT * FROM knowledge_snippets WHERE scenario IN (${placeholders})`).all(...scenarios).map((row) => ({
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags_json)
  })).slice(0, 6);
}

function fallbackAnalysis(profile, userProfile) {
  const target = profile.schoolTier || "高竞争项目";
  const gpa = Number(profile.gpa || 0);
  const fitScore = Math.max(35, Math.min(90, Math.round((gpa > 4.3 ? gpa : gpa * 0.85) + (target.includes("稳健") ? 10 : 0) + (target.includes("顶尖") ? -8 : 0))));
  const distilledInsights = getKnowledgeSnippets(profile);
  return {
    provider: "demo",
    title: fitScore >= 78 ? "背景具备竞争力，但申请结构还需要更稳" : "当前更适合先纠偏，再决定冲刺范围",
    fitScore,
    tags: ["自动档案版", target, profile.major || "专业待定", profile.destination || "地区待定"],
    distilledInsights,
    schoolStrategy: [
      { tier: "冲刺", advice: "保留 2-3 个理想项目，但不要把预算和时间全部压在冲刺档。" },
      { tier: "匹配", advice: "选择 5-7 个课程匹配、先修要求明确、就业资源稳定的项目作为主战场。" },
      { tier: "保底", advice: "准备 2-4 个录取规则透明、语言和 GPA 达标概率高的项目兜底。" }
    ],
    routes: [
      { name: "名校冲刺路线", label: "上限更高", summary: "这条路适合愿意为上限投入更多精力的人，关键不是多投，而是把文书、推荐信和经历包装做到真正能打动项目方。" },
      { name: "稳妥录取路线", label: "更稳", summary: "这条路更适合想先把结果拿稳的人，重点是把课程匹配、申请结构和提交节奏做扎实，而不是在高风险项目上过度消耗。" },
      { name: "就业优先路线", label: "更适合你", summary: "从你现在的背景看，这条路更容易把课程、技能、实习和毕业去向连成一条真正可落地的路径。" }
    ],
    careerPaths: [
      { name: "课程和岗位强匹配路径", label: "结果更直接", summary: "如果你更在意毕业后的落地结果，这条路径通常最直接，因为课程训练和目标岗位要求能更快对上。" },
      { name: "实习与地区资源联动路径", label: "就业更强", summary: "这类路径往往更容易跑出好结果，因为它把项目、城市资源、校友网络和招聘机会放在同一个判断框架里。" },
      { name: "保留长期选择权路径", label: "长期更灵活", summary: "如果你还没完全锁死最终方向，这条路径更适合你，因为它会保留转向、升学或继续深造的空间。" }
    ],
    insights: [
      "当前报告为兜底分析：服务器尚未配置 DEEPSEEK_API_KEY，配置后会生成更细的个性化报告。",
      userProfile?.recurringRisks?.length ? `你最近几次最常出现的风险点是：${userProfile.recurringRisks.slice(0, 2).join("、")}。` : "第一次使用建议先把目标国家、项目层级和核心经历梳理清楚。",
      "选校不能只看排名，必须把专业先修课、经历证据、文书主线和推荐信强度一起判断。"
    ],
    improvements: [
      "把经历整理成 3 条主线：学术能力、专业实践、长期动机。",
      "补充一段能量化的项目成果，例如数据指标、研究方法、作品链接或业务影响。",
      "列出 12-15 个候选项目，逐一核对课程匹配和截止日期。"
    ],
    roadmap: [
      "第 1-2 周：完成目标地区、专业关键词和候选项目清单。",
      "第 3-5 周：整理简历、推荐信素材包和核心经历故事。",
      "第 6-9 周：完成主文书初稿，并针对冲刺/匹配项目做差异化版本。",
      "第 10-12 周：检查材料一致性，提交保底和第一批匹配项目。"
    ],
    premiumLead: "如果你想把这份报告真正变成录取结果，下一步就不该继续自己反复试错，而是把最关键的申请动作交给 1 对 1 服务推进。",
    premiumService: [
      "先把最适合你的主申路线和备选路线定死，不再来回摇摆和浪费申请费。",
      "从选学校、定项目、梳理背景到申请材料，一条龙推进，避免每个环节都自己试。",
      "如果你目标名校、本硕博申请、转专业或背景复杂，1 对 1 往往比单靠自己更容易把结果做出来。"
    ],
    topRecommendation: "系统当前最推荐你先走“就业优先路线”，因为它不是看起来最热闹的路线，但很可能是最容易把结果做扎实、做落地的一条路。",
    upgradeRecommendation: "如果你准备把结果做成名校录取，最值得升级 1 对 1 的通常是“名校冲刺路线”，因为这条路最吃策略、包装和节奏控制，自己做很容易在细节上失分。",
    disclaimer: "本报告是申请策略建议，不代表任何学校的录取承诺。"
  };
}

function buildPrompt(profile, userProfile, snippets) {
  return `
请你担任资深留学申请顾问，基于用户资料生成严肃、具体、可执行的中文申请分析。
你可以参考两类信息：
1. 用户自己的历史档案；
2. 内部知识片段：这些不是照抄原文，而是从公开招生建议、公开申请经验、公开案例总结、机构白皮书趋势中蒸馏出的稳定规律。

要求：
1. 不要承诺录取概率，不要编造具体学校录取数据。
2. 必须结合目标地区、学校档次、GPA/语言/标化、经历、时间线、预算和性格能力测试。
3. 如果有历史档案，请延续用户长期短板，不要把每次报告当第一次。
4. 如果内部知识片段里出现了明显相关的经验模式，要把它转成对这个用户有用的判断，而不是原样复述。
5. 只输出 JSON，不要 Markdown，不要代码块。
6. 语言风格要像经验很强的留学顾问，判断要有框架感、可靠感和决策感，不要像普通 AI 套话。
7. 在“最推荐路线”和“最值得升级 1 对 1 的路线”里，要自然说明为什么进一步申请更适合交给人工一对一推进，但不能虚假承诺。
8. JSON 字段必须是：
{
  "title": "一句话结论",
  "fitScore": 0-100整数,
  "tags": ["4-6个标签"],
  "schoolStrategy": [{"tier":"冲刺/匹配/保底","advice":"具体建议"}],
  "routes": [{"name":"路线名称","label":"更适合你/更稳/上限更高等简短标签","summary":"这条路线适合什么人、核心逻辑是什么"}],
  "careerPaths": [{"name":"就业路径名称","label":"就业更强/结果更直接/长期更灵活等简短标签","summary":"为什么这条路径更值得优先考虑"}],
  "insights": ["4-6条核心判断"],
  "improvements": ["4-6条背景补强建议"],
  "roadmap": ["4条90天行动计划"],
  "premiumLead": "一句升级提示",
  "premiumService": ["3条为什么应该升级 1 对 1 服务的说明"],
  "topRecommendation": "一句系统最推荐路线总结",
  "upgradeRecommendation": "一句最值得升级 1 对 1 的路线总结",
  "disclaimer": "录取不保证说明"
}

用户当前资料：
${JSON.stringify(profile, null, 2)}

历史档案：
${JSON.stringify(userProfile || {}, null, 2)}

内部知识片段：
${JSON.stringify(snippets || [], null, 2)}
`;
}

function safeParseModelJson(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("模型返回格式不正确");
  }
}

async function callDeepSeek(profile, userProfile) {
  const snippets = getKnowledgeSnippets(profile);
  if (!DEEPSEEK_API_KEY) return fallbackAnalysis(profile, userProfile);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: "你是严谨的留学申请策略顾问，只输出符合要求的 JSON。" },
        { role: "user", content: buildPrompt(profile, userProfile, snippets) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      stream: false
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "DeepSeek 请求失败");
  const outputText = payload.choices?.[0]?.message?.content || "";
  return { provider: "deepseek", distilledInsights: snippets, ...safeParseModelJson(outputText) };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, url.pathname);
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: "Forbidden" });
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
  fs.readFile(filePath, (error, data) => {
    if (error) return json(res, 404, { error: "Not found" });
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, provider: DEEPSEEK_API_KEY ? "deepseek" : "demo", storage: "sqlite" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/activate") {
      const body = await parseBody(req);
      const session = ensureStudyUserByCode(body.code);
      json(res, 200, session);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      const token = String(url.searchParams.get("token") || "");
      if (!verifyActivationToken(token)) {
        json(res, 200, { activated: false });
        return;
      }
      touchUser(token);
      json(res, 200, {
        activated: true,
        provider: DEEPSEEK_API_KEY ? "deepseek" : "demo",
        profile: getStudyProfileSummary(token),
        history: getStudyHistory(token).slice(0, 5)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/history") {
      const token = String(url.searchParams.get("token") || "");
      if (!verifyActivationToken(token)) {
        json(res, 403, { error: "请先输入有效激活码。" });
        return;
      }
      json(res, 200, { history: getStudyHistory(token) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const body = await parseBody(req);
      const userToken = String(body.token || "");
      if (!verifyActivationToken(userToken)) {
        json(res, 403, { error: "请先输入有效激活码。" });
        return;
      }
      touchUser(userToken);
      const userProfile = getStudyProfileSummary(userToken);
      const result = await callDeepSeek(body.profile || {}, userProfile);
      saveStudyReport(userToken, body.profile || {}, result);
      const nextProfile = buildStudyProfileSummary(userToken);
      saveStudyProfileSummary(userToken, nextProfile);
      json(res, 200, { ...result, profile: nextProfile, history: getStudyHistory(userToken).slice(0, 5) });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message || "服务暂时不可用" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Liuxuebao running at http://${HOST}:${PORT}`);
  console.log(`Provider: ${DEEPSEEK_API_KEY ? `DeepSeek (${DEEPSEEK_MODEL})` : "demo fallback"}`);
  console.log(`Storage: SQLite at ${DB_PATH}`);
});
