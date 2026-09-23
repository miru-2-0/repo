// ==MiruExtension==
// @name         无尽资源网
// @version      v0.0.5
// @author       hualiong
// @lang         zh-cn
// @license      MIT
// @icon         https://wujinzy.com/template/ziyuan2/images/logo.jpg
// @package      wujinzy.com
// @type         bangumi
// @webSite      https://wujinzy.com
// @nsfw         false
// ==/MiruExtension==
export default class extends Extension {
  genres = {};

  domains = {
    primary: [
      "api.wujinapi.me"
    ],
    alternate: [
      "wujinzy.com",
      "wujinzy.net",
      "wujinzy.co",
      "wujinzy.cc"
    ],
  };

  dict = new Map([
    ["&nbsp;", " "],
    ["&quot;", '"'],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&amp;", "&"],
    ["&sdot;", "·"],
  ]);

  text(content) {
    if (!content) return "";
    const str =
      [...content.matchAll(/>([^<]+?)</g)]
        .map((m) => m[1])
        .join("")
        .trim() || content;
    return str.replace(/&[a-z]+;/g, (c) => this.dict.get(c) || c);
  }

  async $get(params, count = 2, timeout = 4000) {
    const domains = count > 1 ? this.domains.primary : this.domains.alternate;
    try {
      const list = domains.map((domain) =>
        this.request("/api.php/provide/vod?ac=detail" + params, {
          headers: { "Miru-Url": `https://${domain}` },
        })
      );
      list.push(
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Request timed out!"));
          }, timeout);
        })
      );
      return await Promise.any(list);
    } catch (error) {
      if (count > 1) {
        console.log(`[Retry (${count})]: ${params}`);
        return this.$get(params, count - 1);
      } else {
        throw error;
      }
    }
  }

  async load() {
    const res = await this.$get("&ac=list");
    res.class.forEach((e) => {
      this.genres[e.type_id] = e.type_name;
    });
  }

  async createFilter() {
    const genres = {
      title: "影片类型",
      max: 1,
      min: 0,
      default: "",
      options: this.genres,
    };
    return { genres };
  }

  async latest(page) {
    const res = await this.$get(`&pg=${page}&pagesize=50`); // 注意：本 API 无视 pagesize/limit/ps 参数，服务端恒返回 20 条/页（实测 total=120816 下 pg 翻页正常），故 50 只是目标值
    return res.list.map((e) => ({
      title: e.vod_name,
      url: `${e.vod_id}`,
      cover: e.vod_pic,
      update: e.vod_remarks,
    }));
  }

  // ⚠️ 刻意不实现 search()：无尽资源(wujinzy) 的 MacCMS provide API 对任何带 wd 的请求
  // （即关键词搜索）在主域 api.wujinapi.me 与全部备用域上都直接回 Cloudflare「Just a
  // moment」403 校验页；macapi1-3 采集农场也查不到 wujin 的可用 key，公众号/官网索引均
  // 不开放。关键测了三轮：wd=食尚玩家→403、wd 纯 URL 编码→403、带浏览器 UA/Referer→403，
  // 且 alternate 域名(api.wjzy.me 等)全 404/超时。故客户端里**关键词搜索必然失败**，
  // 与其留一个每次都 try/catch 兜底骗自己的空壳，不如干脆移除，让 Miru 按「无搜索能力」
  // 处理。若日后 wujin 切换到不带 wd 的备用镜像，再按 360zy 模板补回。

  async $genre(page, t) {
    const res = await this.$get(`&t=${t}&pg=${page}`);
    return res.list.map((e) => ({
      title: e.vod_name,
      url: `${e.vod_id}`,
      cover: e.vod_pic,
      update: e.vod_remarks,
    }));
  }

  async detail(id) {
    let desc = "无";
    const anime = (await this.$get(`&ids=${id}`)).list[0] ?? {};
    const blurb = this.text(anime.vod_blurb);
    const content = this.text(anime.vod_content);
    desc = desc.length < blurb?.length ? blurb : desc;
    desc = desc.length < content.length ? content : desc;
    const urls = (anime.vod_play_url ?? "")
      .split("#")
      .filter((e) => e)
      .map((e) => {
        const s = e.split("$");
        return { name: s[0], url: s[1] };
      });
    return {
      title: anime.vod_name,
      cover: anime.vod_pic,
      desc,
      type: anime.type_name,
      director: anime.vod_director,
      writer: anime.vod_writer,
      area: anime.vod_area,
      lang: anime.vod_lang,
      year: anime.vod_year,
      pubdate: anime.vod_pubdate,
      remarks: anime.vod_remarks,
      total: anime.vod_total ? String(anime.vod_total) : anime.vod_serial,
            score: (() => {
        const d = parseFloat(anime.vod_douban_score);
        const v = parseFloat(anime.vod_score);
        if (d > 0) return anime.vod_douban_score;
        if (v > 0) return anime.vod_score;
        return undefined;
      })(),
      actors: anime.vod_actor
        ? anime.vod_actor
            .split(/[/|、,，;；]+/)
            .map((e) => e.trim())
            .filter(Boolean)
        : [],
      episodes: [{ title: this.name, urls }],
    };
  }

  async watch(url) {
    console.log(url);
    return { type: "hls", url };
  }
}