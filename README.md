# Bilibili Favlist Export

将哔哩哔哩收藏夹内容导出为 CSV 文件的浏览器脚本。

## 使用方法

### 1. 获取收藏夹 ID

在哔哩哔哩网页端打开需要导出的收藏夹。收藏夹页面 URL 中 `fid` 参数的值就是收藏夹 ID。

例如：

```text
https://space.bilibili.com/10001/favlist?fid=12345
```

其中，收藏夹 ID 为：

```text
12345
```

### 2. 执行脚本

1. 确保浏览器已经登录哔哩哔哩。
2. 在哔哩哔哩网页中按 `F12` 打开开发者工具。
3. 切换到 **Console**（控制台）标签页。
4. 复制下方的完整脚本，粘贴到控制台并按回车执行。

```js
(async () => {
  const DEFAULT_PAGE_SIZE = 20;
  const MAX_PAGE_SIZE = 40;
  const DEFAULT_TIME_INTERVAL = 500;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const promptInteger = (message, defaultValue, validate, errorMessage) => {
    while (true) {
      const input = prompt(message, String(defaultValue));
      if (input === null) {
        throw new Error("操作已取消");
      }

      const value = Number(input.trim());
      if (Number.isInteger(value) && validate(value)) {
        return value;
      }

      alert(errorMessage);
    }
  };

  const request = async (url) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`请求失败：HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`请求失败：${result.message || `错误码 ${result.code}`}`);
    }

    return result.data;
  };

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const formatTime = (timestamp) =>
    timestamp ? new Date(timestamp * 1000).toLocaleString("zh-CN") : "";

  try {
    const currentUrl = new URL(window.location.href);
    const mediaIdFromUrl = currentUrl.searchParams.get("fid") || "";
    const mediaIdInput = prompt(
      "请输入收藏夹 ID（收藏夹页面 URL 中的 fid 参数）",
      mediaIdFromUrl,
    );

    if (mediaIdInput === null) {
      throw new Error("操作已取消");
    }

    const mediaId = mediaIdInput.trim();
    if (!/^\d+$/.test(mediaId)) {
      throw new Error("收藏夹 ID 必须为数字");
    }

    const pageSize = promptInteger(
      `请输入每页数量 page_size（1-${MAX_PAGE_SIZE}）`,
      DEFAULT_PAGE_SIZE,
      (value) => value >= 1 && value <= MAX_PAGE_SIZE,
      `page_size 必须是 1-${MAX_PAGE_SIZE} 之间的整数`,
    );

    const timeInterval = promptInteger(
      "请输入请求间隔 time_interval（毫秒，建议不低于 500）",
      DEFAULT_TIME_INTERVAL,
      (value) => value >= 0,
      "time_interval 必须是大于或等于 0 的整数",
    );

    const infoUrl = new URL("https://api.bilibili.com/x/v3/fav/folder/info");
    infoUrl.searchParams.set("media_id", mediaId);
    const folderInfo = await request(infoUrl);
    const folderTitle = folderInfo.title || "";

    const videos = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const listUrl = new URL("https://api.bilibili.com/x/v3/fav/resource/list");
      listUrl.searchParams.set("media_id", mediaId);
      listUrl.searchParams.set("pn", String(pageNumber));
      listUrl.searchParams.set("ps", String(pageSize));
      listUrl.searchParams.set("keyword", "");
      listUrl.searchParams.set("order", "mtime");
      listUrl.searchParams.set("type", "0");
      listUrl.searchParams.set("tid", "0");
      listUrl.searchParams.set("platform", "web");

      console.log(`正在获取第 ${pageNumber} 页...`);
      const data = await request(listUrl);
      videos.push(...(data.medias || []));
      hasMore = Boolean(data.has_more);
      pageNumber += 1;

      if (hasMore && timeInterval > 0) {
        await sleep(timeInterval);
      }
    }

    const header = ["标题", "UP主", "发布时间", "视频链接", "封面链接", "收藏夹标题"];
    const rows = videos.map((video) => [
      video.title,
      video.upper?.name,
      formatTime(video.pubtime),
      video.bvid ? `https://www.bilibili.com/video/${video.bvid}` : "",
      video.cover,
      folderTitle,
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${folderTitle || `favlist-${mediaId}`}.csv`;
    link.click();
    URL.revokeObjectURL(downloadUrl);

    console.log(`导出完成，共获取 ${videos.length} 个视频。`);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
})();
```

### 3. 配置参数

脚本运行后，根据提示输入以下参数：

| 参数 | 是否必填 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `media_id` | 是 | 收藏夹 ID，即收藏夹页面 URL 中的 `fid` 参数。脚本会自动读取当前页面的 `fid` 作为默认值 | 当前 URL 中的 `fid` |
| `page_size` | 否 | 每次请求获取的视频数量，只能设置为 `1-40` 之间的整数 | `20` |
| `time_interval` | 否 | 两次请求之间的间隔时间，单位为毫秒 | `500` |

### 4. 导出结果

脚本会自动分页获取收藏夹中的视频信息，并导出 CSV 文件。导出内容包括：

- 标题
- UP 主
- 发布时间
- 视频链接
- 封面链接
- 收藏夹标题

## 注意事项

- 请在已登录哔哩哔哩账号的浏览器页面中执行脚本。
- `page_size` 最大值为 `40`。输入超出范围的值时，脚本会提示重新输入。
- 建议将 `time_interval` 设置为不低于 `500ms`，避免请求过于频繁。
- 如果导出结果不完整，可以尝试减小 `page_size`，或适当增大 `time_interval`。
- 收藏夹内已经失效或无权访问的视频可能无法获取完整信息。
