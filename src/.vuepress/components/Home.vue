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
@keyframes gradientBG{
  0%{background-position:0 50%}
  50%{background-position:100% 50%}
  to{background-position:0 50%}
}
#bannerWave1 {
  height: 84px;
  background: url(http://img.zouyh.top/theme/blog/bannerwave1.png) repeat-x;
  position: absolute;
  width: 200%;
  bottom: -10px;
  z-index: 10;
  animation: gradientBG 120s linear infinite;
}

#bannerWave2 {
  height: 100px;
  background: url(http://img.zouyh.top/theme/blog/bannerwave2.png) repeat-x;
  position: absolute;
  width: 400%;
  bottom: -10px;
  z-index: 5;
  animation: gradientBG 120s linear infinite;
}
</style>