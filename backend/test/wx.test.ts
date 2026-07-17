/**
 * 微信 JS-SDK 签名模块单元测试
 *
 * 测试范围（F-004）：
 * - GET /api/wx/signature  签名接口
 * - generateSignature       签名算法（SHA1）
 *
 * 注意：access_token 与 jsapi_ticket 的获取需调用微信真实接口，
 *       测试沙箱环境无真实公众号凭证（WX_APPID/WX_APP_SECRET 为空），
 *       因此本测试主要覆盖以下场景：
 *       1. 未配置凭证时接口返回 503（核心降级路径）
 *       2. 缺少 url 参数时返回 400
 *       3. generateSignature 算法正确性（使用已知输入验证 SHA1 输出）
 */

import request from 'supertest';
import app from '../src/app';
import { generateSignature } from '../src/controllers/wxController';

// ==================== F-004 签名接口测试 ====================

describe('微信 JS-SDK - GET /api/wx/signature', () => {
  it('F-004 未配置 WX_APPID/WX_APP_SECRET 时应返回 503', async () => {
    // 测试环境默认不设置 WX_APPID/WX_APP_SECRET
    const res = await request(app).get('/api/wx/signature').query({
      url: 'https://example.com/survey/123',
    });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('未配置');
  });

  it('F-004 缺少 url 参数应返回 400', async () => {
    const res = await request(app).get('/api/wx/signature');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('url');
  });

  it('F-004 url 为空字符串应返回 400', async () => {
    const res = await request(app).get('/api/wx/signature').query({ url: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ==================== F-004 签名算法单元测试 ====================

describe('微信 JS-SDK - generateSignature 签名算法', () => {
  it('F-004 应正确计算 SHA1 签名（使用微信官方示例数据）', () => {
    // 微信官方文档示例（https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115）：
    // jsapi_ticket=sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg
    // noncestr=Wm3WZYTPz0wzccnW
    // timestamp=1414587457
    // url=http://mp.weixin.qq.com?params=value
    // 期望签名：0f9de62fce790f9a083d5c99e95740ceb90c27ed
    const ticket = 'sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg';
    const nonceStr = 'Wm3WZYTPz0wzccnW';
    const timestamp = 1414587457;
    const url = 'http://mp.weixin.qq.com?params=value';

    const signature = generateSignature(ticket, nonceStr, timestamp, url);

    expect(signature).toBe('0f9de62fce790f9a083d5c99e95740ceb90c27ed');
  });

  it('F-004 签名长度应为 40 位十六进制字符串', () => {
    const signature = generateSignature('ticket', 'nonce', 1234567890, 'https://example.com');
    expect(signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it('F-004 不同 URL 应产生不同签名', () => {
    const ticket = 'dummy_ticket';
    const nonceStr = 'dummy_nonce';
    const timestamp = 1700000000;
    const sig1 = generateSignature(ticket, nonceStr, timestamp, 'https://a.com');
    const sig2 = generateSignature(ticket, nonceStr, timestamp, 'https://b.com');
    expect(sig1).not.toBe(sig2);
  });

  it('F-004 不同 nonceStr 应产生不同签名', () => {
    const ticket = 'dummy_ticket';
    const timestamp = 1700000000;
    const url = 'https://example.com';
    const sig1 = generateSignature(ticket, 'nonce1', timestamp, url);
    const sig2 = generateSignature(ticket, 'nonce2', timestamp, url);
    expect(sig1).not.toBe(sig2);
  });

  it('F-004 相同输入应产生相同签名（确定性）', () => {
    const ticket = 'dummy_ticket';
    const nonceStr = 'dummy_nonce';
    const timestamp = 1700000000;
    const url = 'https://example.com';
    const sig1 = generateSignature(ticket, nonceStr, timestamp, url);
    const sig2 = generateSignature(ticket, nonceStr, timestamp, url);
    expect(sig1).toBe(sig2);
  });
});
