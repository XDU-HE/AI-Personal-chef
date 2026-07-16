import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError } from "../api/client.js";
import { uploadImage } from "../api/oss.js";
import {
  ImageValidationError,
  validateImageFile,
} from "../utils/image.js";

function fileFromInput(input) {
  return input?.target?.files?.[0] ?? input ?? null;
}

function readableError(error) {
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return "图片上传失败，请稍后重试。";
}

export function useImageUpload() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState("idle");
  const [error, setError] = useState(null);
  const uploadControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const urlApi = globalThis.URL;
    if (!selectedImage || typeof urlApi?.createObjectURL !== "function") {
      setImagePreviewUrl(null);
      return undefined;
    }

    const previewUrl = urlApi.createObjectURL(selectedImage);
    setImagePreviewUrl(previewUrl);
    return () => urlApi.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      uploadControllerRef.current?.abort();
    },
    [],
  );

  const cancelCurrentUpload = useCallback(() => {
    requestIdRef.current += 1;
    uploadControllerRef.current?.abort();
    uploadControllerRef.current = null;
  }, []);

  const selectImage = useCallback(
    (input) => {
      const file = fileFromInput(input);
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setUploadState("error");
        return { ok: false, error: validation.error, code: validation.code };
      }

      cancelCurrentUpload();
      setSelectedImage(file);
      setImagePreviewUrl(null);
      setUploadProgress(0);
      setUploadState("ready");
      setError(null);
      return { ok: true, file };
    },
    [cancelCurrentUpload],
  );

  const removeImage = useCallback(() => {
    cancelCurrentUpload();
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setUploadProgress(0);
    setUploadState("idle");
    setError(null);
  }, [cancelCurrentUpload]);

  const uploadSelectedImage = useCallback(
    async ({ signal } = {}) => {
      const validation = validateImageFile(selectedImage);
      if (!validation.valid) {
        const validationError = new ImageValidationError(validation.error, validation.code);
        setUploadState("error");
        setError(validation.error);
        throw validationError;
      }

      cancelCurrentUpload();
      const requestId = requestIdRef.current;
      const controller = new AbortController();
      uploadControllerRef.current = controller;

      const abortFromCaller = () => controller.abort(signal?.reason);
      if (signal?.aborted) {
        abortFromCaller();
      } else {
        signal?.addEventListener("abort", abortFromCaller, { once: true });
      }

      setUploadProgress(0);
      setUploadState("signing");
      setError(null);

      try {
        const result = await uploadImage(selectedImage, {
          signal: controller.signal,
          onStageChange: (stage) => {
            if (requestIdRef.current === requestId) {
              setUploadState(stage);
            }
          },
          onProgress: (progress) => {
            if (requestIdRef.current === requestId) {
              setUploadState("uploading");
              setUploadProgress(progress);
            }
          },
        });

        if (requestIdRef.current === requestId) {
          setUploadProgress(100);
          setUploadState("success");
          setError(null);
        }
        return result.accessUrl;
      } catch (uploadError) {
        if (requestIdRef.current === requestId) {
          if (isAbortError(uploadError)) {
            setUploadProgress(0);
            setUploadState("ready");
          } else {
            setUploadState("error");
            setError(readableError(uploadError));
          }
        }
        throw uploadError;
      } finally {
        signal?.removeEventListener("abort", abortFromCaller);
        if (requestIdRef.current === requestId) {
          uploadControllerRef.current = null;
        }
      }
    },
    [cancelCurrentUpload, selectedImage],
  );

  const resetUploadError = useCallback(() => {
    setError(null);
    setUploadState((currentState) => {
      if (currentState !== "error") {
        return currentState;
      }
      return selectedImage ? "ready" : "idle";
    });
  }, [selectedImage]);

  return {
    selectedImage,
    imagePreviewUrl,
    uploadProgress,
    uploadState,
    error,
    selectImage,
    removeImage,
    uploadSelectedImage,
    resetUploadError,
  };
}
