# OmniOps

[English](README.md) | 中文

**OmniOps** 是公司级的 AIOps 智能运维平台，专注于全技术栈的问题快速诊断。

它基于开源的 [DeepSeek Harness](https://deepseek.com) 智能体框架构建——该框架采用**一切皆插件**的架构，由 [Cordis](https://github.com/cordiverse/cordis) 驱动——并在其之上扩展为一套运维诊断工具集。其「技术栈 → 组件 → 诊断技能」三级联动的诊断范围，覆盖数据库死锁、大 Key 检测、GPU 显存/利用率、掉卡检测等场景，帮助工程师快速定位并解决故障。

## 开发者预览

OmniOps 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/luxiu666/OmniOps.git
cd OmniOps
pnpm install
pnpm run build
pnpm dsh web
```

> 想使用「MySQL 慢查询诊断」功能？它需要额外起一个 MCP server 并手动配置接线，详见 [README.mysql-diag.zh.md](README.mysql-diag.zh.md)。

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/luxiu666/OmniOps/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 OmniOps 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="OmniOps 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="OmniOps 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="OmniOps 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
