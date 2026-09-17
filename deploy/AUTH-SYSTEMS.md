# 两套注册系统的位置与切换

两套认证源码共用同一个仓库和业务应用，不复制两套项目。当前线上启用 email 模式。

| 内容 | 位置 |
| --- | --- |
| 新邮箱认证逻辑及邮件模板 | `lib/email-auth/` |
| 新认证接口 | `app/api/auth/[action]/route.ts` |
| 新登录/注册界面 | `app/login/`、`app/register/`、`components/auth/` 等 |
| 旧用户名预览网关源码 | `deploy/legacy-gateway/server.mjs` |
| 应用内新旧认证选择 | `lib/auth.ts`、`lib/email-auth/config.ts` |
| 协調切换和回退工具 | `scripts/email-auth/switch-system.py` |
| 当前上线记录 | `deploy/EMAIL-AUTH-LIVE-2026-09-17.md` |

服务器上的旧网关目录仍为 `/home/ubuntu/nodeust-gateway/`，已经停用。
新系统使用独立数据库、数据库账号和会话。旧账号数据没有导入。

## 现有服务器切换

在 `/home/ubuntu/nodeust` 下执行：

```bash
# 恢复旧系统，保留 HTTPS 及两边的数据
python3 scripts/email-auth/switch-system.py legacy /home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth

# 返回新邮箱认证系统
python3 scripts/email-auth/switch-system.py email /home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth
```

工具一起切换构建、环境配置、代理和网关服务；不要仅改一个环境变量或只回退代码。
旧系统与新系统切换后各显示自己的数据，不会互相合并或清空。

## GitHub 保存什么

Git 保存实现源码、SQL 定义、部署模板、脚本和说明。实际密码、邮件授权码、
账号文件、数据库备份、生产环境文件及构建备份不上传。
受保护的回退包位于 `/home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth/`。
因此 GitHub 可以恢复源码，但只克隆仓库不能恢复私人账号数据或直接完成生产切换；
还需要服务器上的受保护配置和备份。后续更新候选构建时，应保留旧构建和回退包。
