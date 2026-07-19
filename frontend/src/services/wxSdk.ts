/**
 * 微信 JS-SDK 封装服务（F-004）
 *
 * 功能说明：
 * - 动态加载微信 JS-SDK（weixin-js-sdk）脚本，避免在非微信环境加载浪费资源
 * - 调用后端 /api/wx/signature 获取签名配置
 * - 调用 wx.config 注册签名，提供 wx.ready / wx.error 回调
 * - 暴露 initWxSdk(url, jsApiList) 供填写页等业务页面使用
 *
 * 降级策略：
 * - 非微信环境：返回 { ok: false, reason: 'not-wechat' }，业务方应降级为仅 UA 检测
 * - 后端未配置凭证：返回 { ok: false, reason: 'server-not-configured' }
 * - wx.config 失败：返回 { ok: false, reason: 'config-failed', error }
 *
 * 注意：微信 JS-SDK 的实际 SDK 脚本通过动态注入 <script> 标签加载，
 *       无需 npm 安装 weixin-js-sdk 包（避免引入不必要的依赖）。
 */

import { wxApi } from './api';

/** 微信 JS-SDK 官方脚本 URL（固定不变） */
const WX_SDK_SCRIPT_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';

/** wx 全局对象类型（仅声明本服务用到的部分） */
interface WxSdk {
  config(config: {
    debug?: boolean;
    appId: string;
    timestamp: number;
    nonceStr: string;
    signature: string;
    jsApiList: string[];
  }): void;
  ready(callback: () => void): void;
  error(callback: (res: { errMsg: string }) => void): void;
}

declare global {
  interface Window {
    wx?: WxSdk;
  }
}

/** 动态加载脚本 Promise 缓存，避免重复加载 */
let scriptLoadPromise: Promise<void> | null = null;

/**
 * 动态加载微信 JS-SDK 脚本
 *
 * 同一会话只加载一次，重复调用返回缓存的 Promise。
 */
function loadWxSdkScript(): Promise<void> {
  if (window.wx) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WX_SDK_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('加载微信 JS-SDK 脚本失败'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

/** initWxSdk 返回结果 */
export interface WxSdkInitResult {
  ok: boolean;
  reason?: 'not-wechat' | 'server-not-configured' | 'config-failed' | 'script-load-failed';
  error?: string;
}

/**
 * 检测是否在微信环境
 */
export function isWechatEnv(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
}

/**
 * 初始化微信 JS-SDK
 *
 * 调用流程：
 * 1. 检测微信环境（非微信环境直接返回降级结果）
 * 2. 加载微信 JS-SDK 脚本
 * 3. 调用后端 /api/wx/signature 获取签名
 * 4. 调用 wx.config 注册签名
 * 5. 等待 wx.ready / wx.error 回调
 *
 * @param url 当前页面 URL（不含 # 后部分）
 * @param jsApiList 需要使用的 JS 接口列表（如 ['updateAppMessageShareData']）
 */
export async function initWxSdk(
  url: string,
  jsApiList: string[] = []
): Promise<WxSdkInitResult> {
  // 1. 非微信环境降级
  if (!isWechatEnv()) {
    return { ok: false, reason: 'not-wechat' };
  }

  // 2. 加载微信 JS-SDK 脚本
  try {
    await loadWxSdkScript();
  } catch (err: any) {
    return { ok: false, reason: 'script-load-failed', error: err?.message };
  }

  if (!window.wx) {
    return { ok: false, reason: 'script-load-failed', error: 'wx 全局对象未注入' };
  }

  // 3. 获取签名
  let signatureResp: any;
  try {
    const resp = await wxApi.getSignature(url);
    signatureResp = resp.data;
  } catch (err: any) {
    // 后端返回 503 表示未配置凭证，业务方应降级
    if (err?.response?.status === 503) {
      return { ok: false, reason: 'server-not-configured' };
    }
    return { ok: false, reason: 'config-failed', error: err?.message };
  }

  if (!signatureResp?.success || !signatureResp?.data) {
    return { ok: false, reason: 'config-failed', error: '签名接口响应异常' };
  }

  const { appId, timestamp, nonceStr, signature } = signatureResp.data;

  // 4. 调用 wx.config 并等待 ready/error
  return new Promise<WxSdkInitResult>((resolve) => {
    window.wx!.config({ appId, timestamp, nonceStr, signature, jsApiList });
    window.wx!.ready(() => resolve({ ok: true }));
    window.wx!.error((res: { errMsg: string }) => {
      resolve({ ok: false, reason: 'config-failed', error: res.errMsg });
    });
  });
}
