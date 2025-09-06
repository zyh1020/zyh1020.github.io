import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    {
      text: "文章目录",
      icon: "folder-open",
      prefix: "blog/",
      children: "structure",
    },
  ],
});
