import { defineClientConfig } from "vuepress/client";
import Home from "./components/Home.vue";
export default defineClientConfig({
    // 你可以在这里添加或覆盖布局
    layouts: {
        // 一个主页布局，带有自定义的 Hero 标志
        Home
    },
});