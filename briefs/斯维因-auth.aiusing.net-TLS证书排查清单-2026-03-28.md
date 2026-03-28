# 斯维因 — auth.aiusing.net TLS 证书排查清单

> 整理人：斯维因  
> 日期：2026-03-28

---

## 一、排查目标

确认为什么 `auth.aiusing.net` 在工作台联调环境中仍被识别为：
- `CERTIFICATE_VERIFY_FAILED`
- `self-signed certificate`

并修复为可被工作台正常信任访问。

---

## 二、优先排查项

### 1. 服务器实际返回的证书链是否正确
重点确认：
- 是否真的返回了 Let's Encrypt 正式证书
- 是否返回了错误的自签名证书
- 是否缺少中间证书链
- 是否 Caddy 实际加载了错误证书

### 2. 域名解析是否打到了正确服务器
重点确认：
- `auth.aiusing.net` 是否解析到当前部署机
- 是否存在旧 IP / 旧容器 / 旧网关仍在响应
- 是否 DNS 缓存导致请求命中了历史环境

### 3. 容器 / 反向代理配置是否一致
重点确认：
- Caddy 配置是否与当前域名一致
- HTTPS 配置是否仍残留手工证书路径
- 是否存在上游代理或网关再次替换证书

### 4. 证书续签 / 生效状态
重点确认：
- Let's Encrypt 申请是否成功
- 新证书是否已真正挂载并生效
- Caddy 重载后是否仍在提供旧证书

---

## 三、建议核查动作

### A. 直接从外部检查证书
建议核查：
- 浏览器直接访问 `https://auth.aiusing.net`
- 查看证书颁发者、有效期、SAN、完整链
- 使用 `openssl s_client -connect auth.aiusing.net:443 -servername auth.aiusing.net`
  检查真实返回链

### B. 在服务器上核查 Caddy / 容器
建议核查：
- `docker-compose ps`
- `docker-compose logs -f caddy`
- Caddy 实际加载的站点配置
- 证书文件来源与挂载路径

### C. 核查 DNS
建议核查：
- `dig auth.aiusing.net`
- `nslookup auth.aiusing.net`
- 对比目标服务器公网 IP 是否一致

### D. 核查是否被中间代理替换证书
如存在 CDN / 网关 / 反向代理层，需确认：
- 当前最终暴露的 443 入口是谁
- 是 Caddy 直接对外，还是仍经其他层代理

---

## 四、修复完成后的复测顺序

证书问题修复后，按以下顺序重新联调：

1. 访问 `https://auth.aiusing.net/public/keys/jwt_public.pem`
   - 确认 HTTPS 正常且公钥可下载
2. 验证 `/api/auth/verify`
3. 验证 `/api/license/check`
4. 重跑工作台登录闭环
5. 验证首次无缓存场景下的离线验签
6. 重启巴德执行双平台最小冒烟

---

## 五、当前原则

在 TLS/证书问题未解决前：
- 不对 v5.0 做发布准备结论
- 不将当前阻塞误判为工作台接入代码失败
- 优先将其视为认证平台访问链路问题
