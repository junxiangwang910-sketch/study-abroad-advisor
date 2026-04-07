# StudyPath AI

一个独立的留学申请建议网页，支持激活码访问和后端 DeepSeek 大模型分析。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/junxiangwang910-sketch/study-abroad-advisor)

## 本地运行

```bash
npm start
```

然后打开：

```text
http://127.0.0.1:3000
```

## 上线

把这个文件夹单独放进一个 GitHub 仓库，然后在 Render 创建 Web Service。

Render 可以识别 `render.yaml`，也可以手动填写：

- Service Type: Web Service
- Runtime: Node
- Instance Type: Free
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

环境变量：

- `DEEPSEEK_API_KEY`: DeepSeek API Key。没填时会使用 demo 兜底报告。
- `DEEPSEEK_MODEL`: 默认 `deepseek-chat`，也可以改成 `deepseek-reasoner`。
- `ACTIVATION_CODES`: 逗号分隔的激活码，例如 `CODE-001,CODE-002`。
- `SESSION_SECRET`: 用于签发激活码会话，Render 可自动生成。

## 商业化上线前要改

- 根据你的实际价格修改“单次定位报告 / 深度定位报告 / 申请策略包”的价格。
- 在 Render 的 `ACTIVATION_CODES` 里只保留你要出售的激活码；不要长期保留公开测试码。
- 如果要做一次性激活码、用量统计或订单管理，需要再接数据库。
