import assert from "node:assert/strict";
import test from "node:test";
import { getYouTubeVideoId } from "./youtube.ts";

test("extracts an ID from a YouTube watch URL", () => {
  assert.equal(getYouTubeVideoId("https://www.youtube.com/watch?v=abc123"), "abc123");
});

test("extracts an ID from a youtu.be URL", () => {
  assert.equal(getYouTubeVideoId("https://youtu.be/abc123"), "abc123");
});

test("extracts an ID from an embed URL", () => {
  assert.equal(getYouTubeVideoId("https://www.youtube.com/embed/abc123"), "abc123");
});

test("does not treat YouTube search URLs as videos", () => {
  assert.equal(getYouTubeVideoId("https://www.youtube.com/results?search_query=deadlift"), null);
});

test("returns null for missing and malformed URLs", () => {
  assert.equal(getYouTubeVideoId(undefined), null);
  assert.equal(getYouTubeVideoId("not a url"), null);
  assert.equal(getYouTubeVideoId("https://youtube.com.evil.test/watch?v=abc123"), null);
});

test("preserves the video ID when a URL has additional parameters", () => {
  assert.equal(
    getYouTubeVideoId("https://www.youtube.com/watch?v=abc123&list=playlist123&t=30"),
    "abc123",
  );
});
