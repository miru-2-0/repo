// ==MiruExtension==
// @name         TopCartoons
// @version      v0.1.0
// @author       bachig26
// @lang         en
// @license      MIT
// @package      topcartoons.tv
// @type         bangumi
// @icon         https://www.topcartoons.tv/favicon.ico
// @webSite      https://www.topcartoons.tv
// @nsfw         false
// ==/MiruExtension==
// 站点结构（WordPress，vidorev 主题）：
//   列表卡片统一是
//     <article id="post-N" class="post-item site__col ...">
//       > .post-item-wrap > .blog-pic > .blog-pic-wrap > a.blog-img[href]
//         + img.blog-picture[data-src]（懒加载，所以取 data-src，不是 src）
//       > .listing-content > h3.post-title > a
//   首页 / 搜索页 /page/N/ 共用同一套卡片，每页 24 条，翻页：
//     首页   /                    与 /page/N/
//     搜索   /?s=<kw>             与 /?s=<kw>&paged=N
//   站内只有一个分类 Cartoons，作品也没打角色标签，没有可用的筛选维度，
//   所以不实现 createFilter。
//   两个旧版踩过的坑：
//     - 简介不在 div.entry-content 里，正文里根本没有这段文字，只有 og:description，
//       旧版的 div.entry-content > p 永远取到空；
//     - 播放地址是 <video class="vidorev-video-shortcode" src="...">，指向
//       https://ww.topcartoons.tv/video/*.mp4 直链，实测不需要 Referer（206 video/mp4）。
//       旧版 watch() 一律返回 hls，类型标错了会播不出来。
export default class extends Extension {
  // og:description 之类是 HTML 属性，里面的实体要自己还原
  // （&#8217; 之类数字实体最常见，&amp; 放最后解，避免二次转义）。
  $entities(content) {
    return (content ?? "")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  }

  // 首页 / 搜索页共用的卡片解析
  async $parse(path) {
    const res = await this.request(path);
    const items = await this.querySelectorAll(res, "article.post-item.site__col");
    const list = [];
    for (const item of items) {
      const html = await item.content;
      list.push({
        title: (await this.querySelector(html, "h3.post-title > a").text).trim(),
        url: await this.getAttributeText(html, "a.blog-img", "href"),
        cover: await this.getAttributeText(html, "img.blog-picture", "data-src"),
      });
    }
    return list;
  }

  // 源站抽风时会只回空 body，而 Miru 的 request 只把 body 交给扩展、不暴露状态码，
  // 整页就会凭空变空、Miru 直接判定"已到底"而停止翻页，所以空结果重试一次。
  async $cards(path) {
    const list = await this.$parse(path);
    return list.length ? list : this.$parse(path);
  }

  async latest(page) {
    return this.$cards(page > 1 ? `/page/${page}/` : "/");
  }

  async search(kw, page) {
    if (!kw) return this.latest(page);
    // 这里和 supercartoons 不同：标准 WordPress，+ 与 %20 实测结果一致，
    // 直接用 encodeURIComponent 即可。
    const term = encodeURIComponent(kw);
    return this.$cards(
      page > 1 ? `/?s=${term}&paged=${page}` : `/?s=${term}`
    );
  }

  async detail(url) {
    const load = () =>
      this.request("", {
        headers: { "Miru-Url": url },
      });
    let res = await load();
    let file =
      (res.match(/<video[^>]*class="vidorev-video-shortcode"[^>]*src="([^"]+)"/) ?? [])[1] ??
      (res.match(/<meta property="og:video:url" content="([^"]+)"/) ?? [])[1] ??
      "";
    // 同 $cards：空 body 时不能误判成"结构变更"，先重试一次。
    if (!file) {
      res = await load();
      file =
        (res.match(/<video[^>]*class="vidorev-video-shortcode"[^>]*src="([^"]+)"/) ??
          [])[1] ??
        (res.match(/<meta property="og:video:url" content="([^"]+)"/) ?? [])[1] ??
        "";
    }
    if (!file) throw new Error("未找到播放地址，站点结构可能已变更");

    const title =
      (await this.querySelector(res, "div.float-video-title > h6").text).trim() ||
      this.$entities(
        await this.getAttributeText(res, "meta[property='og:title']", "content")
      );
    const cover =
      (await this.getAttributeText(res, "img.poster-preload", "src")) ||
      (await this.getAttributeText(res, "meta[property='og:image']", "content"));
    const desc = this.$entities(
      await this.getAttributeText(res, "meta[property='og:description']", "content")
    );

    return {
      title,
      cover,
      desc,
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