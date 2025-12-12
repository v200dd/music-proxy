/**
 * Cloudflare Workers 音乐 API 代理脚本
 * 功能：参数转换 -> 转发请求到目标 API -> 解析结果 -> 返回标准格式的 JSON
 *
 * 部署步骤：
 * 1. 登录 Cloudflare -> Workers & Pages -> 创建应用 -> 创建 Worker。
 * 2. 将以下代码粘贴到脚本编辑器中。
 * 3. 保存并部署。
 *
 * 访问示例: YOUR_WORKER_URL/?name=周杰伦-晴天
 */

// 目标 API 的基础 URL
const TARGET_API_BASE = 'http://music-proxy.dc1.de5.net/';

// 模拟真实浏览器 User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

/**
 * 主要请求处理函数
 * @param {Request} request 传入的请求对象
 * @returns {Response} 响应对象
 */
async function handleRequest(request) {
    // 检查请求方法，只允许 GET 请求
    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ code: 405, error_msg: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    const url = new URL(request.url);
    const params = url.searchParams; // 获取用户传入的参数

    // --- 1. 参数处理与转换 ---

    // 强制设置返回格式为 JSON (type=json)
    params.set('type', 'json');

    // 强制设置音质为最高音质 (br=1)
    if (!params.has('br')) {
        params.set('br', '1');
    }

    // 强制设置 n=1，覆盖用户传入的任何 n 值 (只返回一条数据)
    params.set('n', '1');

    // 参数转换：将用户传入的 'name' 参数转换为 API 接受的 'msg'
    if (params.has('name')) {
        params.set('msg', params.get('name'));
        params.delete('name');
    }

    // 构建完整的转发 URL
    const forward_url = TARGET_API_BASE + '?' + params.toString();

    // --- 2. 转发请求到目标 API ---
    let apiResponse;
    try {
        apiResponse = await fetch(forward_url, {
            method: 'GET',
            headers: {
                // 设置 User-Agent 模拟浏览器，防止目标 API 拒绝
                'User-Agent': USER_AGENT,
                // **注意:** Workers 的 fetch 默认不会携带请求的 Host/Referer 等，
                // 如果目标 API 有严格的防盗链，可能需要额外设置 Referer 或 Host，
                // 但通常 User-Agent 足够。
            },
            // Workers 的 fetch 默认遵循重定向 (follow: 'follow')
        });
    } catch (e) {
        // 捕获网络错误 (如 DNS 失败等)
        return new Response(JSON.stringify({ code: 500, error_msg: `请求目标API失败: 网络错误 ${e.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    // 检查 HTTP 状态码
    if (!apiResponse.ok) {
        return new Response(JSON.stringify({ code: apiResponse.status, error_msg: `请求目标API失败: HTTP状态码 ${apiResponse.status}` }), {
            status: 500, // 内部服务错误
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    // --- 3. JSON 解析与格式重构 ---
    let api_data;
    try {
        api_data = await apiResponse.json();
    } catch (e) {
        // 捕获 JSON 解析错误
        return new Response(JSON.stringify({ code: 500, error_msg: `解析API响应JSON失败: ${e.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    // 检查 API 自身返回的状态码
    if (api_data.code !== 200) {
        // 如果 API 返回错误，直接转发错误信息
        return new Response(JSON.stringify(api_data), {
            status: 200, // 保持 HTTP 状态码为 200，但 JSON 中包含错误码
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    // 获取音乐数据
    const music_data = api_data.data || {};

    // 构建符合标准的 JSON 结构
    const final_response = {
        code: api_data.code ?? 200,
        title: music_data.title ?? '',
        singer: music_data.singer ?? '',
        cover: music_data.cover ?? '',
        link: music_data.link ?? '',
        // 使用新 API 返回的 music_url 字段
        music_url: music_data.music_url ?? '',
        // 歌词使用新 API 的 lrc_url 字段
        lyric: music_data.lrc_url ?? ''
    };

    // 返回最终重构的 JSON
    return new Response(JSON.stringify(final_response), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // 允许跨域访问
            'Access-Control-Allow-Origin': '*',
        },
    });
}

// Workers 的入口点
export default {
    /**
     * @param {Request} request
     * @param {Env} env
     * @param {ExecutionContext} ctx
     */
    async fetch(request, env, ctx) {
        // 使用 try...catch 确保任何未捕获的错误都能返回一个 500 响应
        try {
            return await handleRequest(request);
        } catch (e) {
            console.error(e);
            return new Response(JSON.stringify({ code: 500, error_msg: `Internal Server Error: ${e.message}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
        }
    }
};
