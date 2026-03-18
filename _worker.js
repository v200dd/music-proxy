export default {
  async fetch(request, env, ctx) {
    // 目标 API 的基础 URL 和 API Key
    const target_api_base = 'https://music-proxy.dc1.de5.net';

    // 解析请求的 URL 和参数
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);

    // --- 1. 强制参数配置 ---
    params.set('plat', 'wy');
    params.set('type', 'json');
    params.set('apiKey', api_key);

    // 参数转换：将用户传入的 'msg' 参数转为 'name'，保持兼容
    if (params.has('msg')) {
      params.set('name', params.get('msg'));
      params.delete('msg');
    }

    // 构建完整的转发 URL
    const forward_url = `${target_api_base}?${params.toString()}`;

    // 准备统一的响应头
    const responseHeaders = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*' // 允许跨域请求
    });

    try {
      // --- 2. 发起请求与防盗链设置 ---
      const fetchResponse = await fetch(forward_url, {
        method: 'GET',
        headers: {
          // 模拟真实浏览器 User-Agent
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // 检查 HTTP 状态码
      if (!fetchResponse.ok) {
        return new Response(JSON.stringify({
          code: 500,
          error_msg: `请求目标API失败: HTTP状态码 ${fetchResponse.status}`
        }), { status: 500, headers: responseHeaders });
      }

      // 尝试解析目标 API 返回的 JSON
      let api_data;
      try {
        api_data = await fetchResponse.json();
      } catch (e) {
        return new Response(JSON.stringify({
          code: 500,
          error_msg: '解析API响应JSON失败: ' + e.message
        }), { status: 500, headers: responseHeaders });
      }

      // --- 3. JSON 解析与格式重构 ---
      // 检查API返回的状态（目标API code=1 为成功）
      if (api_data.code !== 1) {
        return new Response(JSON.stringify({
          code: 500,
          error_msg: api_data.msg || '获取音乐失败'
        }), { status: 200, headers: responseHeaders }); // 这里的 status 也可以视需求改为 500
      }

      // 构建符合标准的 JSON 结构
      const final_response = {
        code: 200, // 统一返回 200 表示代理层成功
        title: api_data.name || '未知歌曲',
        singer: 'v200dd.top小熊官网', // 强制替换歌手名
        cover: 'https://cfimg.200996.xyz/file/1773310148585_logo.png', 
        link: '',
        music_url: api_data.music_url || '',
        lyric: ''
      };

      // 返回最终重构的 JSON
      return new Response(JSON.stringify(final_response), {
        status: 200,
        headers: responseHeaders
      });

    } catch (error) {
      // 捕获网络请求级别的错误（相当于 cURL 初始化或执行失败）
      return new Response(JSON.stringify({
        code: 500,
        error_msg: '代理请求异常: ' + error.message
      }), { status: 500, headers: responseHeaders });
    }
  }
};
