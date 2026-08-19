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
    `${source}\n;globalThis.__storyTestApi = { createDefaultStoryProgress, createLegacyStoryProgress, sanitizeStoryProgress, markStoryPrologueSeen, startFirstCaptureQuest, recordFirstCaptureForStory, completeWhitePageStoryEvent, completeStoryRivalDuel, enterMemoryForestStory, recordForestMemoryForStory, completeForestRivalRescue, isStoryRouteUnlocked, shouldShowStoryRival, shouldShowForestResident, shouldShowForestCenterRival, getStoryObjective, getVillageSignText };`,
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

test("기억의 숲에 입장하면 세 주민의 사라진 단어 복구가 시작된다", () => {
  const api = loadStoryTestApi();
  const afterRival = api.completeStoryRivalDuel(api.completeWhitePageStoryEvent({
    chapter: 1,
    questId: "confront_white_page",
    questProgress: 3,
    flags: {
      prologueSeen: true, starterChosen: true, villageRestored: true,
      whitePageSeen: false, routeUnlocked: false, rivalBattleCompleted: false
    }
  }));
  const entered = api.enterMemoryForestStory(afterRival);

  assert.equal(entered.questId, "restore_forest_words");
  assert.equal(entered.flags.forestArrivalSeen, true);
  assert.deepEqual(Array.from(entered.forestRecoveredWords), []);
  assert.equal(api.shouldShowForestResident(entered, "bread"), true);
  assert.match(api.getStoryObjective(entered), /0 \/ 3/);
});

test("숲 주민의 bread·friend·bridge는 중복 없이 한 번씩만 복구된다", () => {
  const api = loadStoryTestApi();
  const entered = api.enterMemoryForestStory({
    ...api.createLegacyStoryProgress(),
    flags: { ...api.createLegacyStoryProgress().flags, rivalBattleCompleted: true }
  });
  const invalid = api.recordForestMemoryForStory(entered, "apple");
  const bread = api.recordForestMemoryForStory(invalid, "bread");
  const duplicate = api.recordForestMemoryForStory(bread, "bread");
  const friend = api.recordForestMemoryForStory(duplicate, "friend");
  const bridge = api.recordForestMemoryForStory(friend, "bridge");

  assert.deepEqual(Array.from(invalid.forestRecoveredWords), []);
  assert.deepEqual(Array.from(duplicate.forestRecoveredWords), ["bread"]);
  assert.deepEqual(Array.from(bridge.forestRecoveredWords), ["bread", "friend", "bridge"]);
  assert.equal(bridge.questId, "rescue_rival_memory");
  assert.equal(bridge.flags.forestWordsRestored, true);
  assert.equal(api.shouldShowForestResident(bridge, "bread"), false);
  assert.equal(api.shouldShowForestCenterRival(bridge), true);
});

test("라이벌의 courage 카드를 되찾으면 3장이 완료되고 박사님 집이 다음 목적지가 된다", () => {
  const api = loadStoryTestApi();
  let story = api.enterMemoryForestStory(api.createLegacyStoryProgress());
  story = api.recordForestMemoryForStory(story, "bread");
  story = api.recordForestMemoryForStory(story, "friend");
  story = api.recordForestMemoryForStory(story, "bridge");
  const completed = api.completeForestRivalRescue(story);

  assert.equal(completed.chapter, 3);
  assert.equal(completed.questId, "return_to_professor");
  assert.equal(completed.flags.forestRivalRescued, true);
  assert.equal(api.shouldShowForestCenterRival(completed), false);
  assert.match(api.getStoryObjective(completed), /영어박사님/);
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
  assert.equal(legacy.flags.forestArrivalSeen, false);
  assert.equal(legacy.flags.forestRivalRescued, false);
  assert.equal(sanitized.flags.routeUnlocked, true);
  assert.equal(sanitized.flags.rivalBattleCompleted, true);
});
