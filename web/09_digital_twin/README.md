# 9단계 AI 자동 조명과 디지털 트윈

거리·가변저항·조도·안정된 표정·신뢰도를 한 정책 함수에서 종합하고, 최종 조명 상태를 화면에 표시합니다. Arduino 없이 슬라이더로 모든 분기를 시험할 수 있습니다.

```bash
python3 -m http.server 8000
# http://localhost:8000/web/09_digital_twin/
node --test web/09_digital_twin/tests/policy.test.mjs
```

재사용되는 정책 함수는 조도 방향을 받지 못하면 `unknown`으로 두고 보정하지 않는 안전 규칙을 유지합니다. 현재 9단계 화면은 실측 결과에 따라 `lower_is_brighter`, 즉 밝을수록 센서값이 작아지는 조건을 기본 선택합니다. 범위 밖 사람은 조명을 끄고, 신뢰도가 낮거나 안정된 표정이 없으면 이전 상태를 유지합니다. 가변저항은 사용자가 정하는 최대 밝기로 사용합니다.
