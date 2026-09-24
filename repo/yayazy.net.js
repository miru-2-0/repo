// ==MiruExtension==
// @name         丫丫资源
// @version      v0.0.5
// @author       jason
// @lang         zh-cn
// @license      MIT
// @icon         https://yayazy3.com/template/yayazy/statics/img/logo.png
// @package      yayazy.net
// @type         bangumi
// @webSite      https://yayazy.net
// @nsfw         false
// ==/MiruExtension==
export default class extends Extension {
  genres = {};

  domains = {
    primary: [
      "cj.yayazy.net",
    ],
    alternate: [
      "cj2.yayazy.net",
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
    const res = await this.$get(`&pg=${page}&pagesize=50`);
    return res.list.map((e) => ({
      title: e.vod_name,
      url: `${e.vod_id}`,
      cover: e.vod_pic,
      update: e.vod_remarks,
    }));
  }

  // 本源的 MacCMS provide API 对任何带 wd 的关键词请求都明文回「暂不支持搜索」
  // （实测 cj.yayazy.net 对 wd=test 返回 18 字节文案而非 JSON；备用域 cj2.yayazy.net
  // 证书已过期、完全连不上），搜索模块在本源不可用，故直接移除。
  
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