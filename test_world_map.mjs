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
    `${storySource}\n${worldSource}\n;globalThis.__worldTestApi = { createDefaultStoryProgress, createLegacyStoryProgress, enterMemoryForestStory, recordForestMemoryForStory, completeWhitePageStoryEvent, completeStoryRivalDuel, completeForestRivalRescue, createWorldState, getWorldTerrain, getWorldAreaName, getActiveForestStoryNpcAt, isWorldPositionBlocked, createProfessorHouseState, isProfessorHousePositionBlocked, isProfessorHouseExitMove };`,
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

test("게임 속 세계 이름은 Wordland로 표시된다", () => {
  assert.match(html, /<em>WORDLAND<\/em>/);
  assert.match(html, /<b>WORDLAND<\/b>\s*&nbsp;\/&nbsp;\s*단어의 세계/);
  assert.match(html, /aria-label="Wordland 월드맵/);
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

test("영어박사님 집은 문 앞 모달이 아니라 이동 가능한 전용 실내 화면으로 진입한다", () => {
  assert.match(html, /id="professor-house" class="screen"/);
  assert.match(html, /id="professor-house-canvas"/);
  assert.match(html, /class="professor-house-controls"/);
  assert.match(html, /onclick="moveProfessorHouse\('up'\)"/);
  assert.match(html, /onclick="interactProfessorHouse\(\)"/);

  const enterStart = html.indexOf("function openEnglishProfessorHouse");
  const enterEnd = html.indexOf("function openEnglishProfessorDesk", enterStart);
  const enterSource = html.slice(enterStart, enterEnd);
  assert.match(enterSource, /showScreen\("professor-house"\)/);
  assert.doesNotMatch(enterSource, /\$\("panel"\)\.classList\.add\("show"\)/);
});

test("박사님 집 실내는 박사님·세 덱을 장애물로 두고 남쪽 문으로 나간다", () => {
  const api = loadWorldTestApi();
  const house = api.createProfessorHouseState();

  assert.deepEqual(
    { x: house.x, y: house.y, direction: house.direction },
    { x: 6, y: 6, direction: "up" }
  );
  assert.equal(api.isProfessorHousePositionBlocked(6, 2), true, "박사님 자리에는 들어갈 수 없다");
  assert.equal(api.isProfessorHousePositionBlocked(3, 4), true, "첫 번째 덱 진열대는 장애물이다");
  assert.equal(api.isProfessorHousePositionBlocked(6, 4), true, "두 번째 덱 진열대는 장애물이다");
  assert.equal(api.isProfessorHousePositionBlocked(9, 4), true, "세 번째 덱 진열대는 장애물이다");
  assert.equal(api.isProfessorHousePositionBlocked(5, 5), false, "가구 사이 바닥은 걸을 수 있다");
  assert.equal(api.isProfessorHouseExitMove(house, "down"), true, "시작 지점 아래가 출구다");
});

test("스타팅 덱 카드를 누르면 별도 확인 없이 즉시 5문제 시험을 시작한다", () => {
  const startIndex = html.indexOf("function selectStarterDeck");
  const endIndex = html.indexOf("function startStarterDeckExam", startIndex);
  const selectionSource = html.slice(startIndex, endIndex);

  assert.match(selectionSource, /startStarterDeckExam\(starterDeckId\)/);
  assert.doesNotMatch(selectionSource, /renderStarterDeckChoices\(\)/);
});

test("후보 덱이 저장된 사용자는 실내에서 박사님에게 말을 걸면 시험을 자동 재개한다", () => {
  const startIndex = html.indexOf("function openEnglishProfessorDesk");
  const endIndex = html.indexOf("function selectStarterDeck", startIndex);
  const professorHouseSource = html.slice(startIndex, endIndex);

  assert.match(professorHouseSource, /starterDeckCandidateId/);
  assert.match(professorHouseSource, /startStarterDeckExam\(candidateId\)/);
});

test("이미 덱이 있는 사용자는 박사님 집에서 확인 후 새 모험을 시작할 수 있다", () => {
  assert.match(html, /새 모험 시작/);
  assert.match(html, /기존 덱·도감·스토리·랭크 기록이 모두 초기화됩니다/);
  assert.match(html, /function openWordlandRestartConfirmation/);
  assert.match(html, /function confirmWordlandRestart/);
  assert.match(html, /저장 초기화하고 다시 시작/);
});

test("새 모험 확정 직후 영어박사님 집의 덱 HUD를 0장으로 다시 그린다", () => {
  const restartStart = html.indexOf("function confirmWordlandRestart");
  const restartEnd = html.indexOf("function prepareEnglishProfessorPanel", restartStart);
  const restartSource = html.slice(restartStart, restartEnd);

  assert.match(restartSource, /S\.deck = \[\]/);
  assert.match(restartSource, /renderProfessorHouseInterior\(\)/);
  assert.ok(
    restartSource.indexOf("renderProfessorHouseInterior()") <
      restartSource.indexOf("renderStoryPrologueScene(0)"),
    "빈 덱 상태를 프롤로그보다 먼저 실내 HUD에 반영해야 한다"
  );
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

test("기억의 숲에서 미복구 주민과 숲 중심 라이벌이 진행도에 따라 길을 막는다", () => {
  const api = loadWorldTestApi();
  let story = api.enterMemoryForestStory(api.createLegacyStoryProgress());

  assert.equal(api.getActiveForestStoryNpcAt(23, 10, story).memoryId, "bread");
  assert.equal(api.isWorldPositionBlocked(23, 10, story), true);
  story = api.recordForestMemoryForStory(story, "bread");
  assert.equal(api.getActiveForestStoryNpcAt(23, 10, story), null);
  assert.equal(api.isWorldPositionBlocked(23, 10, story), false);
  story = api.recordForestMemoryForStory(story, "friend");
  story = api.recordForestMemoryForStory(story, "bridge");
  assert.equal(api.getActiveForestStoryNpcAt(28, 5, story).id, "forestRival");
  assert.equal(api.isWorldPositionBlocked(28, 5, story), true);
  const completed = api.completeForestRivalRescue(story);
  assert.equal(api.getActiveForestStoryNpcAt(28, 5, completed), null);
  assert.equal(api.isWorldPositionBlocked(28, 5, completed), false);
});

test("기억의 숲 입장·주민 회복·라이벌 구출 장면 진입점이 존재한다", () => {
  assert.match(html, /function openMemoryForestArrivalScene/);
  assert.match(html, /function openForestMemoryEncounter/);
  assert.match(html, /function openForestWordsRestoredScene/);
  assert.match(html, /function openForestCenterRivalScene/);
  assert.match(html, /function openForestChapterCompleteScene/);
});

test("숲과 명예의 언덕 지역명이 좌표에 따라 바뀐다", () => {
  const api = loadWorldTestApi();

  assert.equal(api.getWorldAreaName(24, 8), "기억의 숲");
  assert.equal(api.getWorldAreaName(32, 20), "명예의 언덕");
});
