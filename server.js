const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
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

function parseActivationCodes(raw) {
  return String(raw)
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

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
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (_error) {
        reject(new Error("请求格式不正确"));
      }
    });
  });
}

function signActivationCode(code) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(String(code || "").trim().toUpperCase())
    .digest("hex");
}

function verifyActivationToken(token) {
  const cleanToken = String(token || "");
  return ACTIVATION_CODES.some((code) => {
    const signed = signActivationCode(code);
    return cleanToken.length === signed.length && crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(signed));
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, url.pathname);

  if (!filePath.startsWith(ROOT)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      json(res, 404, { error: "Not found" });
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8" });
    res.end(data);
  });
}

function fallbackAnalysis(profile) {
  const target = profile.schoolTier || "高竞争项目";
  const gpa = Number(profile.gpa || 0);
  const fitScore = Math.max(35, Math.min(90, Math.round((gpa > 4.3 ? gpa : gpa * 23) - (target.includes("顶尖") ? 10 : 0))));
  return {
    provider: "demo",
    title: fitScore >= 78 ? "背景具备竞争力，但需要更强叙事" : "需要降低申请风险并补强核心证据",
    fitScore,
    tags: ["Demo 分析", target, profile.major || "专业待定", profile.destination || "地区待定"],
    schoolStrategy: [
      { tier: "冲刺", advice: "保留 2-3 个理想项目，但不要把预算和时间全部压在冲刺档。" },
      { tier: "匹配", advice: "选择 5-7 个课程匹配、先修要求明确、就业资源稳定的项目作为主战场。" },
      { tier: "保底", advice: "准备 2-4 个录取规则透明、语言和 GPA 达标概率高的项目兜底。" }
    ],
    insights: [
      "当前报告为兜底分析：服务器尚未配置 DEEPSEEK_API_KEY，配置后会生成更细的个性化报告。",
      "选校不能只看排名，必须把专业先修课、经历证据、文书主线和推荐信强度一起判断。",
      "如果目标是高竞争项目，需要把经历写成可验证成果，而不是简单罗列实习和比赛名称。"
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

function buildPrompt(profile) {
  return `
请你担任资深留学申请顾问，基于用户资料生成严肃、具体、可执行的中文申请分析。

要求：
1. 不要承诺录取概率，不要编造具体学校录取数据。
2. 必须结合目标地区、学校档次、GPA/语言/标化、经历、时间线、预算和性格能力测试。
3. 输出 JSON，不要 Markdown，不要代码块。
4. JSON 字段必须是：
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

用户资料：
${JSON.stringify(profile, null, 2)}
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

async function callDeepSeek(profile) {
  if (!DEEPSEEK_API_KEY) return fallbackAnalysis(profile);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content: "你是严谨的留学申请策略顾问，只输出符合要求的 JSON。"
        },
        {
          role: "user",
          content: buildPrompt(profile)
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      stream: false
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "DeepSeek 请求失败");
  }

  const outputText = payload.choices?.[0]?.message?.content || "";
  return { provider: "deepseek", ...safeParseModelJson(outputText) };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, provider: DEEPSEEK_API_KEY ? "deepseek" : "demo" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/activate") {
      const body = await parseBody(req);
      const code = String(body.code || "").trim().toUpperCase();
      if (!ACTIVATION_CODES.includes(code)) {
        json(res, 403, { error: "激活码无效，请检查后重试。" });
        return;
      }
      json(res, 200, { token: signActivationCode(code), provider: DEEPSEEK_API_KEY ? "deepseek" : "demo" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const body = await parseBody(req);
      if (!verifyActivationToken(body.token)) {
        json(res, 403, { error: "请先输入有效激活码。" });
        return;
      }
      const result = await callDeepSeek(body.profile || {});
      json(res, 200, result);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message || "服务暂时不可用" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`StudyPath AI running at http://${HOST}:${PORT}`);
  console.log(`Provider: ${DEEPSEEK_API_KEY ? `DeepSeek (${DEEPSEEK_MODEL})` : "demo fallback"}`);
});
