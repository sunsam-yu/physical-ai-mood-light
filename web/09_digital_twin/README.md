# 9단계 AI 자동 조명과 디지털 트윈

거리·가변저항·조도·안정된 표정·신뢰도를 한 정책 함수에서 종합하고, 최종 조명 상태를 화면에 표시합니다. Arduino 없이 슬라이더로 모든 분기를 시험할 수 있습니다.

```bash
python3 -m http.server 8000
# http://localhost:8000/web/09_digital_twin/
node --test web/09_digital_twin/tests/policy.test.mjs
```

조도센서 값의 방향은 실측 전까지 `unknown`이며 이때 조도 보정을 적용하지 않습니다. 범위 밖 사람은 조명을 끄고, 신뢰도가 낮거나 안정된 표정이 없으면 이전 상태를 유지합니다. 가변저항은 사용자가 정하는 최대 밝기로 사용합니다.
