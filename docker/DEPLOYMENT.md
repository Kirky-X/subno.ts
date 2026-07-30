# FunctionGraph 容器镜像部署配置

## 构建镜像

```bash
# 在项目根目录执行
docker build -t securenotify -f docker/Dockerfile .
```

## 华为云 FunctionGraph 部署步骤

1. **推送镜像到 SWR（容器镜像服务）**

   ```bash
   # 登录华为云容器镜像服务
   docker login swr.cn-east-3.myhuaweicloud.com -u <用户名>

   # 标记镜像
   docker tag securenotify:latest swr.cn-east-3.myhuaweicloud.com/<组织名>/securenotify:latest

   # 推送镜像
   docker push swr.cn-east-3.myhuaweicloud.com/<组织名>/securenotify:latest
   ```

2. **创建 FunctionGraph 函数**

   - 进入 [FunctionGraph 控制台](https://console.huaweicloud.com/functiongraph/)
   - 选择"使用容器镜像部署函数"
   - 填写函数信息：
     - 函数名称：`securenotify`
     - 镜像地址：填入上面推送的镜像地址
     - 端口：3000
     - 命令：`node server.js`

3. **配置环境变量**

   在函数配置中添加以下环境变量：
   - `DATABASE_URL` - PostgreSQL 连接字符串（必需）
   - `REDIS_URL` - Redis 连接字符串（必需）
   - `ADMIN_MASTER_KEY` - 管理操作主密钥（必需，生产环境至少 32 字符）
   - `CRON_SECRET` - 定时任务密钥（必需，生产环境至少 32 字符）
   - `NODE_ENV` - production

   > ⚠️ **安全提示**：`ADMIN_MASTER_KEY` 和 `CRON_SECRET` 在生产环境中必须设置为强随机值（至少 32 字符），不得包含 `REPLACE_WITH` 或 `dev-` 前缀，否则服务将拒绝启动。

4. **配置触发器**

   建议配合 APIG 触发器提供 HTTP 访问。

## 注意事项

- 确保数据库（Neon PostgreSQL）和 Redis 服务可公网访问
- 函数默认监听端口为 3000
- 首次冷启动可能需要几秒钟

## 健康检查

服务提供两个健康检查端点，可用于 FunctionGraph 健康检查、K8s 探针或负载均衡流量切换：

- `GET /api/health` - **存活检查（Liveness probe）**：仅验证进程存活，不检查依赖，返回 200。适用于 livenessProbe，避免因依赖抖动导致重启。
- `GET /api/ready` - **就绪检查（Readiness probe）**：检查数据库和 Redis 依赖是否就绪，全部就绪返回 200，任一不可用返回 503。适用于 readinessProbe 和负载均衡流量切换。
