export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ code: 400, msg: '缺少 name' });
  }

  const api = `https://api.cenguigui.cn/api/mg_music/;

  try {
    const response = await fetch(api);

    const data = await response.json();

    return res.json({
      code: data.code,
      title: data.data?.title,
      singer: data.data?.singer,
      cover: data.data?.cover,
      music_url: data.data?.music_url,
      lyric: data.data?.lrc_url,
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
}

