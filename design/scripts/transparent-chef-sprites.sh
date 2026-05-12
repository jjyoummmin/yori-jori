#!/bin/sh
# image.png에서 잘린 쉐프 스프라이트의 바둑판(회색 격자)을 투명으로. fuzz는 너무 키우면 캐릭터까지 먹힘.
set -e
trans() {
  magick "$1" \
    -fuzz 6% -transparent '#F0F2F1' \
    -fuzz 6% -transparent '#F0F1F2' \
    -fuzz 6% -transparent '#D9DCE0' \
    -fuzz 6% -transparent '#C8CDD4' \
    -fuzz 6% -transparent '#E2E5E6' \
    -fuzz 6% -transparent '#CACFD5' \
    -fuzz 6% -transparent '#D4D9DC' \
    -fuzz 6% -transparent '#EFF1F0' \
    -fuzz 6% -transparent '#E9ECEC' \
    -fuzz 6% -transparent '#CCD1D6' \
    -fuzz 6% -transparent '#CDD2D7' \
    -fuzz 6% -transparent '#EAECEC' \
    -fuzz 6% -transparent '#EEF0F0' \
    -fuzz 6% -transparent '#D3D7DB' \
    "$2"
}
for base in chef-mascot-idle.png chef-mascot-onboarding-4strip.png chef-mascot-success.png chef-mascot-success-2strip.png; do
  for dir in "$(dirname "$0")/../assets" "$(dirname "$0")/../../pwa/assets"; do
    f="$dir/$base"
    if [ -f "$f" ]; then
      trans "$f" "/tmp/_chef-$$.png"
      mv "/tmp/_chef-$$.png" "$f"
      echo "ok $f"
    fi
  done
done
