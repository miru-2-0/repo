// ==MiruExtension==
// @name         sazkino
// @version      v0.0.1
// @author
// @lang         zh-ug
// @license
// @icon         http://www.sazkino.com/favicon.ico
// @package      sazkino.com
// @type         bangumi
// @webSite      http://www.sazkino.com
// @nsfw         false
// ==/MiruExtension==
export default class extends Extension {
  base = "http://www.sazkino.com";

  text(content) {
    if (!content) return "";
    return content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  }

  async $get(path) {
    return this.request(path, {
      headers: { "Miru-Url": this.base },
    });
  }

  async $post(path, form) {
    return this.request(path, {
      method: "POST",
      headers: {
        "Miru-Url": this.base,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: Object.keys(form)
        .map((k) => `${k}=${encodeURIComponent(form[k])}`)
        .join("&"),
    });
  }

  async load() {
    this.genres = {};
  }

  async createFilter() {
    return {
      genres: {
        title: "影片类型",
        max: 1,
        min: 0,
        default: "电影",
        options: { 110: "电影", 112: "剧场版", 153: "连续剧", 156: "动漫" },
      },
    };
  }

  async latest(page) {
    return this.list(110, page);
  }

  parseCards(html, scope) {
    const seg = scope ?? html;
    const posts = [...seg.matchAll(
      /<article[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/article>/g
    )];
    return posts.map((m) => {
      const block = m[1];
      const href = block.match(/href="([^"]*play\/id\/(\d+)[^"]*)"/);
      const title = this.text(block.match(/<h4>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
      const cover = block.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? "";
      const update = this.text(
        block.match(/class="[^"]*ct-time[^"]*"[^>]*>\s*<span>\s*([\s\S]*?)<\/span>/)?.[1] ?? ""
      );
      if (!href || !title) return null;
      return {
        title,
        url: href[2],
        cover: cover.startsWith("http") ? cover : `${this.base}${cover}`,
        update: update,
      };
    }).filter(Boolean);
  }

  async list(kind = 110, page = 1) {
    const pagePath = page === 1 ? `id/${kind}.html` : `id/${kind}/p/${page}.html`;
    const html = await this.$get(`/Pc/Index/kino/${pagePath}`);
    return this.parseCards(html);
  }

  async search(kw, page, filter) {
    const kind = filter?.genres?.[0] ?? "110";
    if (!kw) return this.list(kind, page);
    const html = await this.$post("/Pc/Index/kino_izdax.html", { kino_izdax: kw });
    // 该搜索结果页分上下两块：上面是「搜索结果」区，下面是「相关推荐」
    // （tawsiya-kino）。此处只解析搜索结果区，绝不把推荐当结果返回。
    const cut = html.indexOf("<!--tawsiya-kino-->");
    const scope = cut > -1 ? html.slice(0, cut) : html;
    return this.parseCards(scope);
  }

  async detail(id) {
    const html = await this.$get(`/Pc/Index/play/id/${id}.html`);
    const title = this.text(html.match(/<div class="uqur_top">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const raw = html.match(/<div class="uqur_asti_sol"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const desc = raw
      .split(/<br\s*\/?>/i)
      .map((l) =>
        l
          .replace(/<if[^>]*>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&[a-z]+;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean)
      .join("\n");
    const cover = html.match(/<div class="uqur_asti_ong">\s*<img[^>]*src="([^"]+)"/)?.[1]
      ?? html.match(/<img[^>]*src="([^"]*\/Uploads\/[^"]+)"/)?.[1] ?? "";
    const epMatch = html.match(/for \(i = 1; i <(\d+);/);
    const eps = epMatch ? parseInt(epMatch[1], 10) - 1 : 1;
    const urls = [];
    for (let i = 1; i <= eps; i++) {
      urls.push({ name: `第${i}集`, url: `${id}/${i}/${eps}.html` });
    }
    return {
      title,
      cover: cover.startsWith("http") ? cover : `${this.base}${cover}`,
      desc,
      episodes: [{ title, urls }],
    };
  }

  async watch(url) {
    const [, kino, ep] = url.match(/^(\d+)\/(\d+)\/\d+\.html$/) ?? [];
    const html = await this.$get(`/Pc/Index/player/id/${kino}/kino/${ep}.html`);
    const m = html.match(/var jsonString = '(\[[\s\S]*?\])';/);
    if (!m) throw new Error("no source");
    const sources = JSON.parse(m[1].replace(/\\\//g, "/"));
    return { type: "mp4", url: sources[0]?.url ?? "" };
  }
}