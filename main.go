package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"regexp"
	"strings"
)

func main() {
	extensions := readRepoExtensions()
	f, err := os.Create("index.json")
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()
	b, err := json.MarshalIndent(extensions, "", " ")
	if err != nil {
		log.Fatal(err)
	}
	f.Write(b)

	f2, err2 := os.Create("README.md")
	if err2 != nil {
		log.Fatal(err)
	}
	defer f2.Close()

	readme := `
# Miru-Repo

Miru extensions repository | [Miru App Download](https://github.com/miru-2-0/miru-app) |

## List
|  Name   | Package | Version | Author | Language | Type | Source |
|  ----   | ---- | --- | ---  | ---  | --- | --- |
`

	for _, v := range extensions {
		url := fmt.Sprintf("[Source Code](%s)", "https://github.com/miru-2-0/repo/blob/main/repo/"+v["url"])
		nsfw := v["nsfw"] == "true"
		if nsfw {
			continue
		}
		readme += fmt.Sprintf("| %s | %s | %s | %s | %s | %s | %s |\n", v["name"], v["package"], v["version"], v["author"], v["lang"], v["type"], url)
	}
	f2.WriteString(readme)
	writeDisclaimer(f2)
}

func writeDisclaimer(f *os.File) {
	f.WriteString(`

## Disclaimer

This repository contains third-party extension scripts for personal study and
technical exchange only. The scripts are just API clients that forward / parse
web content; they do not host, store, produce, or distribute any copyrighted
media files.

- All video sources and metadata belong to their respective website operators
  and copyright holders.
- The extension authors are not affiliated with, nor endorsed by, any source
  website.
- Please respect the terms of service of each source website. Any use of these
  scripts in violation of local laws or a website's terms is the sole
  responsibility of the user.
- This project is provided "AS IS" without warranty of any kind. The authors
  are not liable for any damages arising from the use of this repository.

If you are a copyright holder and believe any content here infringes your
rights, please contact the repository owner and the relevant link/script will
be removed promptly.

---
中文说明
本仓库内的扩展脚本仅用于个人学习与技术交流。脚本只是接口客户端，转发/解析网页内容，不托管、存储、制作或分发任何受版权保护的媒体文件。

- 所有视频源与元数据均归各自源站及版权方所有。
- 扩展作者与各源站无任何从属或合作关系。
- 请遵守各源站的服务条款，因使用本仓库脚本而违反当地法律或源站条款的，责任由使用者自行承担。
- 本项目按“现状”提供，不作任何担保，使用本仓库产生的任何损失与作者无关。

若您为版权方且认为本仓库内容侵犯您的权益，请联系仓库维护者，相关链接/脚本将立即删除。
`)
}

func readRepoExtensions() []map[string]string {
	de, err := os.ReadDir("repo")
	if err != nil {
		log.Fatal(err)
	}
	var extensions []map[string]string
	for _, de2 := range de {
		b, err := os.ReadFile(path.Join("repo", de2.Name()))
		if err != nil {
			log.Println("error:", err)
			continue
		}
		r, _ := regexp.Compile(`MiruExtension([\s\S]+?)/MiruExtension`)
		data := r.FindAllString(string(b), -1)
		if len(data) < 1 {
			log.Println("error: not extension")
			continue
		}
		lines := strings.Split(data[0], "\n")
		extension := make(map[string]string)
		for _, v := range lines {
			if v[:4] == "// @" {
				s := strings.Split(v[4:], " ")
				if len(s) > 1 {
					extension[s[0]] = strings.Trim(s[len(s)-1], "\r")
				}
			}
		}
		extension["url"] = de2.Name()
		extensions = append(extensions, extension)
	}
	return extensions
}
