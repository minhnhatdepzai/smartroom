# EduVision AI — Cinematic Landing V3

Prototype landing page cinematic cho **phòng học thông minh EduVision AI**.

## Chạy ngay — không cần npm install

Project này là static. Chỉ cần mở terminal tại thư mục project:

```bash
python3 -m http.server 5500
```

sau đó mở:

```text
http://localhost:5500
```

> Cần Internet khi mở trang lần đầu vì Three.js được tải từ jsDelivr CDN. Toàn bộ nhân vật (cô giáo áo dài, học sinh đeo khăn quàng đỏ), phòng học, camera, digital twin, AI core và các hiệu ứng đều được dựng bằng code Three.js — không tải model ngoài.

## Build và triển khai Cloudflare

Dự án được cấu hình cho **Cloudflare Workers Static Assets** qua `wrangler.jsonc`.

```bash
npm install
npm run build
npm run deploy:check
```

Triển khai bằng Wrangler:

```bash
npm run deploy
```

Khi kết nối repository trong Cloudflare Workers Builds, sử dụng:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Thư mục xuất bản là `dist/`. Các đường dẫn không khớp tài nguyên sẽ được trả về `index.html` để liên kết điều hướng của giao diện tiếp tục hoạt động.

## Flow đã code

1. **Cinematic logo intro** — logo copies chạy quỹ đạo, hội tụ, quay 720°, light sweep, reveal chữ.
2. Logo phóng lớn như một **portal**, rồi fade vào classroom 3D.
3. **Classroom Hero** — fixed Three.js canvas, scroll là playhead.
4. **AI Vision** — camera chuyển góc, scan cone + student signal halo.
5. **AI Agent** — AI orb xuất hiện cạnh giáo viên.
6. **3D Learning** — mô hình Hệ Mặt Trời nổi ra trong lớp.
7. **Remote Control** — camera PTZ 3D quay theo scroll.
8. **Digital Twin** — lớp học chuyển sang wireframe/coverage view.
9. **AI Core** — classroom thu nhỏ, các node vision/voice/automation hội tụ.
10. **Teacher First** — ánh sáng chuyển ấm, AI rút về sau.
11. **CTA** — kết thúc bằng EduVision AI.

## File chính

- `index.html` — toàn bộ section/copy/UI.
- `src/style.css` — cinematic visual system + responsive.
- `src/main.js` — intro animation, Three.js world, native scroll interpolation.
- `src/characters.js` — toàn bộ hệ nhân vật (cô giáo + học sinh).
- `public/assets/logo-icon.png` — logo EduVision.

## Chỉnh nhân vật

Giáo viên chính dùng skinned model `assets/michelle.glb`, được nạp bằng
`GLTFLoader` trong `src/main.js`. Clip `TPose` chỉ dùng làm mốc rig; chuyển động
lớp học được điều khiển trực tiếp trên Mixamo bones (idle, nhìn lớp, chuyển
trọng lượng và cử chỉ thuyết trình), không phát `SambaDance`. Nếu GLB tải lỗi,
giáo viên procedural từ `src/characters.js` sẽ xuất hiện làm fallback.

Học sinh và fallback teacher nằm trong `src/characters.js`. Nhân vật procedural
được dựng theo hướng nhìn **-Z** (cùng hướng lớp ngồi); fallback teacher được
xoay 180° trong `main.js` để quay xuống lớp.

**Tỉ lệ cơ thể** — `STUDENT` và `TEACHER` giữ các mốc thế giới, mọi kích thước
khác suy ra từ `headHeight` (HH). Học sinh ngồi 4.4 head-units, cô giáo đứng 7.4
— đúng nhân trắc học người thật. Đổi `headHeight` là đổi toàn bộ dáng người, nên
đây là chỗ chỉnh đầu tiên nếu thấy nhân vật "bị lùn" hay "đầu to".

**Hình học** — bốn hàm dựng nên mọi thứ:

- `loftGeometry()` — xâu các lát cắt ngang thành một mặt liền: thân, cổ, đầu,
  tà áo dài. Nhận `phiStart`/`phiLength` để dựng cung hở (hai tà áo dài).
- `tubeAlong()` — ống đi theo đường cong, tiết diện elip đổi dần: tay, chân,
  lọn tóc. `radiusAt(t)` trả `[rNormal, rBinormal, ao]`; với đường cong chạy
  ngang thì `rNormal` là trục **độ sâu**, chạy dọc thì là trục **ngang**.
- `sculpt()` — đẩy đỉnh trong một vùng elip: gờ mày, sống mũi, hốc mắt, gò má.
  Danh sách khối nằm ở `headSculptBlobs()`; **vỏ tóc dùng lại đúng danh sách
  này**, nếu không nó sẽ treo lơ lửng trên các vùng đã khoét lõm.
- `curvedPanelGeometry()` — tấm vải cong bám đường sinh thân: tam giác khăn quàng.

**Khuôn mặt** — `HEAD_SECTIONS` là đường sinh hộp sọ (rộng .655 HH, sâu .849 HH),
`FACE` là bộ mốc mắt/mày/tai/môi. Mắt là **mảng khe mi phẳng** áp lên da chứ
không phải nhãn cầu hình cầu: hốc mắt chỉ được khoét lõm chứ không thủng, nên
quả cầu luôn đâm xuyên qua da. Nếu chỉnh độ sâu hốc mắt thì phải chỉnh
`FACE.eyeSurfaceZ` theo.

**Tóc** — `buildHairShell()` lấy mẫu trên chính mặt sọ rồi đẩy ra ngoài, mỏng dần
về mép (gáy tỉa fade vào da). `hairlineCurve(front, back)` đặt chân tóc theo `t`
tính từ đỉnh đầu: trán ≈ .22–.25, gáy ≈ .74–.80. `longHairLocks()` xếp nhiều lọn
chồng lớp — một mảng rộng duy nhất sẽ đọc ra tấm ván phẳng.

**Trang phục** — `characterMaterials`: `aoDai` đổi màu áo cô giáo, `scarf` màu
khăn quàng, `shirt` màu áo học sinh. Vải dùng `MeshPhysicalMaterial` có `sheen`
và normal map sợi vải sinh theo thủ tục; bỏ `sheen` thì áo trắng thành sứ trắng.

**Hiệu năng** — `setCharacterQuality('low'|'medium'|'high')` phải gọi **trước**
khi dựng nhân vật vì hình học được cache. `main.js` đã gọi sẵn theo cấu hình máy
dò được. Một học sinh ≈ 9.000 tam giác / 10 draw call.

Hướng nhìn của học sinh lấy từ `teacherAnchor`; nếu dời cô giáo sang vị trí khác
thì cập nhật biến này để cả lớp quay theo.

## Chỉnh camera

Trong `src/main.js`, tìm `const keyframes = [...]`.

Mỗi scene có:

```js
{
  id: 'vision',
  cam: [6.7, 5.3, 7.6],
  target: [0, 1.25, .1],
  fx: { scan: 1, twin: 0, agent: 0, solar: 0, remote: 0, core: 0, warm: 0 },
  bloom: .96
}
```

Scroll sẽ nội suy giữa các keyframe nên camera không giật section-to-section.

## Bước production tiếp theo

Prototype hiện dùng geometry procedural để bạn thấy interaction trước. Khi đã chốt flow, thay classroom bằng model `.glb` từ Blender và giữ nguyên camera/scroll architecture là hợp lý nhất.
