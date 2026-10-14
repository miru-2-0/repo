// ==MiruExtension==
// @name         优质资源库
// @version      v0.0.5
// @author       hualiong
// @lang         zh-cn
// @license      MIT
// @icon         https://1080zyk1.com/favicon.ico
// @package      yzzy.tv
// @type         bangumi
// @webSite      https://yzzy.tv
// @nsfw         false
// ==/MiruExtension==
export default class extends Extension {
  genres = {};

  // 优质高清资源库(1080zyk) 使用自建 JSON 接口 /inc/apijson.php，而非标准 MacCMS 的
  // /api.php/provide/vod。官网 yzzy.tv / hdzyk.com 及备用 1080zyk1.com~1080zyk20.com
  // 全部带 JS 校验 WAF（返回校验页而非 JSON），无法直接采集；请求统一走 api.* 域名。
  domains = {
    primary: [
      "api.1080zyku.com",
      "api.yzzy-api.com",
    ],
    alternate: [
      "api.yyzy-tv.vip",
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

  // 本接口为非标准 MacCMS JSON 路径，故这里单独拼 /inc/apijson.php。
  async $get(params, count = 2, timeout = 4000) {
    const domains = count > 1 ? this.domains.primary : this.domains.alternate;
    try {
      const list = domains.map((domain) =>
        this.request("/inc/apijson.php?ac=detail" + params, {
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
    // 注意：本 API 无视 pagesize/limit，服务端恒返回 20 条/页（实测 limit 恒为 20，
    // pagesize/limit/num 均无效），一页只能拿到 20 条
    const res = await this.$get(`&pg=${page}&pagesize=50`);
    return res.list.map((e) => ({
      title: e.vod_name,
      url: `${e.vod_id}`,
      cover: e.vod_pic,
      update: e.vod_remarks,
    }));
  }

  async search(kw, page, filter) {
    if (!kw && !(filter?.genres?.[0])) {
      return this.latest(page);
    }
    // 注意：本源类型过滤 t 对顶级分类(电影/连续剧/综艺/动漫 = t1~4)返回空，只有叶子分类能筛出
    // 结果；关键词 wd 搜索正常（实测 火影 命中 13 条）。
    const res = await this.$get(`&wd=${kw}&t=${filter?.genres?.[0] ?? ""}&pg=${page}`);
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

  // 片源均为直链 m3u8（cdn.*-play.com / player.*），web 端解析地址 vip.zykbf.com 仅供网页播放器。
  async watch(url) {
    console.log(url);
    return { type: "hls", url };
  }
}
