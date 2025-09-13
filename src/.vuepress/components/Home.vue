<script setup lang="ts">
  import { Blog } from "vuepress-theme-hope/blog";
</script>
<template>
  <Blog>
    <template #heroAfter>
      <div id="bannerWave1"></div>
      <div id="bannerWave2"></div>
    </template>
  </Blog>
</template>

<style scoped>

@keyframes gradientBgOne{
  0%{background-position:0 50%}
  50%{background-position:100% 50%}
  to{background-position:0 50%}
}
@keyframes gradientBgTwo{
  0%{background-position:100% 50%}
  50%{background-position:0 50%}
  to{background-position:100% 50%}
}

#bannerWave1 {
  height: 84px;
  background: url(http://img.zouyh.top/theme/blog/bannerwave1.png) repeat-x;
  position: absolute;
  width: 100%;
  bottom: 0;
  z-index: 10;
  animation: gradientBgOne 120s linear infinite;
}
#bannerWave2 {
  height: 100px;
  background: url(http://img.zouyh.top/theme/blog/bannerwave2.png) repeat-x;
  position: absolute;
  width: 100%;
  left: 0;
  bottom: -10px;
  z-index: 5;
  animation: gradientBgTwo 120s linear infinite;
}
</style>