import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

function loadCaptureTestApi() {
  const storyStartMarker = "/* STORY PROGRESSION LOGIC START */";
  const storyEndMarker = "/* STORY PROGRESSION LOGIC END */";
  const storyStartIndex = html.indexOf(storyStartMarker);
  const storyEndIndex = html.indexOf(storyEndMarker);
  const dataStartMarker = "/* ===== data_en.js ===== */";
  const dataEndMarker = "/* ===== data_es.js ===== */";
  const dataStartIndex = html.indexOf(dataStartMarker);
  const dataEndIndex = html.indexOf(dataEndMarker);
  const startMarker = "/* WORD COLLECTION LOGIC START */";
  const endMarker = "/* WORD COLLECTION LOGIC END */";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  assert.notEqual(dataStartIndex, -1, "영어 단어 데이터 시작 표식이 있어야 한다");
  assert.notEqual(dataEndIndex, -1, "영어 단어 데이터 종료 표식이 있어야 한다");
  assert.notEqual(storyStartIndex, -1, "스토리 진행 로직 시작 표식이 있어야 한다");
  assert.notEqual(storyEndIndex, -1, "스토리 진행 로직 종료 표식이 있어야 한다");
  assert.notEqual(startIndex, -1, "단어 수집 로직 시작 표식이 있어야 한다");
  assert.notEqual(endIndex, -1, "단어 수집 로직 종료 표식이 있어야 한다");

  const storySource = html.slice(storyStartIndex, storyEndIndex + storyEndMarker.length);
  const dataSource = html.slice(dataStartIndex, dataEndIndex);
  const source = html.slice(startIndex, endIndex + endMarker.length);
  const sandbox = {};
  vm.runInNewContext(
    `${storySource}\n${dataSource}\nconst GAME_LANGUAGE = "en";\n${source}\n;globalThis.__captureTestApi = { buildEncounterExample, getCaptureExamSize, getRequiredCorrectCount, canCaptureEncounter, createWordCard, createWordCards, getCardLemmaKey, addCardToDeck, addCardKeyToCollection, shouldStartWordEncounter, isCardAnswerCorrect, isTimedCardAnswerCorrect, getWordAnswerTimeLimitSeconds, getStarterDeckDefinitions, getStarterDeckExamSize, getStarterDeckRequiredCorrect, canClaimStarterDeck, createStarterDeck, applyStarterDeckCandidateChoice, clearStarterDeckCandidateChoice, applyStarterDeckChoice, createDefaultWordGameProgress, sanitizeWordGameProgress };`,
    sandbox
  );
  return sandbox.__captureTestApi;
}

function loadEnglishWordBank() {
  const startMarker = "/* ===== data_en.js ===== */";
  const endMarker = "/* ===== data_es.js ===== */";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  assert.notEqual(startIndex, -1, "영어 단어 데이터 시작 표식이 있어야 한다");
  assert.notEqual(endIndex, -1, "영어 단어 데이터 종료 표식이 있어야 한다");

  const source = html.slice(startIndex, endIndex);
  const sandbox = {};
  vm.runInNewContext(`${source}\n;globalThis.__wordBank = WORDS_EN;`, sandbox);
  return sandbox.__wordBank;
}

test("예문은 목표 철자를 숨기고 빈칸을 포함한다", () => {
  const api = loadCaptureTestApi();
  const englishExample = api.buildEncounterExample("apple", "en", "명사");

  assert.equal(englishExample.includes("____"), true);
  assert.equal(englishExample.toLowerCase().includes("apple"), false);
});

test("포획 복구 시험은 최대 10장이고 합격선은 90%를 올림 처리한다", () => {
  const api = loadCaptureTestApi();

  assert.equal(api.getCaptureExamSize(0), 0);
  assert.equal(api.getCaptureExamSize(4), 4);
  assert.equal(api.getCaptureExamSize(30), 10);
  assert.equal(api.getRequiredCorrectCount(4), 4);
  assert.equal(api.getRequiredCorrectCount(10), 9);
});

test("직접 정답 또는 기존 덱 시험 90% 이상일 때만 포획한다", () => {
  const api = loadCaptureTestApi();

  assert.equal(api.canCaptureEncounter(true, 0, 0), true);
  assert.equal(api.canCaptureEncounter(false, 9, 10), true);
  assert.equal(api.canCaptureEncounter(false, 8, 10), false);
  assert.equal(api.canCaptureEncounter(false, 0, 0), false);
});

test("같은 의미 카드는 중복 없이 추가된다", () => {
  const api = loadCaptureTestApi();
  const card = api.createWordCard(["apple", "사과", "명사"], 1, "en");
  const originalDeck = [];
  const once = api.addCardToDeck(originalDeck, card);
  const twice = api.addCardToDeck(once, card);

  assert.equal(originalDeck.length, 0);
  assert.equal(once.length, 1);
  assert.equal(twice.length, 1);
});

test("make는 네 뜻마다 예문 세 개를 가진 카드 12장으로 구성된다", () => {
  const api = loadCaptureTestApi();
  const makeEntry = loadEnglishWordBank()[2].find(entry => entry[0] === "make");
  const cards = api.createWordCards(makeEntry, 2, "en");

  assert.equal(cards.length, 12);
  assert.equal(new Set(cards.map(card => card.key)).size, 12);
  assert.equal(cards[0].key, "en:make");
  assert.equal(cards[1].key, "en:make:create:2");
  assert.equal(cards[3].key, "en:make:cause:1");
  assert.equal(new Set(cards.map(card => card.ko)).size, 4);
  assert.equal(cards.every(card => card.w === "make" && card.example.includes("____")), true);
  assert.equal(cards.every(card => api.getCardLemmaKey(card) === "en:make"), true);
  const examplesBySense = Map.groupBy(cards, card => card.senseId);
  assert.equal(examplesBySense.size, 4);
  assert.equal(Array.from(examplesBySense.values()).every(senseCards => senseCards.length === 3), true);
});

test("같은 표제어와 뜻이어도 예문이 다르면 덱에 함께 넣을 수 있다", () => {
  const api = loadCaptureTestApi();
  const makeEntry = loadEnglishWordBank()[2].find(entry => entry[0] === "make");
  const createCards = api.createWordCards(makeEntry, 2, "en")
    .filter(card => card.senseId === "create");
  const deck = createCards.reduce((currentDeck, card) => api.addCardToDeck(currentDeck, card), []);
  const duplicate = api.addCardToDeck(deck, createCards[0]);

  assert.equal(new Set(createCards.map(card => card.ko)).size, 1);
  assert.equal(new Set(createCards.map(card => card.example)).size, 3);
  assert.equal(deck.length, 3);
  assert.equal(duplicate.length, 3);
  assert.equal(deck.every(card => card.w === "make"), true);
});

test("영어 500단어는 뜻마다 최소 두 개의 예문 카드를 가진다", () => {
  const api = loadCaptureTestApi();
  const bank = loadEnglishWordBank();
  const entries = Object.entries(bank).flatMap(([tier, tierEntries]) =>
    tierEntries.map(entry => ({ tier: Number(tier), entry })));
  const cards = entries.flatMap(({ tier, entry }) => api.createWordCards(entry, tier, "en"));

  assert.equal(entries.length, 500);
  assert.equal(entries.every(({ tier, entry }) => api.createWordCards(entry, tier, "en").length >= 2), true);
  assert.equal(entries.every(({ tier, entry }) => {
    const entryCards = api.createWordCards(entry, tier, "en");
    return Array.from(new Set(entryCards.map(card => card.senseId))).every(senseId =>
      entryCards.filter(card => card.senseId === senseId).length >= 2);
  }), true);
  assert.equal(cards.length >= 1000, true);
  assert.equal(new Set(cards.map(card => card.key)).size, cards.length);
  assert.equal(cards.every(card => (card.example.match(/____/g) || []).length === 1), true);
  const revealedWords = cards.filter(card => {
    const escapedWord = card.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + escapedWord + "\\b", "i").test(card.example);
  }).map(card => card.w + ": " + card.example);
  assert.deepEqual(revealedWords, []);
});

test("저장 후 불러와도 같은 뜻의 서로 다른 예문 카드 키가 유지된다", () => {
  const api = loadCaptureTestApi();
  const makeEntry = loadEnglishWordBank()[2].find(entry => entry[0] === "make");
  const createCards = api.createWordCards(makeEntry, 2, "en")
    .filter(card => card.senseId === "create").slice(0, 2);
  const progress = api.sanitizeWordGameProgress({
    version: 8,
    starterDeckId: "legacy",
    decks: { en: createCards },
    collections: { en: createCards.map(card => card.key) }
  });

  assert.deepEqual(Array.from(progress.decks.en, card => card.key), ["en:make", "en:make:create:2"]);
  assert.deepEqual(Array.from(progress.collections.en), ["en:make", "en:make:create:2"]);
});

test("쉼표로 구분된 다의어는 뜻마다 구별되는 예문 카드가 있다", () => {
  const api = loadCaptureTestApi();
  const entries = Object.entries(loadEnglishWordBank()).flatMap(([tier, tierEntries]) =>
    tierEntries.filter(entry => String(entry[1]).includes(","))
      .map(entry => ({ tier: Number(tier), entry })));

  assert.equal(entries.length, 23);
  entries.forEach(({ tier, entry }) => {
    const cards = api.createWordCards(entry, tier, "en");
    const meanings = String(entry[1]).split(/\s*,\s*/);
    assert.equal(new Set(cards.map(card => card.senseId)).size, meanings.length, entry[0]);
    assert.deepEqual(new Set(cards.map(card => card.ko)), new Set(meanings), entry[0]);
    meanings.forEach(meaning => {
      const examples = cards.filter(card => card.ko === meaning).map(card => card.example);
      assert.equal(examples.length >= 2, true, entry[0] + ": " + meaning);
      assert.equal(new Set(examples).size, examples.length, entry[0] + ": " + meaning);
    });
  });
});

test("풀숲·쿨다운·확률 조건을 모두 만족할 때만 조우한다", () => {
  const api = loadCaptureTestApi();

  assert.equal(api.shouldStartWordEncounter("grass", 10, 0, 0.01), false);
  assert.equal(api.shouldStartWordEncounter("tallGrass", 2, 0, 0.01), false);
  assert.equal(api.shouldStartWordEncounter("tallGrass", 8, 0, 0.50), false);
  assert.equal(api.shouldStartWordEncounter("tallGrass", 8, 0, 0.01), true);
});

test("영어 정답은 대소문자와 앞뒤 공백을 무시한다", () => {
  const api = loadCaptureTestApi();

  assert.equal(api.isCardAnswerCorrect("APPLE", "apple", false), true);
  assert.equal(api.isCardAnswerCorrect("  apple  ", "apple", false), true);
  assert.equal(api.isCardAnswerCorrect("apples", "apple", false), false);
});

test("모든 단어 입력 제한시간은 일반 단어 기준 7초다", () => {
  const api = loadCaptureTestApi();
  const card = api.createWordCard(["apple", "사과", "명사"], 1, "en");

  assert.equal(api.getWordAnswerTimeLimitSeconds(), 7);
  assert.equal(api.isTimedCardAnswerCorrect("apple", card, false, false), true);
  assert.equal(api.isTimedCardAnswerCorrect("apple", card, true, false), false);
});

test("입력 제한시간은 남은 시간에 따라 줄어드는 게이지로 표시한다", () => {
  assert.match(html, /id="word-answer-timer-fill"/);
  assert.match(html, /\.collection-timer-fill/);
  assert.match(html, /fill\.style\.width\s*=\s*remainingRatio/);
});

test("기억의 숲 NPC 단어는 직접 정답과 90% 복구 시험 모두 같은 스토리 진행으로 연결된다", () => {
  assert.match(html, /forestMemoryId/);
  assert.match(html, /recordForestMemoryForStory\(S\.wordGameProgress\.story/);
  assert.match(html, /openForestChapterCompleteScene/);
});

test("새 사용자는 영어박사님 집에서 스타팅 덱을 고르기 전 빈 덱으로 시작한다", () => {
  const api = loadCaptureTestApi();
  const progress = api.createDefaultWordGameProgress();

  assert.equal(progress.starterDeckId, null);
  assert.equal(progress.starterDeckCandidateId, null);
  assert.equal(progress.decks.en.length, 0);
  assert.equal(progress.collections.en.length, 0);
});

test("영어박사님이 제시하는 세 스타팅 덱은 서로 겹치지 않는 Tier 1 카드 25장이다", () => {
  const api = loadCaptureTestApi();
  const definitions = api.getStarterDeckDefinitions();
  const decks = definitions.map(definition => api.createStarterDeck(loadEnglishWordBank(), "en", definition.id));

  assert.equal(definitions.length, 3);
  decks.forEach(deck => {
    assert.equal(deck.length, 25);
    assert.equal(new Set(deck.map(card => card.key)).size, 25);
    assert.equal(deck.every(card => card.lang === "en" && card.tier === 1), true);
  });
  assert.equal(new Set(decks.flat().map(card => card.key)).size, 75);
  assert.equal(decks.map(deck => deck[0].w).join(","), "apple,family,bridge");
});

test("스타팅 덱을 확정하면 선택한 25장만 덱과 도감에 등록된다", () => {
  const api = loadCaptureTestApi();
  const initialProgress = api.applyStarterDeckCandidateChoice(
    api.createDefaultWordGameProgress(), "adventure"
  );
  const selected = api.applyStarterDeckChoice(initialProgress, loadEnglishWordBank(), "en", "adventure");

  assert.equal(selected.starterDeckId, "adventure");
  assert.equal(selected.starterDeckCandidateId, "adventure");
  assert.equal(selected.decks.en.length, 25);
  assert.equal(selected.collections.en.length, 25);
  assert.equal(selected.decks.en[0].w, "bridge");
  assert.deepEqual(new Set(selected.collections.en), new Set(selected.decks.en.map(card => card.key)));
});

test("스타팅 덱을 한 번 고르면 실패하거나 다시 불러와도 다른 덱으로 변경할 수 없다", () => {
  const api = loadCaptureTestApi();
  const initialProgress = api.createDefaultWordGameProgress();
  const dailyChoice = api.applyStarterDeckCandidateChoice(initialProgress, "daily");
  const switchAttempt = api.applyStarterDeckCandidateChoice(dailyChoice, "adventure");
  const reloaded = api.sanitizeWordGameProgress(switchAttempt);
  const wrongDeckClaim = api.applyStarterDeckChoice(reloaded, loadEnglishWordBank(), "en", "adventure");

  assert.equal(dailyChoice.starterDeckCandidateId, "daily");
  assert.equal(dailyChoice.decks.en.length, 0);
  assert.equal(switchAttempt.starterDeckCandidateId, "daily");
  assert.equal(reloaded.starterDeckCandidateId, "daily");
  assert.equal(wrongDeckClaim.starterDeckId, null);
  assert.equal(wrongDeckClaim.decks.en.length, 0);
});

test("시험 통과 후 덱을 거절하면 후보 선택을 해제하고 다른 덱을 고를 수 있다", () => {
  const api = loadCaptureTestApi();
  const dailyChoice = api.applyStarterDeckCandidateChoice(api.createDefaultWordGameProgress(), "daily");
  const declined = api.clearStarterDeckCandidateChoice(dailyChoice);
  const adventureChoice = api.applyStarterDeckCandidateChoice(declined, "adventure");

  assert.equal(declined.starterDeckCandidateId, null);
  assert.equal(declined.decks.en.length, 0);
  assert.equal(adventureChoice.starterDeckCandidateId, "adventure");
});

test("스타팅 덱 시험은 선택한 25장의 20%인 5장을 출제하고 4문제 이상 맞혀야 통과한다", () => {
  const api = loadCaptureTestApi();

  assert.equal(api.getStarterDeckExamSize(25), 5);
  assert.equal(api.getStarterDeckRequiredCorrect(5), 4);
  assert.equal(api.canClaimStarterDeck(4, 5), true);
  assert.equal(api.canClaimStarterDeck(3, 5), false);
});

test("포획한 카드는 도감에 중복 없이 등록된다", () => {
  const api = loadCaptureTestApi();
  const card = api.createWordCard(["apple", "사과", "명사"], 1, "en");
  const originalCollection = [];
  const registered = api.addCardKeyToCollection(originalCollection, card);
  const duplicate = api.addCardKeyToCollection(registered, card);

  assert.deepEqual(originalCollection, []);
  assert.deepEqual(registered, ["en:apple"]);
  assert.deepEqual(duplicate, ["en:apple"]);
});

test("도감은 같은 표제어의 예문 카드를 뜻별로 묶어서 보여준다", () => {
  const api = loadCaptureTestApi();
  const makeEntry = loadEnglishWordBank()[2].find(entry => entry[0] === "make");
  const cards = api.createWordCards(makeEntry, 2, "en");
  const keys = cards.reduce((collection, card) => api.addCardKeyToCollection(collection, card), []);

  assert.equal(keys.length, 12);
  assert.equal(new Set(keys).size, 12);
  assert.match(html, /function openCollectionViewer/);
  assert.match(html, /예문 카드/);
  assert.match(html, /onclick="openCollectionViewer\(\)"/);
});

test("덱에서 카드를 제거해도 도감 등록은 유지된다", () => {
  const api = loadCaptureTestApi();
  const progress = api.applyStarterDeckChoice(
    api.applyStarterDeckCandidateChoice(api.createDefaultWordGameProgress(), "daily"),
    loadEnglishWordBank(), "en", "daily"
  );
  const removedFromDeck = {
    ...progress,
    decks: { en: progress.decks.en.slice(0, 24) }
  };

  const sanitized = api.sanitizeWordGameProgress(removedFromDeck);

  assert.equal(sanitized.decks.en.length, 24);
  assert.equal(sanitized.collections.en.length, 25);
});

test("구버전의 5장 저장 덱도 게임 시작 시 실제 50장 덱으로 마이그레이션한다", () => {
  const api = loadCaptureTestApi();
  const starterDeck = api.createStarterDeck(loadEnglishWordBank(), "en", "daily");
  const legacyProgress = {
    version: 1,
    decks: { en: starterDeck.slice(0, 5) },
    rating: 1000,
    wins: 0,
    losses: 0,
    draws: 0
  };

  const migrated = api.sanitizeWordGameProgress(legacyProgress);

  assert.equal(migrated.version, 8);
  assert.equal(migrated.decks.en.length, 50);
  assert.equal(new Set(migrated.decks.en.map(card => card.key)).size, 50);
  assert.equal(migrated.collections.en.length, 50);
  assert.equal(migrated.starterDeckId, "legacy");
  assert.equal(migrated.story.flags.routeUnlocked, true);
  assert.equal(migrated.story.flags.rivalBattleCompleted, true);
});

test("Tier 5 장문 단어 2개는 고유 예문과 허용 철자를 가진다", () => {
  const api = loadCaptureTestApi();
  const bank = loadEnglishWordBank();
  const allEntries = Object.values(bank).flat();
  const lungWord = bank[5].find(entry => entry[0] === "pneumonoultramicroscopicsilicovolcanoconiosis");
  const longWordFear = bank[5].find(entry => entry[0] === "hippopotomonstrosesquipedaliophobia");

  assert.equal(allEntries.length, 500);
  assert.ok(lungWord);
  assert.ok(longWordFear);

  const lungCard = api.createWordCard(lungWord, 5, "en");
  const fearCard = api.createWordCard(longWordFear, 5, "en");
  assert.match(lungCard.example, /____/);
  assert.match(fearCard.example, /____/);
  assert.equal(lungCard.example.toLowerCase().includes(lungCard.w), false);
  assert.equal(fearCard.example.toLowerCase().includes(fearCard.w), false);
  assert.equal(
    api.isCardAnswerCorrect("hippopotomonstrosesquippedaliophobia", fearCard.w, false, fearCard.acceptedAnswers),
    true
  );
});

test("설정과 런타임 진입점은 영어 500단어 전용이다", () => {
  const settingsStart = html.indexOf('<!-- ============ 설정 ============ -->');
  const settingsEnd = html.indexOf('<!-- ============ MAP ============ -->');
  const settingsMarkup = html.slice(settingsStart, settingsEnd);

  assert.match(settingsMarkup, /ENGLISH/);
  assert.match(settingsMarkup, /영어 500단어/);
  assert.doesNotMatch(settingsMarkup, /ESPAÑOL|lang-es|pickLang\('es'\)/);
  assert.match(html, /const GAME_LANGUAGE = "en";/);
  assert.match(html, /let LANG = GAME_LANGUAGE/);
});
