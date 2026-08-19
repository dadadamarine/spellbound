import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

function loadFacilityTestApi() {
  const startMarker = "/* FACILITY GAME LOGIC START */";
  const endMarker = "/* FACILITY GAME LOGIC END */";
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  assert.notEqual(startIndex, -1, "시설 게임 로직 시작 표식이 있어야 한다");
  assert.notEqual(endIndex, -1, "시설 게임 로직 종료 표식이 있어야 한다");

  const source = html.slice(startIndex, endIndex + endMarker.length);
  const sandbox = {
    getRankFromRating(rating) {
      if (rating >= 1800) return "MASTER";
      if (rating >= 1600) return "PLATINUM";
      if (rating >= 1400) return "GOLD";
      if (rating >= 1200) return "SILVER";
      return "BRONZE";
    }
  };
  vm.runInNewContext(
    `${source}\n;globalThis.__facilityTestApi = { canStartCardCleanup, getCardCleanupQuestionCount, getCardCleanupRequiredCorrect, getCorrectCleanupCards, removeCardFromDeck, canStartHallDuel, getDuelOutcome, getOpponentDuelOutcome, calculateRatingAfterDuel, getMatchedOpponentRating, createHallUser, createMockHallUser, doesHallUserAnswerCorrectly, getMockHallSubmittedAnswer };`,
    sandbox
  );
  return sandbox.__facilityTestApi;
}

test("카드정리소 시험은 덱 50장부터 시작할 수 있다", () => {
  const api = loadFacilityTestApi();

  assert.equal(api.canStartCardCleanup(49), false);
  assert.equal(api.canStartCardCleanup(50), true);
  assert.equal(api.canStartCardCleanup(80), true);
});

test("카드정리소는 현재 덱의 10%를 무작위 시험으로 출제한다", () => {
  const api = loadFacilityTestApi();

  assert.equal(api.getCardCleanupQuestionCount(50), 5);
  assert.equal(api.getCardCleanupQuestionCount(51), 6);
  assert.equal(api.getCardCleanupQuestionCount(100), 10);
  assert.equal(api.getCardCleanupRequiredCorrect(5), 4);
  assert.equal(api.getCardCleanupRequiredCorrect(10), 8);
});

test("카드정리소는 합격 조건을 정답률 80%로 안내한다", () => {
  assert.match(html, /시험 정답률이 80% 이상이면/);
  assert.match(html, /통과 기준 80%/);
});

test("정답 처리한 카드만 제거 후보가 된다", () => {
  const api = loadFacilityTestApi();
  const cards = [
    { key: "en:apple", w: "apple" },
    { key: "en:water", w: "water" },
    { key: "en:house", w: "house" }
  ];
  const results = [
    { key: "en:apple", correct: true },
    { key: "en:water", correct: false },
    { key: "en:house", correct: true }
  ];

  assert.deepEqual(
    api.getCorrectCleanupCards(cards, results).map(card => card.key),
    ["en:apple", "en:house"]
  );
});

test("선택한 카드 한 장만 제거하고 기존 덱은 변경하지 않는다", () => {
  const api = loadFacilityTestApi();
  const deck = [
    { key: "en:apple" },
    { key: "en:water" },
    { key: "en:house" }
  ];

  const nextDeck = api.removeCardFromDeck(deck, "en:water");
  assert.deepEqual(deck.map(card => card.key), ["en:apple", "en:water", "en:house"]);
  assert.deepEqual(nextDeck.map(card => card.key), ["en:apple", "en:house"]);
});

test("명예의 전당은 5라운드 수행에 충분한 카드를 가졌을 때 입장한다", () => {
  const api = loadFacilityTestApi();

  assert.equal(api.canStartHallDuel(4), false);
  assert.equal(api.canStartHallDuel(24), false);
  assert.equal(api.canStartHallDuel(25), true);
});

test("5라운드 정답 수로 승리·무승부·패배를 판정한다", () => {
  const api = loadFacilityTestApi();

  assert.equal(api.getDuelOutcome(4, 3), "win");
  assert.equal(api.getDuelOutcome(3, 3), "draw");
  assert.equal(api.getDuelOutcome(2, 4), "loss");
  assert.equal(api.getOpponentDuelOutcome("win"), "loss");
  assert.equal(api.getOpponentDuelOutcome("loss"), "win");
  assert.equal(api.getOpponentDuelOutcome("draw"), "draw");
});

test("승패는 25점, 무승부는 양쪽 모두 10점 올리고 0 아래로 내리지 않는다", () => {
  const api = loadFacilityTestApi();

  assert.equal(api.calculateRatingAfterDuel(1000, "win"), 1025);
  assert.equal(api.calculateRatingAfterDuel(1000, "draw"), 1010);
  assert.equal(api.calculateRatingAfterDuel(1000, "loss"), 975);
  assert.equal(api.calculateRatingAfterDuel(10, "loss"), 0);
});

test("매칭 상대 레이팅은 내 점수에서 40점 이내다", () => {
  const api = loadFacilityTestApi();

  assert.equal(api.getMatchedOpponentRating(1000, 0), 960);
  assert.equal(api.getMatchedOpponentRating(1000, 0.5), 1000);
  assert.equal(api.getMatchedOpponentRating(1000, 1), 1040);
});

test("플레이어와 매칭 상대는 공통 User 구조체를 사용한다", () => {
  const api = loadFacilityTestApi();
  const deck = [{ key: "en:apple" }];
  const user = api.createHallUser({
    id: "player-local",
    displayName: "YOU",
    rating: 1000,
    deck
  });

  assert.equal(user.id, "player-local");
  assert.equal(user.displayName, "YOU");
  assert.equal(user.rating, 1000);
  assert.equal(user.rank, "BRONZE");
  assert.equal(user.isMock, false);
  assert.deepEqual(Array.from(user.deck, card => card.key), ["en:apple"]);
  assert.notEqual(user.deck, deck);
});

test("MOCK 사용자는 첫 라운드만 틀리고 나머지 네 라운드는 맞힌다", () => {
  const api = loadFacilityTestApi();
  const user = api.createMockHallUser(1000, "LUMEN", []);

  assert.equal(user.isMock, true);
  assert.deepEqual(Array.from(user.answerPattern), [false, true, true, true, true]);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(round => api.doesHallUserAnswerCorrectly(user, round)),
    [false, true, true, true, true]
  );
});

test("MOCK 사용자의 제출 답안은 첫 라운드만 오답이고 이후에는 실제 정답이다", () => {
  const api = loadFacilityTestApi();
  const user = api.createMockHallUser(1000, "LUMEN", []);
  const card = { w: "house" };

  assert.notEqual(api.getMockHallSubmittedAnswer(user, card, 0), "house");
  assert.equal(api.getMockHallSubmittedAnswer(user, card, 1), "house");
  assert.equal(api.getMockHallSubmittedAnswer(user, card, 4), "house");
});

test("대결 화면은 캐릭터·주문·피격·양쪽 회피 애니메이션을 제공한다", () => {
  assert.match(html, /class="duel-battlefield/);
  assert.match(html, /duel-spell player-spell/);
  assert.match(html, /duel-spell opponent-spell/);
  assert.match(html, /@keyframes duelAttackRight/);
  assert.match(html, /@keyframes duelSpellLeft/);
  assert.match(html, /@keyframes duelHit/);
  assert.match(html, /@keyframes duelDodge/);
  assert.match(html, /@keyframes duelDodgePlayer/);
  assert.match(html, /duel-dodge-label/);
  assert.match(html, /duel-dodge-label player-dodge/);
  assert.match(html, /prefers-reduced-motion: reduce/);
});

test("대결 문제의 뜻·빈칸 예문·입력·타이머는 전투 화면 내부에 통합된다", () => {
  const answerStart = html.indexOf("function renderDuelAnswer()");
  const answerEnd = html.indexOf("function submitHallDuelAnswer", answerStart);
  const answerSource = html.slice(answerStart, answerEnd);

  assert.match(html, /function buildDuelQuestionMarkup/);
  assert.match(html, /class="duel-battle-detail/);
  assert.match(html, /EXAMPLE · 빈칸에 들어갈 단어/);
  assert.match(answerSource, /buildDuelBattlefieldMarkup\([\s\S]*buildDuelQuestionMarkup/);
  assert.doesNotMatch(answerSource, /buildCollectionPromptMarkup/);
});

test("문제 표시 중에는 공격하지 않고 제출 후 정답은 회피·오답은 피격 처리한다", () => {
  const battlefieldStart = html.indexOf("function buildDuelBattlefieldMarkup");
  const battlefieldEnd = html.indexOf("function buildDuelScoreMarkup", battlefieldStart);
  const battlefieldSource = html.slice(battlefieldStart, battlefieldEnd);

  const exchangeSource = battlefieldSource.slice(
    battlefieldSource.indexOf('if(phase === "exchange")'),
    battlefieldSource.indexOf('} else if(phase === "resolved")')
  );
  const questionSource = battlefieldSource.slice(
    battlefieldSource.indexOf('} else if(phase === "question")'),
    battlefieldSource.indexOf('} else if(phase === "resolved")')
  );
  assert.doesNotMatch(exchangeSource, /opponent-spell/);
  assert.doesNotMatch(questionSource, /opponent-spell/);
  assert.match(exchangeSource, /opponentWasCorrect \? "dodge" : "hit"/);
  assert.match(html, /function renderDuelPlayerAttack/);
  assert.match(html, /buildDuelBattlefieldMarkup\([\s\S]{0,80}duel, "question"/);
  assert.match(battlefieldSource, /effects = '<div class="duel-spell opponent-spell"/);
  assert.match(battlefieldSource, /if\(duel\.playerWasCorrect\)[\s\S]*duel-dodge-label player-dodge/);
  assert.match(battlefieldSource, /else \{[\s\S]*duel-impact on-player/);
});

test("대결용 손패는 라운드마다 새로 뽑고, 사용한 카드가 덱에 다시 안 돌아간다", () => {
  const api = loadFacilityTestApi();
  const sourceDeck = [];
  for(let i = 0; i < 25; i++){
    sourceDeck.push({ key: "en:word-" + i, w: "word" + i, ko: "", tier: 1 });
  }
  const drawRandom = (cards, count) => {
    const shuffled = cards.slice();
    for(let index = shuffled.length - 1; index > 0; index--){
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled.slice(0, count);
  };
  let remaining = sourceDeck.slice();
  const usedKeys = [];
  for(let round = 0; round < 5; round++){
    const hand = drawRandom(remaining, 5);
    const handSet = new Set(hand);
    const nextDeck = remaining.filter(card => !handSet.has(card));
    assert.equal(hand.length, 5);
    assert.equal(nextDeck.length, sourceDeck.length - ((round + 1) * 5));
    const handKeys = hand.map(card => card.key);
    const duplicates = handKeys.filter(key => usedKeys.includes(key));
    assert.equal(duplicates.length, 0);
    usedKeys.push(...handKeys);
    remaining = nextDeck;
  }
  assert.equal(remaining.length, 0);
});

test("매 라운드 상대 제시 카드가 손패 내에서 랜덤하게 추출된다", () => {
  const api = loadFacilityTestApi();
  const sourceDeck = [];
  for(let i = 0; i < 25; i++){
    sourceDeck.push({ key: "en:word-" + i, w: "word" + i, ko: "", tier: 1 });
  }
  const drawRandom = (cards, count) => {
    const shuffled = cards.slice();
    for(let index = shuffled.length - 1; index > 0; index--){
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled.slice(0, count);
  };
  let remaining = sourceDeck.slice();
  const presented = [];
  for(let round = 0; round < 5; round++){
    const hand = drawRandom(remaining, 5);
    const handSet = new Set(hand);
    const nextDeck = remaining.filter(card => !handSet.has(card));
    const challenge = hand[Math.floor(Math.random() * Math.max(1, hand.length))];
    assert.ok(challenge && challenge.key);
    presented.push(challenge.key);
    remaining = nextDeck;
  }
  const uniquePresented = [...new Set(presented)];
  assert.equal(uniquePresented.length, 5);
});
