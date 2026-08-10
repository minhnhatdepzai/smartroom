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

> Cần Internet khi mở trang lần đầu vì Three.js được tải từ jsDelivr CDN. Nhân vật sử dụng model GLB trong `assets/`; phòng học, camera, digital twin, AI core và các hiệu ứng còn lại được dựng bằng Three.js.

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
- `public/assets/logo-icon.png` — logo EduVision.

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
