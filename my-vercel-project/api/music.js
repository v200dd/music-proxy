/**
 * Cloudflare Pages Function (音乐 API 中转代理脚本)
 * 路径: /api/music
 * 功能: 参数转换 -> 获取音乐链接 -> 返回标准格式的JSON
 */

// 目标 API 的基础 URL
const TARGET_API_BASE = 'https://api.cenguigui.cn/api/mg_music/';

// 强制设置 User-Agent，模拟浏览器
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Cloudflare Functions 的入口函数
export async function onRequest(context) {
    try {
        // 获取 URL 搜索参数
        const url = new URL(context.request.url);
        const searchParams = url.searchParams;

        // --- 1. 参数处理与转换 ---

        // 复制所有参数到新的 Map 中进行修改
        const requestParams = new Map();
        for (const [key, value] of searchParams.entries()) {
            requestParams.set(key, value);
        }

        // 强制设置返回格式为 JSON (type=json)
        if (!requestParams.has('type')) {
            requestParams.set('type', 'json');
        }

        // 强制设置音质为最高音质 (br=1)
        if (!requestParams.has('br')) {
            requestParams.set('br', '1');
        }

        // 强制设置 n=1，覆盖用户传入的任何 n 值 (限制只返回一个结果)
        requestParams.set('n', '1');

        // 参数转换：将用户传入的 'name' 参数转换为 API 接受的 'msg'
        if (requestParams.has('name')) {
            requestParams.set('msg', requestParams.get('name'));
            requestParams.delete('name');
        }

        // 重新构建查询字符串
        const queryString = Array.from(requestParams.entries())
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
            
        // 构建完整的转发 URL
        const forwardUrl = TARGET_API_BASE + '?' + queryString;

        // --- 2. Fetch 请求与防盗链设置 ---

        // 使用 Fetch API 代理请求，设置防盗链的头部
        const apiResponse = await fetch(forwardUrl, {
            method: 'GET',
            headers: {
                // 模拟真实浏览器 User-Agent
                'User-Agent': USER_AGENT,
                // Cloudflare Workers/Functions 环境中，通常无需设置 Referer，但如果目标API强制要求，可能需要
                // 'Referer': 'https://www.example.com/' // 如果需要，在此设置
            },
            // 默认 timeout 应该足够，无需像 cURL 一样单独设置
        });

        // --- 3. JSON 解析与格式重构 ---

        // 检查请求是否成功
        if (!apiResponse.ok) {
            // 请求目标 API 失败
            return new Response(JSON.stringify({
                code: 500,
                error_msg: `请求目标API失败: HTTP状态码 ${apiResponse.status}`
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        const apiData = await apiResponse.json();

        // 检查 API 返回的状态码
        if (apiData.code && apiData.code !== 200) {
            // 如果API返回错误，直接转发错误信息
            return new Response(JSON.stringify(apiData), {
                status: 200, // 保持 200 状态码，因为代理本身成功
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        // 获取音乐数据
        const musicData = apiData.data || {};

        // 构建符合标准的 JSON 结构
        const finalResponse = {
            code: apiData.code || 200,
            title: musicData.title || '',
            singer: musicData.singer || '',
            cover: musicData.cover || '',
            link: musicData.link || '',
            // 使用新API返回的music_url字段
            music_url: musicData.music_url || '',
            // 歌词使用新API的lrc_url字段
            lyric: musicData.lrc_url || ''
        };

        // 返回最终重构的 JSON
        return new Response(JSON.stringify(finalResponse), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json; charset=utf-8',
                // 允许跨域访问
                'Access-Control-Allow-Origin': '*' 
            }
        });

    } catch (error) {
        console.error('代理脚本发生错误:', error.message);
        return new Response(JSON.stringify({
            code: 500,
            error_msg: `代理脚本内部错误: ${error.message}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}
