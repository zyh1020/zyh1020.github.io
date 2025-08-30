import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/vuepress/",
  lang: "zh-CN",
  title: "Mr.Zyh",
  description: "Zyh的博客",
  theme,
  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
