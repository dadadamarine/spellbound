# SPELLBOUND

포켓몬스터 골드 스타일의 월드를 탐험하며 영어 단어를 포획하고, 단어 덱으로 대결하는 브라우저 게임입니다.

## 플레이

GitHub Pages: https://dadadamarine.github.io/spellbound/

별도의 설치나 빌드 없이 `index.html`만으로 실행됩니다.

## 문서

- [메인 스토리](GAME_STORY.md)
- [기능 기획 V2](GAME_DESIGN_V2.md)
- [게임 목표 계약](GAME_GOAL.md)

## 테스트

```bash
node --test test_capture_rules.mjs test_facility_rules.mjs test_world_map.mjs test_story_rules.mjs
```

## 현재 범위

- 영어박사님 집에서 세 종류의 쉬운 25장 덱 중 하나를 시험으로 획득
- 편지 프롤로그부터 마을 복구·1번 길 해금·첫 라이벌전까지 저장되는 스토리
- 맵 탐험과 7초 숫자+감소 게이지 제한시간 단어 포획
- 덱 기반 포획 복구 시험
- 카드정리소 시험 및 카드 제거
- MockUser와의 5라운드 랭크 대결
- 라이벌과의 5라운드 스토리 비랭크 대결
- 단어 도감과 덱 조회
