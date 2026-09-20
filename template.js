// ==MiruExtension==
// @name         Template
// @version      v0.0.1
// @author       yourname
// @lang         zh-cn
// @license      MIT
// @icon         https://example.com/favicon.ico
// @package      template
// @type         bangumi
// @webSite      https://example.com
// @nsfw         false
// ==/MiruExtension==

export default class extends Extension {
  // 可选：请求的公共封装（镜像域名、超时重试等）
  async $get(params) {
    return this.request("/api/path?" + params, {
      headers: { "Miru-Url": "https://example.com" },
    });
  }

  // 可选：加载分类等元数据
  async load() {}

  // 可选：筛选器
  async createFilter() {
    return {};
  }

  // 最新/首页列表
  async latest(page) {
    return [
      {
        title: "标题",
        url: "详情id",
        cover: "https://example.com/cover.jpg",
        update: "更新至第X集",
      },
    ];
  }

  // 搜索（kw 关键词，filter 筛选值）
  async search(kw, page, filter) {
    return this.latest(page);
  }

  // 详情
  async detail(id) {
    return {
      // ---- 必填 ----
      title: "标题",
      cover: "https://example.com/cover.jpg",
      desc: "简介",
      episodes: [
        {
          title: "线路名",
          urls: [{ name: "第1集", url: "https://example.com/1.m3u8" }],
        },
      ],

      // ---- 可选：字符串 ----
      type: "类型",
      director: "导演",
      writer: "编剧",
      area: "地区",
      lang: "语言",
      year: "年份",
      pubdate: "上映日期",
      remarks: "状态（更新至12集）",
      total: "总集数",
      score: "评分",

      // ---- 演员（两种兼容）----
      // 1) 数组：元素可为 {name, role, avatar} 对象，或纯名字字符串
      actors: [
        { name: "主演A", role: "角色/职位", avatar: "https://example.com/a.jpg" },
        "主演B",
      ],
      // 2) 或字符串："主演A / 主演B"
      // actor: "主演A / 主演B",
    };
  }

  // 播放
  async watch(url) {
    return { type: "hls", url };
  }
}