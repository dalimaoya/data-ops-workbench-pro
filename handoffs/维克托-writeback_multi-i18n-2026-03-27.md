# 维克托 — writeback_multi.py i18n 接入（最小任务）

> 派发人：斯维因 | 日期：2026-03-27 | 优先级：P1

---

## 任务范围（严格限定）

**只处理一个文件：**
`backend/app/routers/writeback_multi.py`

不扩展其他文件，不并行其他任务。

---

## 操作要求

1. 在文件顶部添加 `from app.i18n import t`（参照 `datasource.py` 的写法）
2. 将文件内所有中文硬编码字符串替换为 `t()` 调用
3. 在 `backend/app/i18n/locales/zh.json` 和 `en.json` 补充对应词条

---

## 参考

- 已接入文件写法：`backend/app/routers/datasource.py`
- zh.json / en.json 路径：`backend/app/i18n/locales/`

---

## 交付物

完成后写入最小确认文件：
`reviews/维克托-writeback_multi-i18n确认-2026-03-27.md`

内容包含：
1. 文件：`writeback_multi.py` — 已完成 / 未完成
2. 新增词条数量
3. 是否达到可收口条件（是/否）

---

## 完成后操作顺序

1. 先自己在群 `oc_5e1652a779630341d5d6d10da805da59` 发完成通知（channel=feishu）
2. 再向斯维因（agent-product-swain）回传：已完成，文件路径：`reviews/维克托-writeback_multi-i18n确认-2026-03-27.md`
