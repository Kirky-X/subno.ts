# SecureNotify Python SDK

![Python Version](https://img.shields.io/pypi/pyversions/securenotify-sdk)
![License](https://img.shields.io/pypi/license/securenotify-sdk)
![Version](https://img.shields.io/pypi/v/securenotify-sdk)

SecureNotify Python SDK - 用于加密推送通知服务的异步客户端库。

## 特性

- 异步/同步双模式支持
- 自动重试与指数退避
- 实时消息订阅 (SSE)
- 类型安全的 API
- 完整的中文文档

## 安装

```bash
pip install securenotify-sdk
```

## 快速开始

### 异步使用

```python
import asyncio
from securenotify import SecureNotifyClient
from securenotify.types.api import ChannelType

async def main():
    async with SecureNotifyClient(
        base_url="http://localhost:3000",
        api_key="your-api-key"
    ) as client:
        # 创建频道
        channel = await client.channels.create(
            name="my-channel",
            channel_type=ChannelType.ENCRYPTED,
            description="My secure channel"
        )
        print(f"Created channel: {channel.channel_id}")

        # 注册公钥
        key = await client.keys.register(
            public_key="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
            algorithm="RSA-4096"
        )
        print(f"Registered key: {key.key_id}")

        # 发送消息
        result = await client.publish.send(
            channel="my-channel",
            message="Hello, Secure World!"
        )
        print(f"Message sent: {result.message_id}")

        # 订阅实时消息
        async def handle_message(msg):
            print(f"Received: {msg}")

        await client.subscribe.subscribe(
            channel="my-channel",
            handler=handle_message
        )

        # 保持连接
        await asyncio.Event().wait()

asyncio.run(main())
```

### 同步使用

```python
from securenotify import SecureNotifyClient
from securenotify.types.api import ChannelType

with SecureNotifyClient(
    base_url="http://localhost:3000",
    api_key="your-api-key"
) as client:
    # 创建频道
    channel = client.channels.create(
        name="my-channel",
        channel_type=ChannelType.ENCRYPTED
    )
    print(f"Created channel: {channel.channel_id}")

    # 发送消息
    result = client.publish.send(
        channel="my-channel",
        message="Hello, Sync World!"
    )
    print(f"Message sent: {result.message_id}")
```

## API 参考

### SecureNotifyClient

主客户端类，提供所有功能的入口。

#### 初始化参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| base_url | str | 必需 | API 服务器地址 |
| api_key | str | 必需 | API 密钥 |
| timeout | float | 30.0 | HTTP 请求超时（秒） |
| verify | bool | True | 是否验证 SSL 证书 |
| retry_config | RetryConfig | None | 重试配置 |
| heartbeat_interval | float | 30.0 | SSE 心跳间隔（秒） |
| sse_timeout | float | 60.0 | SSE 连接超时（秒） |

### 管理器

#### keys - 密钥管理

```python
# 注册公钥
key = await client.keys.register(
    public_key="-----BEGIN PUBLIC KEY-----...",
    algorithm="RSA-4096",  # 或 "ECC-SECP256K1"
    expires_in=604800  # 7天（可选）
)

# 获取公钥信息
key_info = await client.keys.get(key_id)

# 列出所有公钥
keys = await client.keys.list()

# 撤销公钥
await client.keys.revoke(key_id, reason="Key compromised")
```

#### channels - 频道管理

```python
# 创建频道
channel = await client.channels.create(
    name="my-channel",
    channel_type=ChannelType.ENCRYPTED,  # PUBLIC, ENCRYPTED, TEMPORARY
    description="Channel description",
    ttl=86400  # 24小时（可选）
)

# 获取频道信息
channel_info = await client.channels.get(channel_id)

# 列出所有频道
channels = await client.channels.list()
```

#### publish - 消息发布

```python
# 发送消息（普通优先级）
result = await client.publish.send(
    channel="my-channel",
    message="Hello, World!"
)

# 发送高优先级消息
await client.publish.send_high(
    channel="my-channel",
    message="Urgent!"
)

# 发送关键消息
await client.publish.send_critical(
    channel="my-channel",
    message="Critical Alert!"
)

# 发送批量消息
await client.publish.send_bulk(
    channel="my-channel",
    message="Bulk notification"
)

# 获取队列状态
status = await client.publish.get_queue_status(channel_id)
```

#### subscribe - 实时订阅

```python
# 订阅频道
async def handle_message(msg):
    print(f"Received: {msg}")

await client.subscribe.subscribe(
    channel="my-channel",
    handler=handle_message
)

# 取消订阅
await client.subscribe.unsubscribe("my-channel")

# 取消所有订阅
await client.subscribe.unsubscribe_all()
```

#### apikeys - API 密钥管理

```python
# 创建 API 密钥
api_key = await client.apikeys.create(
    name="My API Key",
    permissions=["publish", "subscribe"],
    expires_in=2592000  # 30天（可选）
)
print(f"API Key: {api_key.key}")  # 注意：这是唯一一次可以看到完整密钥

# 获取 API 密钥信息
key_info = await client.apikeys.get(key_id)

# 列出所有 API 密钥
keys = await client.apikeys.list()

# 撤销 API 密钥
await client.apikeys.revoke(key_id)
```

## 错误处理

```python
from securenotify import SecureNotifyClient
from securenotify.types.errors import (
    SecureNotifyError,
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
    SecureNotifyAuthenticationError,
    SecureNotifyRateLimitError,
)

async def safe_example():
    try:
        async with SecureNotifyClient(
            base_url="http://localhost:3000",
            api_key="your-api-key"
        ) as client:
            await client.publish.send(
                channel="my-channel",
                message="test"
            )
    except SecureNotifyAuthenticationError:
        print("Invalid API key")
    except SecureNotifyRateLimitError as e:
        print(f"Rate limited. Retry after: {e.retry_after}s")
    except SecureNotifyTimeoutError:
        print("Request timed out")
    except SecureNotifyConnectionError:
        print("Connection failed")
    except SecureNotifyApiError as e:
        print(f"API Error: {e.message} (code: {e.error_code})")
    except SecureNotifyError as e:
        print(f"Error: {e.message}")
```

## 消息优先级

| 优先级 | 值 | 说明 |
|--------|-----|------|
| CRITICAL | 100 | 关键消息，立即传递 |
| HIGH | 75 | 高优先级 |
| NORMAL | 50 | 普通（默认） |
| LOW | 25 | 低优先级 |
| BULK | 0 | 批量消息 |

## 频道类型

| 类型 | 说明 |
|------|------|
| PUBLIC | 公开频道 |
| ENCRYPTED | 加密频道（默认） |
| TEMPORARY | 临时频道，自动过期 |

## 高级配置

### 自定义重试策略

```python
from securenotify import SecureNotifyClient
from securenotify.utils.retry import RetryConfig

retry_config = RetryConfig(
    max_retries=5,
    initial_delay=2.0,
    max_delay=60.0,
    backoff_multiplier=2.0,
    jitter=True
)

client = SecureNotifyClient(
    base_url="http://localhost:3000",
    api_key="your-api-key",
    retry_config=retry_config
)
```

### SSE 订阅配置

```python
client = SecureNotifyClient(
    base_url="http://localhost:3000",
    api_key="your-api-key",
    heartbeat_interval=60.0,  # 心跳间隔 60 秒
    sse_timeout=120.0  # SSE 超时 120 秒
)

# 配置自动重连
client.subscribe.set_reconnect_config(
    reconnect_delay=5.0,
    max_attempts=20
)
```

### 性能优化配置

```python
from securenotify import SecureNotifyClient

# 启用客户端速率限制（防止 API 滥用）
client = SecureNotifyClient(
    base_url="http://localhost:3000",
    api_key="your-api-key",
    enable_rate_limit=True  # 默认启用
)

# 启用性能监控（追踪请求延迟和成功率）
client = SecureNotifyClient(
    base_url="http://localhost:3000",
    api_key="your-api-key",
    enable_metrics=True
)

# 启用响应缓存（减少冗余 GET 请求）
client = SecureNotifyClient(
    base_url="http://localhost:3000",
    api_key="your-api-key",
    enable_cache=True
)

# 获取性能指标
if enable_metrics:
    summary = client.http._metrics_collector.get_summary()
    print(f"Total requests: {summary['total_requests']}")
    print(f"Success rate: {summary['success_rate']*100:.1f}%")
    print(f"Average latency: {summary['endpoint_stats'].get('/api/publish', {}).get('avg_duration_ms', 0):.2f}ms")

# 清理缓存
if enable_cache:
    client.http.clear_cache()
    client.http.cleanup_cache()
```

### 安全配置

```python
from securenotify import SecureNotifyClient

# SDK 自动强制执行以下安全措施：
# - SSL/TLS 验证始终启用（无法禁用）
# - 重定向限制为最多 5 次（防止 SSRF）
# - 频道 ID 格式验证（只允许字母数字、连字符和下划线）
# - 错误消息敏感数据脱敏

# 所有配置都是安全的，无需额外设置
client = SecureNotifyClient(
    base_url="https://api.securenotify.dev",  # 使用 HTTPS
    api_key="your-api-key"
)
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/subno-ts/subno.ts.git
cd subno.ts/sdk/python

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
.\venv\Scripts\activate  # Windows

# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 运行测试（带覆盖率）
pytest --cov=securenotify --cov-report=html
```

## 许可证

Apache License 2.0

## 相关链接

- [项目主页](https://github.com/subno-ts/subno.ts)
- [API 文档](https://github.com/subno-ts/subno.ts/blob/main/docs/API_REFERENCE.md)
- [用户指南](https://github.com/subno-ts/subno.ts/blob/main/docs/USER_GUIDE.md)
