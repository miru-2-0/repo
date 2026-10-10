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
// 关于 webSite 与请求域名：
//   Miru 中 webSite 有两个作用：
//     1) 作为 this.request() 未传 "Miru-Url" 头时的默认请求 base URL；
//     2) 作为默认 Referer／扩展详情页展示的网站。
//   因此：
//     - 若每个请求都显式传 headers:{ "Miru-Url": <接口host> }（推荐，见下方 $get），
//       webSite 可填官网（仅展示/Referer 兜底）；
//     - 若直接用相对路径 this.request("/api/..") 且不传 "Miru-Url"，
//       则 webSite 必须是真实接口 host，否则请求会拼错域名。
//   约定：webSite 填官网，接口/镜像域名在代码里用 Miru-Url 设定。
//   注意：注释里不要出现 "@字段名" 后跟空白，否则会被 Miru 头部解析正则覆盖正式值。

export default class extends Extension {
  // 请求的公共封装：显式指定 Miru-Url（接口 host），与 webSite（官网）解耦。
  // 镜像域名、超时重试等都可在此集中处理。
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
      type: "类型（如：动作/剧情）",
      kind: "种类（如：TV/OVA/剧场版）",
      original_name: "原版名称（如：進撃の巨人）",
      other_name: "其他名称（如：自由之翼 / Attack on Titan）",
      director: "导演",
      writer: "编剧",
      author: "原作（如：諫山創，可与编剧不同或相同）",
      company: "制作公司",
      area: "地区",
      lang: "语言",
      year: "年份",
      pubdate: "上映日期",
      remarks: "状态（更新至12集）",
      total: "总集数",
      score: "评分",
      tags: "标签（数组或空格分隔字符串，如：['热血','战斗']）",

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