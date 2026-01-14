# SecureNotify C SDK

<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright (c) 2026 KirkyX. All rights reserved. -->

C 语言 SDK，用于访问 SecureNotify API 进行加密推送通知和实时消息传递。

## 特性

- **完整的 API 覆盖**：密钥管理、频道管理、消息发布和实时订阅
- **轻量级**：仅依赖 libcurl 和 pthreads
- **ABI 稳定**：使用 opaque handles 和 C99 标准
- **错误处理**：详细的错误码和错误信息
- **实时推送**：通过 SSE 实现消息实时推送

## 快速开始

### 前置条件

- C99 兼容的编译器 (gcc, clang, MSVC)
- libcurl (>= 7.0)
- pthreads (POSIX 线程)
- CMake >= 3.10 或 Make

### 安装

#### 使用 CMake (推荐)

```bash
cd sdk/c
mkdir build && cd build
cmake ..
make
sudo make install
```

#### 使用 Make

```bash
cd sdk/c
make
sudo make install
```

#### macOS Homebrew

```bash
brew install securenotify
```

### 基本使用示例

```c
#include <securenotify.h>
#include <stdio.h>

int main(void) {
    // 创建错误结构
    securenotify_error_t* error = securenotify_error_new();

    // 创建客户端
    securenotify_client_t* client = securenotify_client_new(
        "https://api.securenotify.dev",
        "your-api-key",
        error
    );

    if (!client) {
        fprintf(stderr, "Failed to create client: %s\n",
                securenotify_error_message(error));
        securenotify_error_free(error);
        return 1;
    }

    // 注册公钥
    const char* public_key = "-----BEGIN PUBLIC KEY-----\n...";
    securenotify_public_key_t* key = securenotify_keys_register(
        client,
        public_key,
        "RSA-4096",
        604800,  // 7天有效期
        error
    );

    if (key) {
        printf("公钥注册成功: %s\n", key->channel_id);
        securenotify_public_key_free(key);
    }

    // 发布消息
    securenotify_message_result_t* result = securenotify_publish_send(
        client,
        "my-channel",
        "Hello, SecureNotify!",
        SECURENOTIFY_PRIORITY_NORMAL,
        "my-sender",
        false,
        error
    );

    if (result) {
        printf("消息已发布: %s\n", result->message_id);
        securenotify_message_result_free(result);
    }

    // 清理资源
    securenotify_client_free(client);
    securenotify_error_free(error);

    return 0;
}
```

### 编译和运行

#### 使用 CMake

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.10)
project(myapp)

find_package(securenotify REQUIRED)
find_package(CURL REQUIRED)

add_executable(myapp main.c)
target_link_libraries(myapp securenotify::securenotify CURL::libcurl)
```

```bash
mkdir build && cd build
cmake .. -DCMAKE_PREFIX_PATH=/usr/local
make
./myapp
```

#### 使用 Make

```bash
gcc -o myapp main.c -I/usr/local/include -L/usr/local/lib -lsecurenotify -lcurl -lpthread
./myapp
```

#### 动态链接

```bash
# 设置库路径
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
./myapp
```

## 实时订阅示例

```c
#include <securenotify.h>
#include <stdio.h>
#include <signal.h>

volatile sig_atomic_t running = 1;

void signal_handler(int sig) {
    (void)sig;
    running = 0;
}

void on_message(const char* channel, const char* message, void* user_data) {
    (void)user_data;
    printf("[%s] %s\n", channel, message);
}

void on_connected(const char* channel, void* user_data) {
    (void)user_data;
    printf("已连接到频道: %s\n", channel);
}

void on_error(int32_t code, const char* message, void* user_data) {
    (void)user_data;
    fprintf(stderr, "错误 [%d]: %s\n", code, message);
}

int main(void) {
    signal(SIGINT, signal_handler);

    securenotify_error_t* error = securenotify_error_new();

    securenotify_client_t* client = securenotify_client_new(
        "https://api.securenotify.dev",
        "your-api-key",
        error
    );

    // 订阅频道
    securenotify_subscription_t* sub = securenotify_subscribe(
        client,
        "my-channel",
        on_message,      // 必需：消息回调
        on_connected,    // 可选：连接回调
        on_error,        // 可选：错误回调
        NULL,            // 可选：心跳回调
        NULL,            // 用户数据
        error
    );

    if (sub) {
        printf("正在等待消息... (按 Ctrl+C 退出)\n");
        while (running) {
            sleep(1);
        }
        securenotify_unsubscribe(sub, error);
    }

    securenotify_client_free(client);
    securenotify_error_free(error);

    return 0;
}
```

## API 参考

### 客户端生命周期

| 函数 | 描述 |
|------|------|
| `securenotify_client_new()` | 创建新客户端 |
| `securenotify_client_free()` | 释放客户端资源 |
| `securenotify_client_get_base_url()` | 获取基础 URL |
| `securenotify_client_get_state()` | 获取连接状态 |

### 密钥管理

| 函数 | 描述 |
|------|------|
| `securenotify_keys_register()` | 注册公钥 |
| `securenotify_keys_get()` | 获取公钥信息 |
| `securenotify_keys_list()` | 列出所有公钥 |
| `securenotify_keys_revoke()` | 撤销公钥 |

### 频道管理

| 函数 | 描述 |
|------|------|
| `securenotify_channels_create()` | 创建频道 |
| `securenotify_channels_get()` | 获取频道信息 |
| `securenotify_channels_list()` | 列出所有频道 |
| `securenotify_channels_delete()` | 删除频道 |

### 消息发布

| 函数 | 描述 |
|------|------|
| `securenotify_publish_send()` | 发布消息 |
| `securenotify_publish_get()` | 获取消息信息 |
| `securenotify_publish_queue_status()` | 获取队列状态 |

### 实时订阅

| 函数 | 描述 |
|------|------|
| `securenotify_subscribe()` | 订阅频道 |
| `securenotify_unsubscribe()` | 取消订阅 |
| `securenotify_subscription_get_status()` | 获取订阅状态 |
| `securenotify_subscription_free()` | 释放订阅资源 |

### API 密钥管理

| 函数 | 描述 |
|------|------|
| `securenotify_api_keys_create()` | 创建 API 密钥 |
| `securenotify_api_keys_list()` | 列出所有 API 密钥 |
| `securenotify_api_keys_revoke()` | 撤销 API 密钥 |

### 错误处理

| 函数 | 描述 |
|------|------|
| `securenotify_error_new()` | 创建错误结构 |
| `securenotify_error_free()` | 释放错误结构 |
| `securenotify_error_set()` | 设置错误信息 |
| `securenotify_error_code()` | 获取错误码 |
| `securenotify_error_message()` | 获取错误消息 |
| `securenotify_error_is_ok()` | 检查是否成功 |
| `securenotify_error_is_network_error()` | 检查是否网络错误 |

### 优先级常量

```c
SECURENOTIFY_PRIORITY_CRITICAL  // 100 - 最高优先级
SECURENOTIFY_PRIORITY_HIGH      // 75
SECURENOTIFY_PRIORITY_NORMAL    // 50 - 默认
SECURENOTIFY_PRIORITY_LOW       // 25
SECURENOTIFY_PRIORITY_BULK      // 0 - 最低优先级
```

## 错误码

| 错误码 | 描述 |
|--------|------|
| `SECURENOTIFY_OK` | 成功 |
| `SECURENOTIFY_ERROR_API` | API 错误 |
| `SECURENOTIFY_ERROR_AUTH_FAILED` | 认证失败 |
| `SECURENOTIFY_ERROR_RATE_LIMIT` | 超过速率限制 |
| `SECURENOTIFY_ERROR_NOT_FOUND` | 资源不存在 |
| `SECURENOTIFY_ERROR_VALIDATION` | 验证错误 |
| `SECURENOTIFY_ERROR_INTERNAL` | 内部服务器错误 |
| `SECURENOTIFY_ERROR_NETWORK` | 网络错误 |
| `SECURENOTIFY_ERROR_TIMEOUT` | 请求超时 |
| `SECURENOTIFY_ERROR_CONNECTION` | 连接错误 |
| `SECURENOTIFY_ERROR_UNKNOWN` | 未知错误 |

## 内存管理

所有返回动态分配内存的函数都需要手动释放：

```c
// 释放顺序：先释放内容，再释放容器
securenotify_message_result_free(result);
securenotify_client_free(client);
securenotify_error_free(error);

// 列表需要释放所有元素
for (size_t i = 0; i < list->count; i++) {
    securenotify_channel_free(list->channels[i]);
}
free(list->channels);
free(list);
```

## 线程安全

SDK 支持多线程使用：

- 每个客户端可以安全地从多个线程使用
- 每个订阅在独立的线程中运行
- 回调函数从订阅线程调用

**注意**：不要在回调函数中调用 `securenotify_subscription_free()`。

## 与 Rust FFI 链接

如果需要使用 Rust UniFFI 生成的库：

```makefile
LDFLAGS = -L./rust/target/release -lsecurenotify -L./lib -lsecurenotify-c -lcurl -lpthread
```

## 示例程序

查看 `example/` 目录获取完整示例：

- `basic_usage.c` - 基本使用示例
- `subscribe_example.c` - 实时订阅示例

运行示例：

```bash
cd example
make
./basic_usage
./subscribe_example
```

## 测试

运行单元测试：

```bash
make tests
./test_client
./test_subscribe
```

或者使用 CMake：

```bash
cd build
cmake .. -DBUILD_TESTING=ON
make
ctest
```

## 平台支持

| 平台 | 状态 | 说明 |
|------|------|------|
| Linux | ✓ 已测试 | gcc, clang |
| macOS | ✓ 已测试 | clang |
| Windows | ✓ 兼容 | MSVC, MinGW |

## 构建配置

### CMake 选项

```bash
cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=ON \
    -DCMAKE_INSTALL_PREFIX=/usr/local
```

### Make 选项

```bash
make CC=clang CFLAGS="-O3 -DNDEBUG" LDFLAGS="-lcurl"
```

## 故障排除

### 编译错误

**"curl/curl.h not found"**
```bash
# Ubuntu/Debian
sudo apt-get install libcurl4-openssl-dev

# macOS
brew install curl

# Windows (vcpkg)
vcpkg install curl
```

**"pthread not found"**
```bash
# 添加链接标志
LDFLAGS += -lpthread
```

### 运行时错误

**"Failed to create client"**
- 检查 API 密钥是否有效
- 检查基础 URL 是否正确

**"Network error"**
- 检查网络连接
- 检查防火墙设置

## 贡献

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/my-feature`)
3. 提交更改 (`git commit -am 'Add some feature'`)
4. 推送到分支 (`git push origin feature/my-feature`)
5. 创建 Pull Request

## 许可证

Apache License 2.0 - 参见 [LICENSE](../../LICENSE) 文件。

## 版本历史

### v0.1.0 (2026-01-14)

- 初始版本
- 完整的 API 客户端功能
- 实时订阅支持
- 错误处理和内存管理
- 单元测试覆盖
