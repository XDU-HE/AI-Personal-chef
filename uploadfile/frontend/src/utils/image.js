import { createUuid } from "./uuid.js";

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
});
export const IMAGE_ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_IMAGE_TYPES).join(",");

export class ImageValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ImageValidationError";
    this.code = code;
  }
}

export function validateImageFile(file) {
  if (!file || typeof file !== "object") {
    return { valid: false, code: "missing_file", error: "请选择一张图片。" };
  }

  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const extension = ACCEPTED_IMAGE_TYPES[type];
  if (!extension) {
    return {
      valid: false,
      code: "unsupported_type",
      error: "仅支持 JPEG、PNG、GIF 或 WebP 图片。",
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, code: "empty_file", error: "图片文件为空或无法读取。" };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      code: "file_too_large",
      error: "图片不能超过 10 MB。",
    };
  }

  return { valid: true, code: null, error: null, extension, type };
}

export function assertValidImageFile(file) {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new ImageValidationError(validation.error, validation.code);
  }
  return validation;
}

export function createUniqueImageFilename(file) {
  const { extension } = assertValidImageFile(file);
  return `${createUuid()}.${extension}`;
}
