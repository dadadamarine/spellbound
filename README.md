# SPELLBOUND

포켓몬스터 골드 스타일의 월드를 탐험하며 영어 단어를 포획하고, 단어 덱으로 대결하는 브라우저 게임입니다.

## 플레이

GitHub Pages: https://dadadamarine.github.io/spellbound/

별도의 설치나 빌드 없이 `index.html`만으로 실행됩니다.

## 테스트

```bash
node --test test_capture_rules.mjs test_facility_rules.mjs test_world_map.mjs
```

## 현재 범위

- 쉬운 영어 단어 50장으로 시작하는 기본 덱
- 맵 탐험과 제한시간 단어 포획
- 덱 기반 포획 복구 시험
- 카드정리소 시험 및 카드 제거
- MockUser와의 5라운드 랭크 대결
- 단어 도감과 덱 조회

