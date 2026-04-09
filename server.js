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
  if (gpa > 0 && gpa < 84) scenarios.add("low-gpa");
  if (/转|跨专业/.test(`${profile.experience || ""}${profile.major || ""}`)) scenarios.add("transfer");
  if (/控制成本|预算|奖学金|性价比/.test(profile.budget || "")) scenarios.add("budget");
  if (/本科/.test(stageText)) scenarios.add("undergrad");
  if (/博士|phd|doctoral/i.test(stageText)) scenarios.add("phd");
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
  return {
    provider: "demo",
    title: fitScore >= 78 ? "背景具备竞争力，但申请结构还需要更稳" : "当前更适合先纠偏，再决定冲刺范围",
    fitScore,
    tags: ["自动档案版", target, profile.major || "专业待定", profile.destination || "地区待定"],
    schoolStrategy: [
      { tier: "冲刺", advice: "保留 2-3 个理想项目，但不要把预算和时间全部压在冲刺档。" },
      { tier: "匹配", advice: "选择 5-7 个课程匹配、先修要求明确、就业资源稳定的项目作为主战场。" },
      { tier: "保底", advice: "准备 2-4 个录取规则透明、语言和 GPA 达标概率高的项目兜底。" }
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
    disclaimer: "本报告是申请策略建议，不代表任何学校的录取承诺。"
  };
}

function buildPrompt(profile, userProfile, snippets) {
  return `
请你担任资深留学申请顾问，基于用户资料生成严肃、具体、可执行的中文申请分析。
你可以参考两类信息：
1. 用户自己的历史档案；
2. 内部知识片段：这些不是照抄原文，而是从公开招生建议、公开申请经验、公开案例总结中蒸馏出的稳定规律。

要求：
1. 不要承诺录取概率，不要编造具体学校录取数据。
2. 必须结合目标地区、学校档次、GPA/语言/标化、经历、时间线、预算和性格能力测试。
3. 如果有历史档案，请延续用户长期短板，不要把每次报告当第一次。
4. 如果内部知识片段里出现了明显相关的经验模式，要把它转成对这个用户有用的判断，而不是原样复述。
5. 只输出 JSON，不要 Markdown，不要代码块。
6. JSON 字段必须是：
{
  "title": "一句话结论",
  "fitScore": 0-100整数,
  "tags": ["4-6个标签"],
  "schoolStrategy": [{"tier":"冲刺/匹配/保底","advice":"具体建议"}],
  "insights": ["4-6条核心判断"],
  "improvements": ["4-6条背景补强建议"],
  "roadmap": ["4条90天行动计划"],
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
  return { provider: "deepseek", ...safeParseModelJson(outputText) };
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
