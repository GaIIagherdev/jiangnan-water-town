# 烟雨江南 · 小桥流水人家

一幅可以走近的江南水乡。石拱桥、黛瓦白墙、垂柳与乌篷船，在流水、薄雾和灯火之间。

**[进入画卷](https://gaiiagherdev.github.io/jiangnan-water-town/)**

![烟雨江南互动预览](preview.jpg)

## 观景

- 拖动旋转视角，滚轮或双指调整远近。
- 点击水面泛起涟漪。
- 在薄暮、月色、晨雾之间切换。
- 可选溪水环境音，默认静音。
- 相机按钮导出长边 3840 像素的 PNG。
- 「入画」隐藏界面；Esc 返回；R 重置视角。

## 实现

Three.js r170 / WebGL 2。19 栋民居、石拱桥、乌篷船、五棵垂柳、瓦垄与窗棂均使用程序化几何。纹理由 Canvas 生成，包含动态水面反射、环境遮蔽、柔和泛光、风动柳叶、远山薄雾与舟身浮动。

网站无外部运行依赖、无统计追踪，可离线打开构建后的 `dist/index.html`。支持系统减少动态设置，并在后台暂停绘制。

## 本地开发

```sh
npm ci
npm run build
npm run preview
```

浏览器打开 `http://localhost:8765`。直接编辑 `src/`，再运行构建即可更新。

`main` 分支的每次推送都会通过 GitHub Actions 构建并发布到 GitHub Pages。

Three.js 使用 MIT License，见 [第三方许可证](src/vendor/LICENSE-three.txt)。
