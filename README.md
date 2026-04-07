# StudyPath AI

一个独立的留学申请建议网页。

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

- Service Type: Static Site
- Runtime: Static
- Build Command: `echo "No build needed"`
- Publish Directory: `.`
