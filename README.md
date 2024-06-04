# bento-custom-domain

基于 Cloudflare Worker 反向代理，为 bento.me 个人主页绑定自定义域名。

> **声明**：本项目基于 [Jay Franco 的文章](https://jayfranco.hashnode.dev/custom-domain-for-bento-with-cloudflare-workers) 二次开发，对原作者表达感谢。

## 主要功能

* [x] 目录保护。仅允许特定路径的请求，避免反向代理了其他人的个人主页。
* [x] 静态资源管理。在反向代理获取静态资源后，会保存在 R2 储存桶中，3天内无需再次反向代理获取。
* [x] storage.googleapis.com域名反向代理。解决googleapis在部分地区的连通性问题。
* [x] Mapbox Token替换。解决Mapbox域名限制导致的地图模块无法展示问题。
* [x] 屏蔽登录模块。因无法在自定义域名下访问bento.me的后台，因此屏蔽相关登录模块。

## 部署方式

- 注册 Cloudflare 账号，并创建一个 Worker
- 编辑代码，将本项目中的 `worker.js` 中的代码复制到 Worker 中
- 创建储存库：在 “Workers 和 Pages” 的下方找到 “R2” > “创建储存桶”，名称可自定义，如 `bento`
- 进入 Worker 选择 “设置” > “变量”
  - **添加环境变量：**
    - 变量名： `BASE_URL` ，值：你绑定到此 Worker 的自定义域名，比如 `https://example.com`
    - 变量名： `BENTO_USERNAME` ，值：bento.me 的用户名，比如 `example` （对应 bento.me/example ）
    - 变量名： `MAPBOX_TOKEN` ，值：你自己的Mapbox Token，可在Mapbox注册免费账号后获得，建议限制url为你绑定的自定义域名
  - **添加 R2 储存桶绑定：**
    变量名： `R2_BUCKET` ，值：刚创建的 R2 储存桶名称，如 `bento`
- 进入 Worker 选择 “设置” > “触发器” > “Cron 触发器”，添加定时清理 R2 储存桶的任务
- 绑定自定义域名（略）

## 声明及许可
该项目采用 [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) 开源协议。您可以自由地使用、修改和分发本项目，但需保留原作者的版权声明和协议声明，并在分发时提供相同的许可协议。同时，使用本项目可能涉及到的任何风险由使用者自行承担。开发者不对因使用本项目所导致的任何损失或损害负责。

---

Custom Domain Binding for Bento.me Personal Homepage Based on Cloudflare Worker Reverse Proxy

> **Disclaimer**: This project is developed based on Jay [Franco's article](https://jayfranco.hashnode.dev/custom-domain-for-bento-with-cloudflare-workers). We express our gratitude to the original author.

## Main Features

* [x] Directory Protection: Only allows requests to specific paths to avoid proxying other people's personal homepages.
* [x] Static Resource Management: Static resources are saved in the R2 storage bucket after being fetched via reverse proxy, so they don't need to be fetched again within 3 days.
* [x] Reverse Proxy for storage.googleapis.com: Solves connectivity issues with googleapis in certain regions.
* [x] Mapbox Token Replacement: Solves issues with the map module not displaying due to domain restrictions by Mapbox.
* [x] Login Module Blocking: Blocks login-related modules as accessing the backend of bento.me under a custom domain is not possible.

## Deployment Instructions

- Register a Cloudflare account and create a Worker.
- Edit the code by copying the contents of `worker.js` from this project into the Worker.
- Create a storage bucket: Navigate to “Workers and Pages” > “R2” > “Create Bucket”, and name it as you prefer, such as `bento`.
- Go to the Worker settings and select “Variables”:
  - **Add environment variables:**
    - Variable name: `BASE_URL` , value: your custom domain bound to this Worker, e.g., `https://example.com`
    - Variable name: `BENTO_USERNAME`, value: your bento.me username, e.g., `example` (corresponding to bento.me/example)
    - Variable name: `MAPBOX_TOKEN`, value: your own Mapbox Token, which can be obtained by registering a free account on Mapbox; it's recommended to restrict the URL to your custom domain
  - **Add R2 bucket binding:**
    Variable name: `R2_BUCKET` , value: the name of the R2 bucket you just created, e.g., `bento`
- Go to the Worker settings and select “Triggers” > “Cron Triggers” to add a scheduled task for cleaning up the R2 bucket.
- Bind your custom domain (details omitted).

## Disclaimer and License
This project is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) . You are free to use, modify, and distribute this project, but you must retain the original author's copyright and license statements, and provide the same license when distributing. Additionally, any risks associated with using this project are borne by the user. The developer is not responsible for any loss or damage caused by the use of this project.
