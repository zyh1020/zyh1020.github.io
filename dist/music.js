const ap = new APlayer({
    container: document.getElementById('aplayer'),
    fixed: true,
    autoplay: false,
	loop:'all',
    audio: [
	 {
        name: '远走高飞',
        artist: '金志文',
        url: 'http://www.ytmp3.cn/down/47236.mp3',
        cover: 'http://img.ytmp3.cn/image/32.jpg',
      },
      {
        name: "生僻字",
        artist: '陈柯宇',
        url: 'http://www.ytmp3.cn/down/56174.mp3',
        cover: 'http://img.ytmp3.cn/image/86.jpg',
      },
      {
        name: '日不落',
        artist: '蔡依林',
        url: 'http://www.ytmp3.cn/down/39102.mp3',
        cover: 'http://img.ytmp3.cn/image/27.jpg',
      },
	  {
        name: '成都',
        artist: '赵雷',
        url: 'http://www.ytmp3.cn/down/58479.mp3',
        cover: 'http://img.ytmp3.cn/image/47.jpg',
      }
      
    ]
});
