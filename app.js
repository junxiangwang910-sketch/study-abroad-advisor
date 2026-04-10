const quizItems = [
  { key: "research", text: "我愿意长期钻研一个问题，并把过程写成有结构的成果。" },
  { key: "leadership", text: "我经常主动组织同学、团队或社群完成一件事。" },
  { key: "execution", text: "我能稳定推进计划，即使任务比较琐碎也不容易拖延。" },
  { key: "communication", text: "我擅长把自己的想法讲清楚，也愿意主动推进沟通和资源协调。" },
  { key: "adaptability", text: "进入陌生环境时，我能较快建立节奏并处理不确定性。" }
];

const form = document.querySelector("#advisorForm");
const quizGrid = document.querySelector("#quizGrid");
const emptyState = document.querySelector("#emptyState");
const report = document.querySelector("#report");
const fitTitle = document.querySelector("#fitTitle");
const fitScore = document.querySelector("#fitScore");
const scoreMeter = document.querySelector("#scoreMeter");
const tagRow = document.querySelector("#tagRow");
const schoolList = document.querySelector("#schoolList");
const insightList = document.querySelector("#insightList");
const distilledList = document.querySelector("#distilledList");
const routeList = document.querySelector("#routeList");
const careerPathList = document.querySelector("#careerPathList");
const topRouteText = document.querySelector("#topRouteText");
const upgradeRouteText = document.querySelector("#upgradeRouteText");
const actionList = document.querySelector("#actionList");
const timelineList = document.querySelector("#timelineList");
const premiumLead = document.querySelector("#premiumLead");
const premiumList = document.querySelector("#premiumList");
const reportNote = document.querySelector("#reportNote");
const activationCode = document.querySelector("#activationCode");
const activateButton = document.querySelector("#activateButton");
const activationStatus = document.querySelector("#activationStatus");
const submitButton = document.querySelector("#submitButton");
const profileTotalReports = document.querySelector("#profileTotalReports");
const profileFavoriteTargets = document.querySelector("#profileFavoriteTargets");
const profileFocusTags = document.querySelector("#profileFocusTags");
const profileNextActions = document.querySelector("#profileNextActions");

const optionLabels = {
  destination: {
    us: "美国",
    uk: "英国",
    ca: "加拿大",
    au: "澳洲",
    sg: "新加坡 / 香港",
    mixed: "多地区混申"
  },
  schoolTier: {
    elite: "顶尖名校：Top 20 / G5 / 港新头部",
    high: "高竞争：Top 50 / QS 100",
    solid: "稳健提升：Top 100-200",
    practical: "就业导向：排名适中但项目强"
  },
  stage: {
    undergrad: "本科申请",
    master: "硕士申请",
    phd: "博士 / 研究型申请"
  },
  major: {
    business: "商科 / 管理 / 金融",
    cs: "计算机 / 数据 / AI",
    engineering: "工程 / 理科",
    social: "社科 / 教育 / 公共政策",
    art: "艺术 / 设计 / 传媒",
    health: "医学健康 / 生物相关"
  },
  schoolBackground: {
    top: "985 / 211 / 海外强校",
    mid: "双非一本 / 普通海外院校",
    regular: "普通本科 / 转专业背景"
  },
  testScore: {
    none: "暂无",
    average: "有，普通水平",
    strong: "有，较强",
    excellent: "有，很有竞争力"
  },
  timeline: {
    urgent: "3 个月内提交",
    normal: "6-9 个月内提交",
    early: "一年以上准备期"
  },
  budget: {
    tight: "尽量控制成本",
    balanced: "排名与成本平衡",
    flexible: "预算较灵活"
  }
};

function renderQuiz() {
  quizGrid.innerHTML = quizItems.map((item) => `
    <div class="quiz-item">
      <strong>${item.text}</strong>
      <div class="quiz-options" aria-label="${item.text}">
        ${[1, 2, 3, 4, 5].map((value) => `
          <label>
            <input type="radio" name="${item.key}" value="${value}" ${value === 3 ? "checked" : ""}>
            ${value}
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function text(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function value(id) {
  return document.querySelector(`#${id}`).value;
}

function label(id) {
  return optionLabels[id]?.[value(id)] || value(id);
}

function getQuizScores() {
  return quizItems.reduce((scores, item) => {
    scores[item.key] = Number(document.querySelector(`input[name="${item.key}"]:checked`)?.value || 3);
    return scores;
  }, {});
}

function collectProfile() {
  return {
    destination: label("destination"),
    schoolTier: label("schoolTier"),
    stage: label("stage"),
    major: label("major"),
    gpa: value("gpa"),
    schoolBackground: label("schoolBackground"),
    languageScore: value("languageScore"),
    testScore: label("testScore"),
    experience: value("experience"),
    timeline: label("timeline"),
    budget: label("budget"),
    personalityScores: getQuizScores()
  };
}

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "请求失败，请稍后重试。");
  }
  return payload;
}

function token() {
  return window.localStorage.getItem("studypath-token") || "";
}

function setActivated(provider) {
  activationStatus.textContent = provider === "deepseek"
    ? "已激活：大模型分析已开启。"
    : "已激活：当前为演示模式。";
}

function renderProfile(profile) {
  if (!profile) return;
  profileTotalReports.textContent = String(profile.totalReports || 0);
  profileFavoriteTargets.textContent = (profile.favoriteTargets || []).slice(0, 2).join(" / ") || "暂无";
  profileFocusTags.innerHTML = (profile.focusTags || []).map((tag) => `<span class="tag">${text(tag)}</span>`).join("");
  profileNextActions.innerHTML = (profile.nextActions || []).map((item) => `<li>${text(item)}</li>`).join("");
}

async function bootstrap() {
  if (!token()) return;
  const response = await fetch(`/api/bootstrap?token=${encodeURIComponent(token())}`);
  const payload = await response.json();
  if (!payload.activated) return;
  setActivated(payload.provider || window.localStorage.getItem("studypath-provider") || "demo");
  renderProfile(payload.profile);
}

async function activate() {
  const code = activationCode.value.trim();
  if (!code) {
    window.alert("请输入激活码。");
    return;
  }
  activateButton.textContent = "激活中...";
  activateButton.disabled = true;
  try {
    const payload = await api("/api/activate", { code });
    window.localStorage.setItem("studypath-token", payload.token);
    window.localStorage.setItem("studypath-provider", payload.provider);
    setActivated(payload.provider);
    bootstrap().catch(console.error);
  } catch (error) {
    window.alert(error.message);
  } finally {
    activateButton.textContent = "激活";
    activateButton.disabled = false;
  }
}

function renderReport(result) {
  fitTitle.textContent = result.title || "申请策略分析";
  fitScore.textContent = String(Math.round(Number(result.fitScore || 0)));
  scoreMeter.style.width = `${Math.max(0, Math.min(100, Number(result.fitScore || 0)))}%`;

  tagRow.innerHTML = (result.tags || []).map((tag) => `<span class="tag">${text(tag)}</span>`).join("");
  schoolList.innerHTML = (result.schoolStrategy || []).map((item) => `
    <article class="school-card">
      <h4>${text(item.tier)}</h4>
      <p>${text(item.advice)}</p>
    </article>
  `).join("");
  insightList.innerHTML = (result.insights || []).map((item) => `<li>${text(item)}</li>`).join("");
  distilledList.innerHTML = (result.distilledInsights || []).map((item) => `
    <article class="distilled-card">
      <h4>${text(item.title || "蒸馏经验")}</h4>
      <p>${text(item.content || "")}</p>
      <div class="tag-row">${(item.tags || []).slice(0, 4).map((tag) => `<span class="tag">${text(tag)}</span>`).join("")}</div>
    </article>
  `).join("");
  routeList.innerHTML = (result.routes || []).map((item) => `
    <article class="school-card">
      <h4>${text(item.name || "申请路线")}${item.label ? ` <span class="route-badge">${text(item.label)}</span>` : ""}</h4>
      <p>${text(item.summary || "")}</p>
    </article>
  `).join("");
  careerPathList.innerHTML = (result.careerPaths || []).map((item) => `
    <article class="school-card">
      <h4>${text(item.name || "就业路径")}${item.label ? ` <span class="route-badge">${text(item.label)}</span>` : ""}</h4>
      <p>${text(item.summary || "")}</p>
    </article>
  `).join("");
  topRouteText.textContent = result.topRecommendation || "系统会在这里标出最适合你的主路线。";
  upgradeRouteText.textContent = result.upgradeRecommendation || "系统会在这里标出最值得交给人工一对一推进的路线。";
  actionList.innerHTML = (result.improvements || []).map((item) => `<li>${text(item)}</li>`).join("");
  timelineList.innerHTML = (result.roadmap || []).map((item) => `<li>${text(item)}</li>`).join("");
  premiumLead.textContent = result.premiumLead || "如果你想把路线真正做成录取结果，可以升级 1 对 1 服务。";
  premiumList.innerHTML = (result.premiumService || []).map((item) => `<li>${text(item)}</li>`).join("");
  reportNote.textContent = `${result.provider === "deepseek" ? "大模型已生成" : "Demo 模式"} · 已结合公开经验蒸馏库 · ${result.disclaimer || "本报告不代表录取承诺。"}`;
  renderProfile(result.profile);

  emptyState.classList.add("hidden");
  report.classList.remove("hidden");
  report.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function submitReport(event) {
  event.preventDefault();
  if (!token()) {
    window.alert("请先输入有效激活码。测试码：STUDY-DEMO-2026");
    return;
  }

  submitButton.textContent = "正在生成报告...";
  submitButton.classList.add("loading");
  submitButton.disabled = true;
  try {
    const result = await api("/api/analyze", {
      token: token(),
      profile: collectProfile()
    });
    renderReport(result);
  } catch (error) {
    window.alert(error.message);
  } finally {
    submitButton.textContent = "生成留学定位报告";
    submitButton.classList.remove("loading");
    submitButton.disabled = false;
  }
}

renderQuiz();
if (token()) {
  setActivated(window.localStorage.getItem("studypath-provider") || "demo");
}
bootstrap().catch(console.error);
activateButton.addEventListener("click", activate);
form.addEventListener("submit", submitReport);
