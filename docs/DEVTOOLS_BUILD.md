## 首次构建

下载官方构建工具depot_tools

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
```

拉取DevTools源码

```bash
mkdir devtools
cd devtools
../depot_tools/fetch devtools-frontend
```

同步和构建DevTools

```bash
cd devtools-frontend
../../depot_tools/gclient sync
../../depot_tools/gn gen out/Default
../../depot_tools/autoninja -C out/Default
```

将out/Default/gen/front-end中的产物复制到src/server/public/devtools-frontend中

## 更新

```bash
cd devtools/devtools-frontend
rm -rf out
git checkout chromium/5359 # 切换到某个稳定的版本
git pull
../../depot_tools/gclient sync
../../depot_tools/gn gen out/Default
../../depot_tools/autoninja -C out/Default
```

将out/Default/gen/front-end中的产物复制到src/server/public/devtools-frontend中
