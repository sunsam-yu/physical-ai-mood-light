# 10단계 Arduino 최종 통합 코드

[`10_final_integration.ino`](10_final_integration.ino)는 센서 네 종류를 읽어 JSON으로 보내는 기능과 웹에서 받은 네오픽셀 명령을 적용하는 기능을 하나의 프로그램에 합칩니다.

## 핀 배치

| 부품 | 핀 |
|---|---|
| 가변저항 | A0 |
| 조도센서 | A5 |
| 터치센서 | D13 |
| 초음파 TRIG / ECHO | D2 / D3 |
| 네오픽셀 | D7 |

D8과 D9는 사용하지 않으므로 추후 블루투스 SoftwareSerial용으로 남아 있습니다. 다만 현재 최종 웹페이지의 통신은 USB Web Serial이며, HC-05·HC-06의 클래식 Bluetooth SPP를 Chrome Web Bluetooth로 바로 대체할 수는 없습니다.

## 양방향 통신

Arduino가 200ms마다 보내는 센서 데이터:

```json
{"type":"sensor","pot":512,"light":850,"touch":false,"distance":30.2,"brightness":40,"mode":"AUTO"}
```

웹이 보내는 조명 명령:

```text
LIGHT,255,170,40,40,AUTO
```

Arduino가 실제 적용 뒤 보내는 확인 데이터:

```json
{"type":"light_state","r":255,"g":170,"b":40,"brightness":40,"mode":"AUTO"}
```

웹의 디지털 트윈은 마지막 명령을 추측해서 표시하지 않고 이 `light_state` 응답을 받은 뒤 갱신됩니다.
