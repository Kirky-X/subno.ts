/**
 * 模块安全加固重构示例
 * 
 * 本文件展示了如何将报告中提到的安全加固建议付诸实践
 */

// ============================================================================
// 示例 1: 使用 WeakMap 实现真正的私有状态
// ============================================================================

/**
 * 原始实现（不安全）：
 * 
 * class RedisClientManager {
 *   private client: RedisClient | null = null;
 *   
 *   getClient() { return this.client; }
 * }
 * 
 * 问题：TypeScript 的 private 只是编译时检查，运行时仍可访问
 */

// ✅ 重构方案：使用 WeakMap
const RedisClientStore = new WeakMap<object, RedisClient | null>();

class SecureRedisClientManager {
  getClient(): RedisClient | null {
    return RedisClientStore.get(this) ?? null;
  }
  
  async setClient(client: RedisClient): Promise<void> {
    RedisClientStore.set(this, client);
  }
  
  // 外部无法直接访问存储的 client
}

// 即使这样也无法访问：const manager = new SecureRedisClientManager();
// const store = Object.getOwnPropertySymbols(manager); // 无效

// ============================================================================
// 示例 2: 使用 Symbol 保护内部属性
// ============================================================================

/**
 * 原始实现：
 * 
 * class SecureNotifyClient {
 *   private _keys: KeyManager;
 *   private _channels: ChannelManager;
 * }
 * 
 * 问题：可以通过 client['_keys'] 访问
 */

// ✅ 重构方案：使用 Symbol
const KeysSymbol = Symbol('SecureNotifyClient.keys');
const ChannelsSymbol = Symbol('SecureNotifyClient.channels');

class SecureSecureNotifyClient {
  [KeysSymbol]: KeyManager;
  [ChannelsSymbol]: ChannelManager;
  
  constructor() {
    this[KeysSymbol] = new KeyManager();
    this[ChannelsSymbol] = new ChannelManager();
  }
  
  get keys(): KeyManager {
    return this[KeysSymbol];
  }
  
  // Symbol 属性不会出现在 for...in 或 Object.keys() 中
  // 提供了一层额外的保护
}

// ============================================================================
// 示例 3: 深度冻结配置对象
// ============================================================================

/**
 * 原始实现：
 * 
 * export const CONFIG = {
 *   API_KEY_MIN_LENGTH: 32,
 *   nested: { value: 42 }
 * } as const;
 * 
 * 问题：嵌套对象仍然可以被修改
 */

// ✅ 重构方案：深度冻结
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = obj[prop as keyof T];
    if (
      typeof value === 'object' && 
      value !== null && 
      !Object.isFrozen(value)
    ) {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}

export const SECURE_CONFIG = deepFreeze({
  API_KEY_MIN_LENGTH: 32,
  API_KEY_MAX_LENGTH: 128,
  nested: {
    value: 42,
    deep: {
      immutable: true
    }
  }
});

// 测试：
// SECURE_CONFIG.API_KEY_MIN_LENGTH = 64; // ❌ TypeError
// SECURE_CONFIG.nested.value = 99;       // ❌ TypeError
// SECURE_CONFIG.nested.deep.immutable = false; // ❌ TypeError

// ============================================================================
// 示例 4: 移除 export * ，明确导出公共 API
// ============================================================================

/**
 * 原始实现（src/lib/utils/index.ts）：
 * 
 * export * from './validation';
 * export * from './error-handler';
 * 
 * 问题：无法控制导出的内容，可能暴露内部实现
 */

// ✅ 重构方案：明确导出
// src/lib/utils/index.ts

// 只导出公共 API
export {
  // 验证函数
  validateApiKeyFormat,
  isValidUUID,
  
  // 类型
  type ApiKeyValidationResult,
  type ValidationResult,
} from './validation';

// 不导出内部 schemas 和配置
// ❌ 不导出：API_KEY_VALIDATION_CONFIG
// ❌ 不导出：channelIdSchema, messageSchema
// ❌ 不导出：UUID_V4_REGEX

// 错误处理 - 只导出必要的
export {
  ErrorCode,
  AppError,
  ErrorHandler,
  errorHandler,
  withErrorHandler,
  
  // 类型
  type StandardErrorResponse,
  type ApiResponse,
} from './error-handler';

// 不导出内部辅助函数
// ❌ 不导出：generateErrorId, createError（已废弃）

// ============================================================================
// 示例 5: 使用闭包保护单例
// ============================================================================

/**
 * 原始实现：
 * 
 * let redisClient: RedisClient | null = null;
 * 
 * export async function getRedisClient() {
 *   if (redisClient) return redisClient;
 *   // ...
 * }
 * 
 * 问题：redisClient 变量可以被外部模块修改
 */

// ✅ 重构方案：IIFE + 闭包
export const RedisClientManager = (() => {
  // 私有变量，只能通过返回的对象访问
  let redisClient: RedisClient | null = null;
  let connectionPromise: Promise<void> | null = null;
  
  const manager = {
    async getClient(): Promise<RedisClient | null> {
      if (redisClient) return redisClient;
      
      if (connectionPromise) {
        await connectionPromise;
        return redisClient;
      }
      
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) return null;
      
      connectionPromise = (async () => {
        const client = createClient({ url: redisUrl });
        await client.connect();
        redisClient = client;
      })();
      
      await connectionPromise;
      return redisClient;
    },
    
    async closeClient(): Promise<void> {
      if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        connectionPromise = null;
      }
    },
    
    // 测试用 - 可以选择不导出
    _resetForTesting(): void {
      if (process.env.NODE_ENV === 'test') {
        redisClient = null;
        connectionPromise = null;
      }
    }
  };
  
  // 冻结管理器，防止修改
  return Object.freeze(manager);
})();

// 使用：
// const client = await RedisClientManager.getClient();
// RedisClientManager.closeClient();

// ============================================================================
// 示例 6: 服务层不直接导出仓储
// ============================================================================

/**
 * 原始实现（src/lib/services/index.ts）：
 * 
 * export { registerService, RegisterService } from './register.service';
 * export { apiKeyRepository, ApiKeyRepository } from '../repositories/api-key.repository';
 * 
 * 问题：混合了服务层和仓储层，破坏分层架构
 */

// ✅ 重构方案：分离导出
// src/lib/services/index.ts
export {
  // 只导出服务
  auditService, AuditService,
  keyRevocationService, KeyRevocationService,
  cleanupService, CleanupService,
  registerService, RegisterService,
  channelService, ChannelService,
  publishService, PublishService,
  subscribeService, SubscribeService,
  
  // 类型
  type AuditAction,
  type RegisterRequest,
  type RegisterResult,
} from './services';

// src/lib/repositories/index.ts （单独的文件）
export {
  publicKeyRepository,
  apiKeyRepository,
  channelRepository,
  revocationConfirmationRepository,
  
  // 如果确实需要导出仓储类
  type PublicKeyRepository,
  type ApiKeyRepository,
} from './repositories';

// 使用时：
// import { registerService } from '@/lib/services';
// import { apiKeyRepository } from '@/lib/repositories'; // 如果需要

// ============================================================================
// 示例 7: 标记 @internal 方法
// ============================================================================

/**
 * 原始实现：
 * 
 * export class RegisterService {
 *   validatePublicKey(publicKey: string): boolean {
 *     // ...
 *   }
 * }
 */

// ✅ 重构方案：添加 JSDoc 和访问修饰符
export class RegisterService {
  /**
   * 注册新的公钥到系统
   * 
   * @param request - 包含公钥和配置的请求对象
   * @param context - 可选的请求上下文（IP、UserAgent）
   * @returns 注册结果，包含频道 ID 和公钥 ID
   * 
   * @example
   * ```typescript
   * const result = await registerService.register({
   *   publicKey: '-----BEGIN PUBLIC KEY-----...',
   *   algorithm: 'RSA-4096'
   * });
   * ```
   */
  async register(
    request: RegisterRequest,
    context?: { ip?: string; userAgent?: string }
  ): Promise<RegisterResult> {
    // 内部调用 validatePublicKey
    if (!this.validatePublicKey(request.publicKey)) {
      return { success: false, error: '无效的公钥格式' };
    }
    // ...
  }
  
  /**
   * @internal
   * 验证公钥格式 - 仅供内部使用
   * 
   * 这个方法可能在未来的版本中更改或移除，
   * 请不要在外部代码中依赖此方法。
   * 
   * @param publicKey - 要验证的公钥
   * @param algorithm - 公钥算法
   * @returns 公钥是否有效
   */
  private validatePublicKey(publicKey: string, algorithm: string): boolean {
    // 验证逻辑...
    return true;
  }
  
  /**
   * @internal
   * 生成频道 ID - 仅供内部使用
   * 
   * @deprecated 将在 v2.0 中移除
   */
  protected generateChannelId(): string {
    return `enc_${crypto.randomBytes(8).toString('hex')}`;
  }
}

// ============================================================================
// 示例 8: 中间件封装
// ============================================================================

/**
 * 原始实现（src/lib/middleware/index.ts）：
 * 
 * export { 
 *   rateLimit, 
 *   createRateLimitedResponse, 
 *   addRateLimitHeaders,
 *   checkRateLimit,
 * } from './rate-limit';
 * 
 * 问题：导出了太多内部辅助函数
 */

// ✅ 重构方案：只导出中间件
// src/lib/middleware/index.ts
export { 
  // 只导出中间件函数本身
  rateLimit 
} from './rate-limit';

export {
  validateApiKey,
  requireApiKey,
} from './api-key';

// 内部函数不导出：
// ❌ createRateLimitedResponse
// ❌ addRateLimitHeaders
// ❌ checkRateLimit
// ❌ createApiKeyValidator

// ============================================================================
// 示例 9: SDK 导出优化
// ============================================================================

/**
 * 原始实现（sdk/typescript/src/index.ts）：
 * 
 * export { HttpClient } from "./utils/http.js";
 * export { withRetry, createRetryableFunction } from "./utils/retry.js";
 * export { SseConnection } from "./utils/connection.js";
 * 
 * 问题：暴露了底层实现细节
 */

// ✅ 重构方案：精简导出
// sdk/typescript/src/index.ts

// 主要客户端
export { 
  SecureNotifyClient, 
  SecureNotifyClientBuilder 
} from "./client.js";

// 类型定义
export type * from "./types/api.js";
export type { RetryConfig } from "./types/errors.js";

// 错误处理
export {
  SecureNotifyError,
  isSecureNotifyError,
} from "./types/errors.js";

// 高级用户可能需要的高级功能（通过子路径导出）
// sdk/typescript/advanced.js
// export { HttpClient } from "./utils/http.js";
// export { SseConnection } from "./utils/connection.js";

// 使用方式：
// 标准用法：import { SecureNotifyClient } from 'securenotify-sdk';
// 高级用法：import { HttpClient } from 'securenotify-sdk/advanced';

// ============================================================================
// 示例 10: 使用私有类字段（TC39 Stage 3）
// ============================================================================

/**
 * 现代 TypeScript 支持真正的私有类字段
 * 使用 # 前缀而不是 private 关键字
 */

export class ModernSecureClient {
  // 真正的私有字段，运行时也无法访问
  #httpClient: HttpClient;
  #apiKey: string;
  #connectionState: 'connected' | 'disconnected' = 'disconnected';
  
  constructor(apiKey: string) {
    this.#apiKey = apiKey;
    this.#httpClient = new HttpClient(apiKey);
  }
  
  get state(): string {
    return this.#connectionState;
  }
  
  // 私有方法也可以这样定义
  #validateConnection(): boolean {
    return this.#httpClient.isConnected();
  }
  
  async connect(): Promise<void> {
    if (this.#validateConnection()) {
      this.#connectionState = 'connected';
    }
  }
}

// 尝试访问会报错：
// const client = new ModernSecureClient('key');
// client.#apiKey;           // ❌ SyntaxError
// client['#apiKey'];        // ❌ undefined
// Object.keys(client);      // 不包含私有字段

// ============================================================================
// 示例 11: 不可变数据结构
// ============================================================================

/**
 * 使用 readonly 和 as const 创建不可变对象
 */

// 配置对象 - 完全不可变
export const IMMUTABLE_CONFIG = {
  api: {
    baseUrl: 'https://api.securenotify.dev',
    version: 'v1',
    timeout: 30000,
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2.0,
  },
} as const;

// 类型也是 readonly 的
type Config = typeof IMMUTABLE_CONFIG;

// 使用 Readonly 工具类型
interface MutableState {
  count: number;
}

type ImmutableState = Readonly<MutableState>;

const state: ImmutableState = { count: 0 };
// state.count = 1; // ❌ TypeScript 错误

// ============================================================================
// 示例 12: 防御性编程 - 输入验证
// ============================================================================

/**
 * 所有公共方法都应该验证输入参数
 */

export class ValidatedService {
  /**
   * 注册公钥时进行严格的输入验证
   */
  async registerPublicKey(params: {
    publicKey: string;
    algorithm: string;
    expiresIn?: number;
  }): Promise<RegisterResult> {
    // 参数存在性检查
    if (!params) {
      throw new ValidationError('缺少请求参数');
    }
    
    // 类型检查
    if (typeof params.publicKey !== 'string') {
      throw new ValidationError('publicKey 必须是字符串');
    }
    
    if (typeof params.algorithm !== 'string') {
      throw new ValidationError('algorithm 必须是字符串');
    }
    
    // 长度检查
    if (params.publicKey.length < 100) {
      throw new ValidationError('公钥太短');
    }
    
    if (params.publicKey.length > 10000) {
      throw new ValidationError('公钥太长');
    }
    
    // 格式检查
    if (!params.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
      throw new ValidationError('无效的公钥格式');
    }
    
    // 枚举值检查
    const validAlgorithms = ['RSA-2048', 'RSA-4096', 'ECC-SECP256K1'];
    if (!validAlgorithms.includes(params.algorithm)) {
      throw new ValidationError(`algorithm 必须是 ${validAlgorithms.join(', ')} 之一`);
    }
    
    // 范围检查
    if (params.expiresIn !== undefined) {
      if (params.expiresIn < 0 || params.expiresIn > 30 * 24 * 60 * 60) {
        throw new ValidationError('expiresIn 必须在 0 到 2592000 之间');
      }
    }
    
    // 通过所有验证后，才执行实际逻辑
    return this.performRegistration(params);
  }
  
  private async performRegistration(params: unknown): Promise<RegisterResult> {
    // 实际注册逻辑...
    return { success: true };
  }
}

// ============================================================================
// 总结
// ============================================================================

/**
 * 关键要点：
 * 
 * 1. 使用 WeakMap/Symbol 实现真正的私有状态
 * 2. 深度冻结配置对象防止篡改
 * 3. 明确导出公共 API，不使用 export *
 * 4. 使用闭包保护单例
 * 5. 分离不同层次的导出（服务层 vs 仓储层）
 * 6. 使用 @internal JSDoc 标记内部方法
 * 7. 使用 TC39 私有类字段（#field）
 * 8. 创建不可变数据结构
 * 9. 对所有输入进行严格验证
 * 10. 最小化公开 API 表面
 */

// 类型定义（仅用于示例）
type RedisClient = any;
type KeyManager = any;
type ChannelManager = any;
type HttpClient = any;
type RegisterRequest = any;
type RegisterResult = any;
type ValidationError = any;
