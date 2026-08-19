import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

function loadCaptureTestApi() {
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
  assert.notEqual(startIndex, -1, "단어 수집 로직 시작 표식이 있어야 한다");
  assert.notEqual(endIndex, -1, "단어 수집 로직 종료 표식이 있어야 한다");

  const dataSource = html.slice(dataStartIndex, dataEndIndex);
  const source = html.slice(startIndex, endIndex + endMarker.length);
  const sandbox = {};
  vm.runInNewContext(
    `${dataSource}\nconst GAME_LANGUAGE = "en";\n${source}\n;globalThis.__captureTestApi = { buildEncounterExample, getCaptureExamSize, getRequiredCorrectCount, canCaptureEncounter, createWordCard, addCardToDeck, addCardKeyToCollection, shouldStartWordEncounter, isCardAnswerCorrect, isTimedCardAnswerCorrect, getWordAnswerTimeLimitSeconds, createStarterDeck, createDefaultWordGameProgress, sanitizeWordGameProgress };`,
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

test("카드는 언어와 표제어 기준으로 중복 없이 추가된다", () => {
  const api = loadCaptureTestApi();
  const card = api.createWordCard(["apple", "사과", "명사"], 1, "en");
  const originalDeck = [];
  const once = api.addCardToDeck(originalDeck, card);
  const twice = api.addCardToDeck(once, card);

  assert.equal(originalDeck.length, 0);
  assert.equal(once.length, 1);
  assert.equal(twice.length, 1);
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

test("새 사용자는 중복 없는 Tier 1 쉬운 단어 50장으로 시작한다", () => {
  const api = loadCaptureTestApi();
  const progress = api.createDefaultWordGameProgress();
  const starterDeck = progress.decks.en;

  assert.equal(starterDeck.length, 50);
  assert.equal(new Set(starterDeck.map(card => card.key)).size, 50);
  assert.equal(starterDeck.every(card => card.lang === "en" && card.tier === 1), true);
  assert.equal(starterDeck.slice(0, 3).map(card => card.w).join(","), "apple,water,house");
  assert.equal(progress.collections.en.length, 50);
  assert.deepEqual(new Set(progress.collections.en), new Set(starterDeck.map(card => card.key)));
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

test("덱에서 카드를 제거해도 도감 등록은 유지된다", () => {
  const api = loadCaptureTestApi();
  const progress = api.createDefaultWordGameProgress();
  const removedFromDeck = {
    ...progress,
    decks: { en: progress.decks.en.slice(0, 49) }
  };

  const sanitized = api.sanitizeWordGameProgress(removedFromDeck);

  assert.equal(sanitized.decks.en.length, 49);
  assert.equal(sanitized.collections.en.length, 50);
});

test("구버전의 5장 저장 덱도 게임 시작 시 실제 50장 덱으로 마이그레이션한다", () => {
  const api = loadCaptureTestApi();
  const starterDeck = api.createDefaultWordGameProgress().decks.en;
  const legacyProgress = {
    version: 1,
    decks: { en: starterDeck.slice(0, 5) },
    rating: 1000,
    wins: 0,
    losses: 0,
    draws: 0
  };

  const migrated = api.sanitizeWordGameProgress(legacyProgress);

  assert.equal(migrated.version, 3);
  assert.equal(migrated.decks.en.length, 50);
  assert.equal(new Set(migrated.decks.en.map(card => card.key)).size, 50);
  assert.equal(migrated.collections.en.length, 50);
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
