# StudyPath AI

一个独立的留学申请建议网页。

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

- Runtime: Docker
- Dockerfile Path: `./Dockerfile`
- Health Check Path: `/health`
- Environment: `HOST=0.0.0.0`, `PORT=3000`
