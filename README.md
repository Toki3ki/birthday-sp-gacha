# Birthday SP Gacha

一个不需要服务器的生日 SP 扭蛋抽奖网页小游戏。直接打开 `index.html` 就能玩，也可以发布到 GitHub Pages。

## 修改奖品

奖品池在 `script.js` 顶部的 `prizes` 数组里：

- `name`: 奖品名
- `desc`: 中奖说明
- `rarity`: 稀有度标签
- `weight`: 抽中权重，数字越大越容易抽中

改完后提交并推送到 GitHub，Pages 会自动更新。
