// ==MiruExtension==
// @name         AGE动漫
// @version      v0.0.3
// @author       appdevelpo
// @lang         zh-cn
// @license      MIT
// @icon         https://www.agedm.io/favicon.ico
// @package      agedm.io
// @type         bangumi
// @webSite      https://www.agedm.io
// @nsfw         false
// ==/MiruExtension==
//age.tv、agefans.com、agedm.com、agedm.io
export default class extends Extension {
    async search(kw, page) {
        const encode_kw = encodeURI(kw)
        const res = await this.request(`/v2/search?query=${encode_kw}&page=${page}`,{
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/244.178.44.111 Safari/537.36',
            }});
        const json_res = JSON.parse(JSON.stringify(res))
        
        // 检查json_res.data是否存在以及是否包含videos属性
        if (!json_res.data || !json_res.data.videos) {
            return []; // 如果没有找到相关结果，返回空数组
        }
        
        const bangumi = json_res.data.videos.map((element) => {
            return {
                title: element.name,
                url: element.id.toString(),
                cover: element.cover,
                update: element.uptodate
            }
        })
        
        return bangumi
    }
    async latest(page) {
        const res = await this.request(`/v2/catalog?genre=all&label=all&letter=all&order=time&region=all&resource=all&season=all&status=all&year=all&page=${page}&size=50`,{
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/244.178.44.111 Safari/537.36',
            }})
        const json_res = JSON.parse(JSON.stringify(res))
        // 
        if (!json_res.videos || !Array.isArray(json_res.videos)) {
            return []
        }
        const bangumi = json_res.videos.map((element) => {
            return {
                title: element.name,
                url: element.id.toString(),
                cover: element.cover,
                update: element.uptodate
            }
        })
        // 
        return bangumi
    }

    async detail(url) {
        const res = await this.request(`/v2/detail/${url}`,{
            headers:{
                "Referer":"https://m.agedm.io/",
                "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/244.178.44.111 Safari/537.36"
            }
        });
        const json_res = JSON.parse(JSON.stringify(res))
        
        const epLines = [];
        for (const [key, value] of Object.entries(json_res.video.playlists)) {
            // 只保留标准 m3u8 线路（非凡/暴风/无尽/量子等）；西瓜(xigua)等
            // 返回的是前端播放器密钥，Miru 无法解析，直接排除。
            if (!key.endsWith("m3u8") || key.includes("xigua")){
                continue
            }
            
            epLines.push({
                title: json_res.player_label_arr[key] || key,
                urls: value.map((item) => {
                    return{
                        name: item[0],
                        url: json_res.player_jx.zj + item[1]
                    }
                })
            })
          }
        const episodes = epLines;

        const detail_res = {
            title: json_res.video.name,
            cover: json_res.video.cover,
            desc: json_res.video.intro,
            original_name: json_res.video.name_original,
            other_name: json_res.video.name_other,
            kind: json_res.video.type,
            type: json_res.video.plot,
            author: json_res.video.writer,
            company: json_res.video.company,
            area: json_res.video.area,
            pubdate: json_res.video.premiere,
            remarks: json_res.video.status,
            year: json_res.video.year,
            tags: json_res.video.tags_arr,
            episodes
        }
        
        return detail_res
    }

    async watch(url) {
        const res = await this.request("",{
            headers:{
                'Miru-Url':url,
                "Referer":"https://m.agedm.io/",
                "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/244.178.44.111 Safari/537.36"
            }
        });
        
        const m = res.match(/Vurl = '([^']+)'/);
        const video_url = m ? m[1] : "";
        if (!video_url) {
            throw new Error("no video url")
        }
        if (!/^https?:\/\//.test(video_url)) {
            throw new Error(`unsupported source: ${video_url.slice(0, 32)}`)
        }
        return {
            type: "hls",
            url: video_url,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.142.86 Safari/537.36",
              }
        };
    }
}

