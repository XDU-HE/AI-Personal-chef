import {
  ApiError,
  createAbortError,
  requestJson,
} from "./client.js";
import { createUniqueImageFilename } from "../utils/image.js";

export async function fetchOssPresign(filename, { signal } = {}) {
  if (typeof filename !== "string" || filename.trim() === "") {
    throw new TypeError("filename 必须是非空字符串。");
  }

  const payload = await requestJson("/oss/presign", {
    method: "GET",
    query: { filename },
    signal,
    fallbackMessage: "获取图片上传地址失败，请稍后重试。",
  });

  const requiredFields = ["uploadUrl", "contentType", "accessUrl"];
  const valid = requiredFields.every(
    (field) => typeof payload?.[field] === "string" && payload[field].trim() !== "",
  );
  if (!valid) {
    throw new ApiError("图片上传地址数据格式不正确。", {
      status: 200,
      body: payload,
      code: "invalid_presign",
    });
  }

  return {
    uploadUrl: payload.uploadUrl.trim(),
    contentType: payload.contentType.trim(),
    accessUrl: payload.accessUrl.trim(),
  };
}

export function putFileToOss(
  uploadUrl,
  file,
  { contentType, signal, onProgress } = {},
) {
  if (typeof uploadUrl !== "string" || uploadUrl.trim() === "") {
    return Promise.reject(new TypeError("uploadUrl 必须是非空字符串。"));
  }
  if (!file) {
    return Promise.reject(new TypeError("缺少待上传文件。"));
  }
  if (typeof contentType !== "string" || contentType.trim() === "") {
    return Promise.reject(new TypeError("contentType 必须是非空字符串。"));
  }
  if (typeof XMLHttpRequest !== "function") {
    return Promise.reject(new Error("当前环境不支持图片上传。"));
  }
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbortSignal);
      xhr.upload.onprogress = null;
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
    };

    const settle = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback(value);
    };

    const handleAbortSignal = () => xhr.abort();

    xhr.upload.onprogress = (event) => {
      if (typeof onProgress !== "function") {
        return;
      }
      const total = event.lengthComputable ? event.total : Number(file.size) || 0;
      const percent = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
      onProgress(percent, {
        loaded: event.loaded,
        total,
        lengthComputable: event.lengthComputable,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        settle(resolve, {
          status: xhr.status,
          etag: xhr.getResponseHeader("ETag"),
        });
        return;
      }

      settle(
        reject,
        new ApiError(`图片上传失败（HTTP ${xhr.status || 0}）。`, {
          status: xhr.status || 0,
          body: xhr.responseText || null,
          code: "oss_http_error",
        }),
      );
    };

    xhr.onerror = () => {
      settle(
        reject,
        new ApiError("图片上传网络异常，请稍后重试。", {
          status: xhr.status || 0,
          code: "oss_network_error",
        }),
      );
    };

    xhr.onabort = () => settle(reject, createAbortError());

    try {
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);
      signal?.addEventListener("abort", handleAbortSignal, { once: true });
      if (signal?.aborted) {
        handleAbortSignal();
        return;
      }
      xhr.send(file);
    } catch (error) {
      settle(reject, error);
    }
  });
}

export async function uploadImage(
  file,
  { filename, signal, onProgress, onStageChange } = {},
) {
  const objectName = filename ?? createUniqueImageFilename(file);
  onStageChange?.("signing");
  const presign = await fetchOssPresign(objectName, { signal });

  onStageChange?.("uploading");
  const uploadResult = await putFileToOss(presign.uploadUrl, file, {
    contentType: presign.contentType,
    signal,
    onProgress,
  });
  onStageChange?.("success");

  return {
    ...presign,
    filename: objectName,
    uploadResult,
  };
}
