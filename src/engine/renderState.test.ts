import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW_CAMERA_ID } from "../core/trackTarget";
import { getViewCamera, getViewCameraId } from "./renderState";

describe("getViewCamera / getViewCameraId", () => {
  it("prefers main-cam when present", () => {
    const cameras = {
      "other-cam": { id: "other-cam", centerX: 0, centerY: 0, halfWidth: 1 },
      [DEFAULT_VIEW_CAMERA_ID]: {
        id: DEFAULT_VIEW_CAMERA_ID,
        centerX: 1,
        centerY: 2,
        halfWidth: 3,
      },
    };
    expect(getViewCameraId(cameras)).toBe(DEFAULT_VIEW_CAMERA_ID);
    expect(getViewCamera(cameras)?.centerX).toBe(1);
  });

  it("falls back to the first key when main-cam is missing", () => {
    const cameras = {
      alpha: { id: "alpha", centerX: 4, centerY: 0, halfWidth: 2 },
    };
    expect(getViewCameraId(cameras)).toBe("alpha");
    expect(getViewCamera(cameras)?.halfWidth).toBe(2);
  });
});
