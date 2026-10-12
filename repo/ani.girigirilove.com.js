// ==MiruExtension==
// @name         girigiri爱动漫
// @version      v0.0.4
// @author       appdevelpo
// @lang         zh-cn
// @license      MIT
// @icon         https://ani.girigirilove.com/upload/anime.girigirilove.com_.png
// @package      ani.girigirilove.com
// @type         bangumi
// @webSite      https://ani.girigirilove.com
// @nsfw         false
// ==/MiruExtension==

export default class extends Extension {
  filter_data = {};
  filter_main_bar = {};
  user_val = {};

  async load() {
    function base64decode(str) {
      var base64DecodeChars = new Array(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1);
      var c1, c2, c3, c4;
      var i, len, out;
      len = str.length;
      i = 0;
      out = "";
      while (i < len) {
        do {
          c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff]
        } while (i < len && c1 == -1);
        if (c1 == -1)
          break;
        do {
          c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff]
        } while (i < len && c2 == -1);
        if (c2 == -1)
          break;
        out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));
        do {
          c3 = str.charCodeAt(i++) & 0xff;
          if (c3 == 61)
            return out;
          c3 = base64DecodeChars[c3]
        } while (i < len && c3 == -1);
        if (c3 == -1)
          break;
        out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));
        do {
          c4 = str.charCodeAt(i++) & 0xff;
          if (c4 == 61)
            return out;
          c4 = base64DecodeChars[c4]
        } while (i < len && c4 == -1);
        if (c4 == -1)
          break;
        out += String.fromCharCode(((c3 & 0x03) << 6) | c4)
      }
      return out
    }
    this.base64decode = base64decode
    this.baseurl = "https://ani.girigirilove.com"
  }

  // 列表角标的“更新状态”格式多样，统一去掉其中的时间部分
  // （如 " / 00點30分"、"17:00"、"1點50分"），并清理残留分隔符与多余空格。
  cleanBadge(text) {
    return text
      .replace(/\d{1,2}(?:點|:)\d{2}分?/g, "")
      .replace(/(?:\s*\/\s*)+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async search(kw, page, filter) {
    // 站点搜索页已改为前端 AJAX，结果来自联想接口返回的 JSON 列表。
    const res = await this.request(`/index.php/ajax/suggest?mid=1&wd=${encodeURIComponent(kw)}&page=${page}`);
    const json_res = JSON.parse(JSON.stringify(res));
    if (!json_res || !Array.isArray(json_res.list)) {
      return [];
    }
    return json_res.list.map((element) => {
      return {
        title: element.name,
        url: `/GV${element.id}/`,
        cover: element.pic ? this.baseurl + element.pic : "",
      };
    });
  }

  async latest(page) {
    const res = await this.request(`/show/2--------${page}---/`);
    const bsxList = res.match(/<div class="public-list-box public-pic-b">[\s\S]+?<\/div><\/div><\/div>/g) || [];
    const videos = [];
    bsxList.forEach((element) => {
      const href = element.match(/href="(.+?)"/);
      const title = element.match(/title="(.+?)"/);
      const cover = element.match(/data-src="(.+?)"/);
      if (!href || !title || !cover) {
        return;
      }
      const update = element.match(/"public-list-prb[^"]*">(.+?)<\/span>/);
      videos.push({
        title: title[1],
        url: href[1],
        cover: this.baseurl + cover[1],
        update: update ? this.cleanBadge(update[1]) : "",
      });
    });
    return videos;
  }

  async detail(url) {
    const episodes = [];
    const web_res = await this.request(url);
    const title = web_res.match(/<h3[^;]+?>(.+?)<\/h3>/)?.[1] || "";
    const coverM = web_res.match(/<img referrerpolicy="no-referrer"[^>]+?data-src="(.+?)"/);
    const cover = coverM ? this.baseurl + coverM[1] : "";
    const descM = web_res.match(/"text cor3">(.+?)</);
    const desc = descM ? descM[1] : "";

    // 详情页“导演/演员/类型”等信息区：每个分区为
    // <div class="slide-info hide partition"><strong ...>标签 :</strong><a>名</a>...</div>
    const partNames = (label) => {
      const m = web_res.match(new RegExp(`<strong[^>]*>${label} :</strong>([\\s\\S]*?)</div>`));
      if (!m) {
        return [];
      }
      const names = [];
      const re = /<a[^>]*>(.+?)<\/a>/g;
      let mm;
      while ((mm = re.exec(m[1])) !== null) {
        names.push(mm[1]);
      }
      return names;
    };
    const remarksM = web_res.match(/slide-info-remarks cor5">(.+?)</);
    const depM = web_res.match(/class="deployment[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const dep = depM ? depM[1] : "";
    const year = (dep.match(/<span>(\d{4})<\/span>/) || [])[1] || "";
    const pubdate = (dep.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
    const lang = (dep.match(/<span>([^<]+)<\/span><span class="division">·<\/span>详情/) || [])[1] || "";
    const scoreM = web_res.match(/class="fraction">(.+?)</);

    // 播放线路名位于 anthology-tab 的 swiper-wrapper 内：
    // <a class="swiper-slide"><i class="fa ds-dianying"></i>&nbsp;繁中<span ...></span></a>
    const tabM = web_res.match(/anthology-tab[\s\S]*?<div class="swiper-wrapper">([\s\S]*?)<\/div>/);
    const lineTitles = [];
    if (tabM) {
      const reTitle = /<\/i>&nbsp;([^<]+)</g;
      let tm;
      while ((tm = reTitle.exec(tabM[1])) !== null) {
        lineTitles.push(tm[1].trim());
      }
    }
    // 每线路对应一个 <ul class="anthology-list-play size"> ... </ul>，集名可能含中文/空格/点号
    const playListArea = web_res.match(/anthology-list-play size[\s\S]+?<\/ul>/g) || [];
    playListArea.forEach((areaHtml, index) => {
      const urls = [];
      const reEp = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let em;
      while ((em = reEp.exec(areaHtml)) !== null) {
        urls.push({ name: em[2].trim(), url: em[1] });
      }
      episodes.push({
        title: lineTitles[index] || `线路${index + 1}`,
        urls,
      });
    })
    return {
      title,
      cover,
      desc,
      director: partNames("导演").join(" / "),
      actors: partNames("演员"),
      type: partNames("类型").join(" / "),
      year,
      pubdate,
      lang,
      remarks: remarksM ? remarksM[1] : "",
      score: scoreM ? scoreM[1] : "",
      episodes
    }
  }

  async watch(url) {
    const m3u8 = await this.getM3u8(url)
    return {
      type: "hls",
      url: m3u8,
    }
  }

  async getM3u8(url) {
    const res = await this.request(url)
    const vid_player_detail = JSON.parse(res.match(/player_aaaa=(.+?)<\/script>/)[1])
    const m3u8_link = decodeURIComponent(this.base64decode(vid_player_detail.url))
    return m3u8_link
  }
}
