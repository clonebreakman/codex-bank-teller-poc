# 成果网站

这是 Codex + Computer Use 银行智能柜面 PoC 的离线成果展厅。

## 本地预览

在仓库根目录运行：

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory docs
```

然后打开：`http://127.0.0.1:4173/site/index.html`。

网站只使用静态 HTML、CSS 和浏览器本地 JavaScript，不调用外部 API，不连接真实银行系统。页面中的测试数字来自最新本地验证，审批区域会明确显示阶段 B 尚未完成签署。
