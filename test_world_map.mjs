import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

function loadWorldTestApi() {
  const storyStartMarker = "/* STORY PROGRESSION LOGIC START */";
  const storyEndMarker = "/* STORY PROGRESSION LOGIC END */";
  const storyStartIndex = html.indexOf(storyStartMarker);
  const storyEndIndex = html.indexOf(storyEndMarker);
  const startMarker = "/* WORLD MAP LOGIC START */";
  const endMarker = "/* WORLD MAP LOGIC END */";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  assert.notEqual(startIndex, -1, "월드맵 로직 시작 표식이 있어야 한다");
  assert.notEqual(endIndex, -1, "월드맵 로직 종료 표식이 있어야 한다");
  assert.notEqual(storyStartIndex, -1, "스토리 진행 로직 시작 표식이 있어야 한다");
  assert.notEqual(storyEndIndex, -1, "스토리 진행 로직 종료 표식이 있어야 한다");

  const storySource = html.slice(storyStartIndex, storyEndIndex + storyEndMarker.length);
  const worldSource = html.slice(startIndex, endIndex + endMarker.length);
  const sandbox = {};
  vm.runInNewContext(
    `${storySource}\n${worldSource}\n;globalThis.__worldTestApi = { createDefaultStoryProgress, completeWhitePageStoryEvent, completeStoryRivalDuel, createWorldState, getWorldTerrain, getWorldAreaName, isWorldPositionBlocked };`,
    sandbox
  );
  return sandbox.__worldTestApi;
}

test("맵 화면에 캔버스와 방향 조작 버튼이 존재한다", () => {
  assert.equal(html.includes('id="world-canvas"'), true, "월드맵 캔버스가 있어야 한다");
  assert.equal(html.includes('class="world-controls"'), true, "방향 조작 버튼 묶음이 있어야 한다");
  assert.equal(html.includes('aria-label="위로 이동"'), true, "위쪽 이동 버튼이 있어야 한다");
  assert.equal(html.includes('aria-label="상호작용"'), true, "상호작용 버튼이 있어야 한다");
});

test("맵 화면에서 현재 덱을 여는 버튼을 제공한다", () => {
  assert.match(html, /id="deck-view-button"/);
  assert.match(html, /onclick="openDeckViewer\(\)"/);
  assert.equal(html.includes('>내 덱 <span id="deck-view-count">'), true);
});

test("새싹마을의 집은 영어박사님 집이며 내부에서 세 스타팅 덱을 고른다", () => {
  assert.match(html, /id: "professor", label: "영어박사님 집"/);
  assert.doesNotMatch(html, /label: "나의 집"/);
  assert.match(html, /function openEnglishProfessorHouse/);
  assert.match(html, /function renderStarterDeckChoices/);
  assert.match(html, /function startStarterDeckExam/);
  assert.match(html, /function submitStarterDeckExamAnswer/);
  assert.match(html, /function finishStarterDeckExam/);
  assert.match(html, /선택은 확정되었습니다/);
  assert.match(html, /function confirmStarterDeckChoice/);
  assert.match(html, /function chooseDifferentStarterDeckAfterPass/);
  assert.match(html, /이 덱으로 시작/);
  assert.match(html, /다른 덱 고르기/);
});

test("플레이어 시작 지점은 걸을 수 있는 새싹마을 길이다", () => {
  const api = loadWorldTestApi();
  const initialWorld = api.createWorldState();

  assert.equal(api.getWorldAreaName(initialWorld.x, initialWorld.y), "새싹마을");
  assert.equal(api.isWorldPositionBlocked(initialWorld.x, initialWorld.y), false);
});

test("물과 건물은 막고 길과 다리는 통과시킨다", () => {
  const api = loadWorldTestApi();
  const lockedStory = api.createDefaultStoryProgress();
  const routeStory = api.completeWhitePageStoryEvent({
    chapter: 1,
    questId: "confront_white_page",
    questProgress: 3,
    flags: {
      prologueSeen: true, starterChosen: true, villageRestored: true,
      whitePageSeen: false, routeUnlocked: false, rivalBattleCompleted: false
    }
  });
  const completedStory = api.completeStoryRivalDuel(routeStory);

  assert.equal(api.getWorldTerrain(0, 0), "water");
  assert.equal(api.isWorldPositionBlocked(0, 0), true);
  assert.equal(api.getWorldTerrain(8, 14), "path");
  assert.equal(api.isWorldPositionBlocked(8, 14), false);
  assert.equal(api.getWorldTerrain(17, 13), "bridge");
  assert.equal(api.isWorldPositionBlocked(17, 13, lockedStory), true);
  assert.equal(api.isWorldPositionBlocked(17, 13, routeStory), false);
  assert.equal(api.isWorldPositionBlocked(21, 13, routeStory), true);
  assert.equal(api.isWorldPositionBlocked(21, 13, completedStory), false);
  assert.equal(api.isWorldPositionBlocked(4, 4), true);
  assert.equal(api.isWorldPositionBlocked(26, 18), false);
  assert.equal(api.isWorldPositionBlocked(32, 22), true);
  assert.equal(api.isWorldPositionBlocked(32, 23), false);
});

test("새싹마을에는 1번 길 해금 전에 첫 단어를 포획할 튜토리얼 풀숲이 있다", () => {
  const api = loadWorldTestApi();

  assert.equal(api.getWorldTerrain(10, 17), "tallGrass");
  assert.equal(api.getWorldAreaName(10, 17), "새싹마을");
});

test("프롤로그·백지단·첫 라이벌 비랭크 대결 진입점이 존재한다", () => {
  assert.match(html, /function renderStoryPrologueScene/);
  assert.match(html, /function openWhitePageStoryEvent/);
  assert.match(html, /function openStoryRivalEncounter/);
  assert.match(html, /function startStoryRivalDuel/);
  assert.match(html, /mode: "story-rival"/);
});

test("숲과 명예의 언덕 지역명이 좌표에 따라 바뀐다", () => {
  const api = loadWorldTestApi();

  assert.equal(api.getWorldAreaName(24, 8), "기억의 숲");
  assert.equal(api.getWorldAreaName(32, 20), "명예의 언덕");
});
