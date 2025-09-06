import { navbar } from "vuepress-theme-hope";

export default navbar([
  "/",
  {
    text: "文章",
    icon: "book-open",
    link: "/blog/",
  },
  {
    text: "分类",
    icon: "bookmark",
    link: "/category/",
  },
  {
    text: "时间轴",
    icon: "calendar",
    link: "/timeline/",
  },
]);
