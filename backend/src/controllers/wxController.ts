/**
 * 微信 JS-SDK 签名控制器
 *
 * 功能说明（F-004）：
 * - 提供给前端 wx.config 所需的签名信息（appId/timestamp/nonceStr/signature）
 * - 内部维护 access_token 与 jsapi_ticket 的缓存与刷新
 * - 调用微信开放接口使用 Node 内置 https 模块，避免引入额外依赖
 * - 签名算法：SHA1(jsapi_ticket=xxx&noncestr=xxx&timestamp=xxx&url=xxx)
 *   参数顺序按字段名 ASCII 字典序：jsapi_ticket → noncestr → timestamp → url
 *   （微信官方签名算法要求，详见 https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html）
 *
 * 注意：本控制器依赖环境变量 WX_APPID 与 WX_APP_SECRET。
 *      测试沙箱环境或未配置时，接口返回 503，前端应降级为仅 UA 检测模式。
 */

import { Request, Response } from 'express';
import https from 'https';
import crypto from 'crypto';

// ==================== 环境变量读取 ====================

/**
 * 微信公众号 AppID
 */
const WX_APPID = process.env.WX_APPID || '';

/**
 * 微信公众号 AppSecret
 */
const WX_APP_SECRET = process.env.WX_APP_SECRET || '';

// ==================== 缓存 ====================

interface TokenCache {
  value: string;
  expireAt: number; // 毫秒时间戳
}

let accessTokenCache: TokenCache | null = null;
let jsapiTicketCache: TokenCache | null = null;

// access_token 与 jsapi_ticket 的有效期均为 7200 秒，提前 300 秒刷新避免边界失效
const TOKEN_REFRESH_AHEAD_MS = 300 * 1000;
const TOKEN_TTL_MS = 7200 * 1000;

// ==================== 工具函数 ====================

/**
 * 发起 HTTPS GET 请求并返回 JSON
 *
 * 仅用于调用微信开放接口（api.weixin.qq.com）。
 * @param url 完整的 HTTPS URL
 */
function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`微信接口响应解析失败: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 获取微信 access_token（带缓存）
 *
 * 微信接口：GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=SECRET
 * @returns access_token 字符串
 * @throws 当未配置凭证或微信接口返回错误时抛出
 */
async function getAccessToken(): Promise<string> {
  if (!WX_APPID || !WX_APP_SECRET) {
    throw new Error('未配置 WX_APPID 或 WX_APP_SECRET');
  }

  // 缓存命中
  if (accessTokenCache && Date.now() < accessTokenCache.expireAt) {
    return accessTokenCache.value;
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_APP_SECRET}`;
  const resp = await httpsGet(url);

  if (!resp || resp.errcode) {
    throw new Error(`获取 access_token 失败: ${resp?.errmsg || '未知错误'} (${resp?.errcode || 'N/A'})`);
  }

  accessTokenCache = {
    value: resp.access_token,
    expireAt: Date.now() + TOKEN_TTL_MS - TOKEN_REFRESH_AHEAD_MS,
  };

  // access_token 变更后，jsapi_ticket 也必须重新获取
  jsapiTicketCache = null;
  return accessTokenCache.value;
}

/**
 * 获取微信 jsapi_ticket（带缓存）
 *
 * 微信接口：GET https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=TOKEN&type=jsapi
 * @returns jsapi_ticket 字符串
 */
async function getJsapiTicket(): Promise<string> {
  if (!WX_APPID || !WX_APP_SECRET) {
    throw new Error('未配置 WX_APPID 或 WX_APP_SECRET');
  }

  if (jsapiTicketCache && Date.now() < jsapiTicketCache.expireAt) {
    return jsapiTicketCache.value;
  }

  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${token}&type=jsapi`;
  const resp = await httpsGet(url);

  if (!resp || resp.errcode) {
    throw new Error(`获取 jsapi_ticket 失败: ${resp?.errmsg || '未知错误'} (${resp?.errcode || 'N/A'})`);
  }

  jsapiTicketCache = {
    value: resp.ticket,
    expireAt: Date.now() + TOKEN_TTL_MS - TOKEN_REFRESH_AHEAD_MS,
  };
  return jsapiTicketCache.value;
}

/**
 * 生成 16 位随机字符串（用于 nonceStr）
 */
function generateNonceStr(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * 生成 JS-SDK 签名
 *
 * 算法：SHA1(`jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`)
 *
 * 参数顺序按字段名 ASCII 字典序排列（微信官方签名算法要求）：
 *   jsapi_ticket → noncestr → timestamp → url
 *
 * @param ticket jsapi_ticket
 * @param nonceStr 随机字符串
 * @param timestamp 秒级时间戳
 * @param url 当前页面 URL（前端传入，不含 # 后部分）
 * @returns 40 位十六进制 SHA1 签名
 */
export function generateSignature(
  ticket: string,
  nonceStr: string,
  timestamp: number,
  url: string
): string {
  const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(raw, 'utf8').digest('hex');
}

// ==================== 控制器 ====================

/**
 * 获取 JS-SDK 签名配置
 *
 * 请求方法：GET
 * 请求路径：/api/wx/signature?url=<当前页面 URL>
 *
 * 响应：
 * - 200: { success: true, data: { appId, timestamp, nonceStr, signature } }
 * - 503: { success: false, message: '微信 JS-SDK 未配置' }（未配置环境变量时）
 * - 500: { success: false, message: '获取签名失败' }（调用微信接口失败时）
 */
export async function getSignature(req: Request, res: Response): Promise<void> {
  // 1. 校验 URL 参数（必填）
  const url = req.query.url as string | undefined;
  if (!url) {
    res.status(400).json({
      success: false,
      message: '缺少 url 参数',
    });
    return;
  }

  // 2. 未配置微信凭证时返回 503，前端应降级为仅 UA 检测模式
  if (!WX_APPID || !WX_APP_SECRET) {
    res.status(503).json({
      success: false,
      message: '微信 JS-SDK 未配置，请联系管理员设置 WX_APPID 与 WX_APP_SECRET',
    });
    return;
  }

  try {
    // 3. 获取 jsapi_ticket（带缓存）
    const ticket = await getJsapiTicket();

    // 4. 生成签名
    const nonceStr = generateNonceStr();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature(ticket, nonceStr, timestamp, url);

    res.json({
      success: true,
      data: {
        appId: WX_APPID,
        timestamp,
        nonceStr,
        signature,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '获取微信签名失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
