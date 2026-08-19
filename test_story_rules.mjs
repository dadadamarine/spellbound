import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

function loadStoryTestApi() {
  const startMarker = "/* STORY PROGRESSION LOGIC START */";
  const endMarker = "/* STORY PROGRESSION LOGIC END */";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  assert.notEqual(startIndex, -1, "스토리 진행 로직 시작 표식이 있어야 한다");
  assert.notEqual(endIndex, -1, "스토리 진행 로직 종료 표식이 있어야 한다");

  const source = html.slice(startIndex, endIndex + endMarker.length);
  const sandbox = {};
  vm.runInNewContext(
    `${source}\n;globalThis.__storyTestApi = { createDefaultStoryProgress, createLegacyStoryProgress, sanitizeStoryProgress, markStoryPrologueSeen, startFirstCaptureQuest, recordFirstCaptureForStory, completeWhitePageStoryEvent, completeStoryRivalDuel, isStoryRouteUnlocked, shouldShowStoryRival, getStoryObjective, getVillageSignText };`,
    sandbox
  );
  return sandbox.__storyTestApi;
}

test("새 사용자는 영어박사님 프롤로그 방문부터 시작한다", () => {
  const api = loadStoryTestApi();
  const story = api.createDefaultStoryProgress();

  assert.equal(story.chapter, 0);
  assert.equal(story.questId, "meet_professor");
  assert.equal(story.questProgress, 0);
  assert.equal(story.flags.prologueSeen, false);
  assert.equal(api.getStoryObjective(story), "영어박사님 집에서 사라진 편지를 확인하세요.");
});

test("프롤로그와 스타팅 덱 확정 후 신규 단어 3장 퀘스트가 시작된다", () => {
  const api = loadStoryTestApi();
  const afterPrologue = api.markStoryPrologueSeen(api.createDefaultStoryProgress());
  const story = api.startFirstCaptureQuest(afterPrologue);

  assert.equal(afterPrologue.questId, "choose_starter");
  assert.equal(story.chapter, 1);
  assert.equal(story.questId, "capture_first_three");
  assert.equal(story.flags.starterChosen, true);
  assert.match(api.getStoryObjective(story), /0 \/ 3/);
});

test("이미 가진 단어는 제외하고 신규 포획만 3장까지 진행된다", () => {
  const api = loadStoryTestApi();
  const started = api.startFirstCaptureQuest(api.markStoryPrologueSeen(api.createDefaultStoryProgress()));
  const duplicate = api.recordFirstCaptureForStory(started, false);
  const first = api.recordFirstCaptureForStory(duplicate, true);
  const second = api.recordFirstCaptureForStory(first, true);
  const third = api.recordFirstCaptureForStory(second, true);
  const extra = api.recordFirstCaptureForStory(third, true);

  assert.equal(duplicate.questProgress, 0);
  assert.equal(first.questProgress, 1);
  assert.equal(second.questProgress, 2);
  assert.equal(third.questProgress, 3);
  assert.equal(third.flags.villageRestored, true);
  assert.equal(extra.questProgress, 3);
  assert.equal(api.isStoryRouteUnlocked(third), false);
});

test("마을 복구 후 백지단 사건을 확인해야 1번 길이 열린다", () => {
  const api = loadStoryTestApi();
  let story = api.startFirstCaptureQuest(api.markStoryPrologueSeen(api.createDefaultStoryProgress()));
  story = api.recordFirstCaptureForStory(story, true);
  story = api.recordFirstCaptureForStory(story, true);
  story = api.recordFirstCaptureForStory(story, true);
  const unlocked = api.completeWhitePageStoryEvent(story);

  assert.equal(story.questId, "confront_white_page");
  assert.equal(api.isStoryRouteUnlocked(story), false);
  assert.equal(unlocked.questId, "meet_rival");
  assert.equal(unlocked.flags.whitePageSeen, true);
  assert.equal(api.isStoryRouteUnlocked(unlocked), true);
  assert.equal(api.shouldShowStoryRival(unlocked), true);
});

test("첫 라이벌 대결 완료 후 라이벌 장벽이 사라지고 기억의 숲이 목적지가 된다", () => {
  const api = loadStoryTestApi();
  const unlocked = api.completeWhitePageStoryEvent({
    chapter: 1,
    questId: "confront_white_page",
    questProgress: 3,
    flags: {
      prologueSeen: true,
      starterChosen: true,
      villageRestored: true,
      whitePageSeen: false,
      routeUnlocked: false,
      rivalBattleCompleted: false
    }
  });
  const completed = api.completeStoryRivalDuel(unlocked);

  assert.equal(completed.chapter, 2);
  assert.equal(completed.questId, "enter_memory_forest");
  assert.equal(completed.flags.rivalBattleCompleted, true);
  assert.equal(api.shouldShowStoryRival(completed), false);
  assert.match(api.getStoryObjective(completed), /기억의 숲/);
});

test("마을 표지판은 첫 포획 진행도에 맞춰 단계적으로 복구된다", () => {
  const api = loadStoryTestApi();
  const base = api.startFirstCaptureQuest(api.markStoryPrologueSeen(api.createDefaultStoryProgress()));

  assert.equal(api.getVillageSignText(base), "Welcome to ____ Town.");
  assert.equal(api.getVillageSignText({ ...base, questProgress: 1 }), "Welcome to S____ Town.");
  assert.equal(api.getVillageSignText({ ...base, questProgress: 2 }), "Welcome to Sprout ____.");
  assert.equal(api.getVillageSignText({ ...base, questProgress: 3 }), "Welcome to Sprout Town.");
});

test("기존 저장 사용자는 새 스토리 장벽으로 기존 월드 진행이 막히지 않는다", () => {
  const api = loadStoryTestApi();
  const legacy = api.createLegacyStoryProgress();
  const sanitized = api.sanitizeStoryProgress(null, true);

  assert.equal(legacy.flags.routeUnlocked, true);
  assert.equal(legacy.flags.rivalBattleCompleted, true);
  assert.equal(sanitized.flags.routeUnlocked, true);
  assert.equal(sanitized.flags.rivalBattleCompleted, true);
});

