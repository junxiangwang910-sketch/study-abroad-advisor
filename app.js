const quizItems = [
  { key: "research", text: "我愿意长期钻研一个问题，并把过程写成有结构的成果。" },
  { key: "leadership", text: "我经常主动组织同学、团队或社群完成一件事。" },
  { key: "execution", text: "我能稳定推进计划，即使任务比较琐碎也不容易拖延。" },
  { key: "communication", text: "我擅长把自己的想法讲清楚，也愿意主动联系老师或项目方。" },
  { key: "adaptability", text: "进入陌生环境时，我能较快建立节奏并处理不确定性。" }
];

const tierMap = {
  elite: { label: "顶尖名校", threshold: 88, base: -12 },
  high: { label: "高竞争项目", threshold: 84, base: -4 },
  solid: { label: "稳健提升项目", threshold: 80, base: 6 },
  practical: { label: "就业导向项目", threshold: 76, base: 10 }
};

const destinationNotes = {
  us: "美国更看重综合故事、推荐信、活动深度和文书表达，适合做冲刺与匹配组合。",
  uk: "英国更看重院校背景、均分和专业匹配，建议尽早确认课程清单与先修课要求。",
  ca: "加拿大重视学术基础和项目适配，就业导向项目可重点看 coop 或实习资源。",
  au: "澳洲录取相对透明，适合用作稳健选择，同时注意移民、认证和城市成本。",
  sg: "新加坡和香港竞争集中，院校背景、GPA、语言和相关经历都需要尽量完整。",
  mixed: "多地区混申可以分散风险，但文书、材料格式和时间线要拆开管理。"
};

const majorStrategies = {
  business: "商科建议优先补实习、量化经历、商业分析项目和清晰职业目标。",
  cs: "计算机方向建议补代码项目、算法/数据作品、科研或技术实习，作品链接很重要。",
  engineering: "工程理科建议突出课程匹配、实验/科研经历、项目方法和技术深度。",
  social: "社科教育方向建议强化研究问题、社会观察、田野/调研和写作表达。",
  art: "艺术传媒方向建议把作品集、创作方法、个人风格和行业理解放在核心位置。",
  health: "医学健康方向建议突出实验技能、伦理意识、科研参与和专业先修课程。"
};

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
const actionList = document.querySelector("#actionList");
const timelineList = document.querySelector("#timelineList");

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

function value(id) {
  return document.querySelector(`#${id}`).value;
}

function getQuizScores() {
  return quizItems.reduce((scores, item) => {
    scores[item.key] = Number(document.querySelector(`input[name="${item.key}"]:checked`)?.value || 3);
    return scores;
  }, {});
}

function normalizeGpa(raw) {
  const parsed = Number(raw || 0);
  if (parsed <= 4.3) return Math.round((parsed / 4) * 100);
  return parsed;
}

function languagePoints(score) {
  const parsed = Number(score || 0);
  if (parsed >= 100 || parsed >= 7.5) return 10;
  if (parsed >= 92 || parsed >= 7) return 7;
  if (parsed >= 85 || parsed >= 6.5) return 4;
  return -5;
}

function experiencePoints(text) {
  const lower = text.toLowerCase();
  const keywords = ["实习", "科研", "项目", "比赛", "竞赛", "论文", "志愿", "作品", "社团", "intern", "research", "project"];
  const matched = keywords.filter((keyword) => lower.includes(keyword)).length;
  return Math.min(14, matched * 3);
}

function testPoints(level) {
  return { none: -4, average: 3, strong: 8, excellent: 12 }[level] || 0;
}

function backgroundPoints(level) {
  return { top: 9, mid: 2, regular: -4 }[level] || 0;
}

function timelinePoints(level) {
  return { urgent: -6, normal: 3, early: 8 }[level] || 0;
}

function personalityProfile(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const average = sorted.reduce((sum, [, score]) => sum + score, 0) / sorted.length;
  const labels = {
    research: "研究型",
    leadership: "组织领导型",
    execution: "执行稳定型",
    communication: "表达连接型",
    adaptability: "适应探索型"
  };
  const advice = {
    research: "适合强调科研、课程项目和学术问题意识，文书里要写清楚你如何提出问题、验证假设和复盘结果。",
    leadership: "适合突出团队影响力、组织协调和资源整合，建议把活动写成可量化的项目成果。",
    execution: "适合选择课程强度高、就业路径清晰的项目，申请材料要体现稳定产出和时间管理。",
    communication: "适合强调跨文化沟通、客户/用户理解、展示表达和主动 networking 的证据。",
    adaptability: "适合多地区混申或跨专业方向，但需要用课程和项目证明转向不是临时起意。"
  };
  return {
    label: labels[top],
    advice: advice[top],
    points: Math.round((average - 3) * 5)
  };
}

function buildSchools(tier, fit) {
  const selected = tierMap[tier];
  if (fit >= 82) {
    return [
      ["冲刺", `${selected.label} 中最想去的 3-4 个项目`, "可以冲，但要用文书和推荐信讲出非常具体的差异化故事。"],
      ["匹配", "同档次里课程匹配度高、先修课要求明确的 5-6 个项目", "这是录取概率和结果质量的主战场。"],
      ["保底", "排名稍后但就业资源稳定的 2-3 个项目", "不要只按排名选，优先看课程、地理位置和实习资源。"]
    ];
  }
  if (fit >= 65) {
    return [
      ["冲刺", `${selected.label} 的边缘项目 2-3 个`, "冲刺可以保留，但数量不要太多。"],
      ["匹配", "下一档中专业匹配度高的 6-8 个项目", "把申请重心放在能解释清楚匹配度的项目上。"],
      ["保底", "录取规则透明、语言/GPA 达标的 3-4 个项目", "确保至少有结果，不要让申请组合过于冒险。"]
    ];
  }
  return [
    ["冲刺", "少量梦想项目 1-2 个", "除非文书或推荐信特别强，否则不要把主要预算压在这里。"],
    ["匹配", "目标档次下调一档后的 5-7 个项目", "先建立可录取组合，再补充少量冲刺。"],
    ["保底", "课程匹配、费用可控、录取门槛清晰的 4-5 个项目", "当前更重要的是把申请结果做稳。"]
  ];
}

function buildReport(event) {
  event.preventDefault();
  const tier = value("schoolTier");
  const selectedTier = tierMap[tier];
  const gpa = normalizeGpa(value("gpa"));
  const scores = getQuizScores();
  const personality = personalityProfile(scores);
  const expText = value("experience");
  const gpaGap = gpa - selectedTier.threshold;
  const fit = Math.max(18, Math.min(96,
    62 + selectedTier.base + gpaGap * 1.4 + languagePoints(value("languageScore")) +
    testPoints(value("testScore")) + backgroundPoints(value("schoolBackground")) +
    experiencePoints(expText) + timelinePoints(value("timeline")) + personality.points
  ));

  const status = fit >= 82 ? "强匹配，可冲刺" : fit >= 65 ? "有机会，需要优化组合" : "风险偏高，建议降档并补强";
  fitTitle.textContent = status;
  fitScore.textContent = String(Math.round(fit));
  scoreMeter.style.width = `${fit}%`;

  const tags = [
    selectedTier.label,
    personality.label,
    value("budget") === "tight" ? "成本敏感" : value("budget") === "flexible" ? "预算灵活" : "成本排名平衡",
    value("timeline") === "urgent" ? "时间紧张" : value("timeline") === "early" ? "准备期充足" : "常规申请节奏"
  ];
  tagRow.innerHTML = tags.map((tag) => `<span class="tag">${tag}</span>`).join("");

  schoolList.innerHTML = buildSchools(tier, fit).map(([title, target, note]) => `
    <article class="school-card">
      <h4>${title}：${target}</h4>
      <p>${note}</p>
    </article>
  `).join("");

  const insights = [
    `目标地区判断：${destinationNotes[value("destination")]}`,
    `专业策略：${majorStrategies[value("major")]}`,
    `成绩判断：当前 GPA/均分约 ${gpa}，相对 ${selectedTier.label} 的建议线 ${selectedTier.threshold} ${gpa >= selectedTier.threshold ? "有支撑" : "仍有压力"}。`,
    `性格能力画像：${personality.label}。${personality.advice}`
  ];
  insightList.innerHTML = insights.map((item) => `<li>${item}</li>`).join("");

  const actions = [
    gpa < selectedTier.threshold ? "优先补成绩解释：准备排名证明、核心课高分、补充课程或成绩上升趋势说明。" : "成绩已经有基础，文书里要把高分课程和目标专业连接起来。",
    value("languageScore") < 7 && value("languageScore") < 100 ? "语言仍需冲刺，先把总分和小分卡线问题解决，避免后期被条件录取或补材料拖慢。" : "语言基本可用，下一步关注项目是否有小分或口语写作单项要求。",
    expText.length < 40 ? "经历描述偏少，建议马上补一段可量化项目、实习或研究产出。" : "已有经历可以使用，但需要整理成 2-3 条主线：动机、能力证据、未来目标。",
    value("testScore") === "none" ? "如果申请美国商科、理工或高竞争项目，评估是否补 GRE/GMAT；英港新部分项目可把精力转向文书和匹配度。" : "标化可作为加分项，注意不要让备考挤压文书、推荐信和项目筛选时间。"
  ];
  actionList.innerHTML = actions.map((item) => `<li>${item}</li>`).join("");

  const plan = [
    "第 1-2 周：确定国家、专业关键词和 12-15 个候选项目，整理每个项目的先修课、语言、文书和截止日期。",
    "第 3-5 周：把经历重写成 3 条申请主线，并同步联系推荐人，给推荐人准备项目清单和个人素材包。",
    "第 6-9 周：完成主文书初稿、简历和 2-3 个代表性项目描述，针对冲刺/匹配项目做差异化版本。",
    "第 10-12 周：检查材料一致性，完成网申表格、成绩单、语言送分和保底项目提交。"
  ];
  timelineList.innerHTML = plan.map((item) => `<li>${item}</li>`).join("");

  emptyState.classList.add("hidden");
  report.classList.remove("hidden");
  report.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

renderQuiz();
form.addEventListener("submit", buildReport);
