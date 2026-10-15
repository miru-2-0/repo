// ==MiruExtension==
// @name         SuperCartoons
// @version      v0.1.1
// @author       bachig26
// @lang         en
// @license      MIT
// @package      supercartoons.net
// @type         bangumi
// @icon         https://www.supercartoons.net/wp-content/themes/supercartoons/favicon.png
// @webSite      https://www.supercartoons.net
// @nsfw         false
// ==/MiruExtension==
// 关于站点结构（WordPress + JW Player）：
//   列表卡片在首页、搜索页、系列页三处结构完全一致，统一是
//     <div class="item ..."> > article > .image-holder > a[href] + img[src]
//     > .entry-title > a > h3.title
//   每页固定 24 条，翻页地址各不相同：
//     首页      /                      与 /?paged=N
//     搜索页    /?s=..&search=Search   与 &paged=N
//     系列页    /serie/<slug>/         与 /serie/<slug>/page/N/
//   搜索的多词必须用 + 分隔：实测 tom+and+jerry 有 24 条，tom%20and%20jerry 是 0 条。
//   每篇文章只挂一个 JW Player，file 即 https://ww.supercartoons.net/... 的直接 mp4，
//   实测不需要 Referer（直接 Range 请求返回 206 video/mp4）。
//   注意：这里不能再像旧版那样一律返回 hls，站点给的就是 mp4，类型标错会播不出来。
export default class extends Extension {
  // 站点唯一的分类体系就是这些系列，取自 /serie/series/（实测共 10 个）
  series = {
    disney: "Disney",
    "duck-dodgers": "Duck Dodgers",
    "looney-tunes": "Looney Tunes",
    "merrie-melodies": "Merrie Melodies",
    "popeye-the-sailor": "Popeye the Sailor",
    "the-looney-tunes-show": "The Looney Tunes Show",
    "the-pink-panther-show": "The Pink Panther Show",
    "the-tom-and-jerry-show": "The Tom and Jerry Show",
    "tom-and-jerry": "Tom and Jerry",
    "tom-and-jerry-tales": "Tom and Jerry Tales",
  };

  // 分类只写在 <article class="... videos_categories-<slug>"> 里，页面没有分类链接，
  // 所以先查上面的表，表里没有再把 slug 首字母大写兜底。
  $label(slug) {
    return (
      this.series[slug] ??
      slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );
  }

  // 三类列表页共用同一套卡片，统一在这里解析
  async $parse(path) {
    const res = await this.request(path);
    const items = await this.querySelectorAll(res, "div.item.col-lg-3");
    const list = [];
    for (const item of items) {
      const html = await item.content;
      list.push({
        title: (await this.querySelector(html, "h3.title").text).trim(),
        url: await this.getAttributeText(html, ".image-holder a", "href"),
        cover: await this.getAttributeText(html, ".image-holder img", "src"),
      });
    }
    return list;
  }

  // 站点偶发 521（源站抽风）时只回一个空 body，而 Miru 的 request 只把 body 交给扩展、
  // 不暴露状态码，于是整页会凭空变成空列表、Miru 直接判定"已到底"而停止翻页。
  // 这里对空结果重试一次，代价只是最后一页多打一次请求。
  async $cards(path) {
    const list = await this.$parse(path);
    return list.length ? list : this.$parse(path);
  }

  async latest(page) {
    return this.$cards(page > 1 ? `/?paged=${page}` : "/");
  }

  async createFilter() {
    return {
      series: {
        title: "Series",
        max: 1,
        min: 0,
        default: "",
        options: this.series,
      },
    };
  }

  async search(kw, page, filter) {
    const serie = filter?.series?.[0];
    if (serie) {
      if (kw) throw new Error("在使用筛选器时无法同时使用搜索功能！");
      return this.$cards(
        page > 1 ? `/serie/${serie}/page/${page}/` : `/serie/${serie}/`
      );
    }
    if (!kw) return this.latest(page);
    const term = encodeURIComponent(kw).replace(/%20/g, "+");
    return this.$cards(
      page > 1
        ? `/?s=${term}&search=Search&paged=${page}`
        : `/?s=${term}&search=Search`
    );
  }

  async detail(url) {
    const load = () =>
      this.request("", {
        headers: { "Miru-Url": url },
      });
    let res = await load();
    // 全文里只有这一个 JW Player 实例，file 就是直链。
    // 同 $cards：源站抽风时只会回空 body，此时不能误判成"结构变更"，先重试一次。
    let file = (res.match(/file:\s*"([^"]+)"/) ?? [])[1] ?? "";
    if (!file) {
      res = await load();
      file = (res.match(/file:\s*"([^"]+)"/) ?? [])[1] ?? "";
    }
    if (!file) throw new Error("未找到播放地址，站点结构可能已变更");

    const title = (await this.querySelector(res, "h1.post-title").text).trim();
    const cover = await this.getAttributeText(
      res,
      "meta[property='og:image']",
      "content"
    );
    // 站内简介是 post-content 里的第一段，og:description 是它的截断版，留作兜底。
    const desc =
      (await this.querySelector(res, "div.post-content > p").text) ||
      (await this.getAttributeText(res, "meta[property='og:description']", "content"));
    const slug = (res.match(/videos_categories-([a-z0-9-]+)/) ?? [])[1] ?? "";
    // 标签这里刻意不走 querySelectorAll：Miru 的 .text 会拿「元素自身的片段」去重新
    // 匹配原来的完整选择器，ul.single-video-tags a[rel=tag] 这种带祖先的选择器必然落空，
    // 只会静默返回空串，所以直接正则取名字。
    const tagBlock = (res.match(/<ul class="single-video-tags">[\s\S]*?<\/ul>/) ?? [""])[0];
    const tags = [...tagBlock.matchAll(/rel="tag">([^<]*)</g)].map((m) => m[1]);

    return {
      title,
      cover,
      desc,
      type: this.$label(slug),
      tags,
      episodes: [
        {
          title: this.name,
          urls: [{ name: title, url: file }],
        },
      ],
    };
  }

  async watch(url) {
    return { type: url.includes(".m3u8") ? "hls" : "mp4", url };
  }
}
