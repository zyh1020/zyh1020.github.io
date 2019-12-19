const ap = new APlayer({
    container: document.getElementById('aplayer'),
    fixed: true,
    autoplay: false,
	loop:'all',
    audio: [
	 {
        name: '远走高飞',
        artist: '金志文',
        url: 'http://qiniuyun.zouyuhang.club/music%E9%87%91%E5%BF%97%E6%96%87%20-%20%E8%BF%9C%E8%B5%B0%E9%AB%98%E9%A3%9E.flac',
        cover: 'http://qiniuyun.zouyuhang.club/%E8%BF%9C%E8%B5%B0%E9%AB%98%E9%A3%9E.jpg',
      },
      {
        name: "生僻字",
        artist: '陈柯宇',
        url: 'http://qiniuyun.zouyuhang.club/music%E8%94%A1%E4%BE%9D%E6%9E%97%20-%20%E6%97%A5%E4%B8%8D%E8%90%BD.mp3',
        cover: 'http://qiniuyun.zouyuhang.club/%E7%94%9F%E5%83%BB%E5%AD%97.jpg',
      },
      {
        name: '日不落',
        artist: '蔡依林',
        url: 'http://qiniuyun.zouyuhang.club/music%E8%94%A1%E4%BE%9D%E6%9E%97%20-%20%E6%97%A5%E4%B8%8D%E8%90%BD.mp3',
        cover: 'http://qiniuyun.zouyuhang.club/%E6%97%A5%E4%B8%8D%E8%90%BD.jpg',
      },
	  {
        name: '成都',
        artist: '赵雷',
        url: 'http://qiniuyun.zouyuhang.club/music%E8%B5%B5%E9%9B%B7%20-%20%E6%88%90%E9%83%BD.mp3',
        cover: 'http://qiniuyun.zouyuhang.club/%E6%88%90%E9%83%BD.jpg',
      }
      
    ]
});
