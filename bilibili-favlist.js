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
