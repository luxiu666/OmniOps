---
name: mysql-slow-query-analysis
description: 用于分析 MySQL 慢查询。当用户要排查慢 SQL、分析执行计划、检查表结构/索引、定位数据库性能瓶颈时使用。
---

# MySQL 慢查询分析

## 目标
帮助用户定位 MySQL 慢查询的根因并给出优化建议。

## 输入
从用户消息中提取：host（ip）、port、分析时间段（起止时间）。
user / password / 慢日志目录 / pt-query-digest 路径都从环境变量（配置）读取；库名从报告的 `# Databases` 字段读取。不要向用户索取密码。

## 排查步骤
1. 调 `list_slow_queries`（传 slowLogDir + since/until + limit）用 pt-query-digest 分析慢日志目录（自动按时间段挑文件并复制到临时目录），找出 Top SQL；
2. 对每条候选慢 SQL 调 `explain_query`（传 connection{host,port} + sql + database，database 取报告该 Query 的 `# Databases` 字段）看执行计划；
3. 调 `inspect_schema`（传 connection{host,port} + table + database，database 同样取 `# Databases` 字段）看表结构、索引定义与基数、数据量；
4. 归因：缺索引 / 索引失效 / 数据量大 / 锁等待 / 排序临时表；
5. 给可执行建议（加索引、改写 SQL、调参）并说明预期收益。

## 判定标准
- type=ALL → 全表扫描，通常需加索引
- key 为 NULL 且 rows 很大 → 未走索引
- rows_examined 远大于 rows_sent → 过滤性差
- Extra 含 Using filesort / Using temporary → 排序/临时表开销大
- 索引列基数过低 → 选择性差，索引收益有限

## 输出格式
1. 慢查询清单（TopN：耗时 / 次数 / 扫描行数 / SQL）
2. 根因分析（逐条说明为什么慢）
3. 优化建议（按优先级，含具体 SQL / 建索引语句）
4. 预期收益（估算）
