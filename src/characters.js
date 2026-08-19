// -----------------------------------------------------------------------------
// Hệ nhân vật EduVision — dựng lại theo ảnh tham chiếu assets/classroom-ai-photoreal.png
//
// Vì sao bản cũ trông như con rối, và bản này sửa từng điểm một:
//
//  1. Tỉ lệ sai. Bản cũ: học sinh 3.7 head-units (đo từ mặt ghế lên đỉnh đầu),
//     cô giáo 6.5. Người thật ngồi là 4.4, phụ nữ trưởng thành đứng là 7.4.
//     Đầu to hơn thực tế ~20% chính là tỉ lệ của búp bê. Ở đây HH (chiều cao
//     đầu) là đơn vị gốc và mọi mốc cơ thể đều suy ra từ nó.
//  2. Khớp cầu lộ thiên. Bản cũ ghép capsule rời và bịt chỗ nối bằng hình cầu —
//     đúng nghĩa khớp con rối. Ở đây thân là MỘT mặt lofted liên tục từ hông lên
//     vai, tay/chân là ống đi theo đường cong có tiết diện elip đổi dần, nên
//     khuỷu tay là một chỗ uốn chứ không phải một quả cầu.
//  3. Đầu là hình cầu bị bóp. Ở đây hộp sọ được loft theo lát cắt ngang (chẩm
//     nhô sau, thái dương phẳng, hàm thon, cằm đưa ra) rồi điêu khắc thêm gờ mày,
//     sống mũi, hốc mắt, gò má bằng cách đẩy đỉnh — vẫn là một mặt liền.
//  4. Mắt dán trên mặt. Ở đây hốc mắt được khoét lõm trước, nhãn cầu nằm trong
//     hốc, mí mắt là vỏ mỏng phủ lên nên chỉ hở khe hình hạnh nhân.
//  5. Tóc là cái mũ chỏm. Ở đây tóc là vỏ ôm sát sọ có đường chân tóc thật (cao
//     ở thái dương, thấp ở gáy) và mỏng dần về mép nên gáy tỉa chuyển mượt vào da.
//  6. Vật liệu phẳng lì. Ở đây da/vải/tóc đều là MeshPhysicalMaterial có normal
//     map sinh theo thủ tục, roughness biến thiên và sheen — thứ quyết định
//     "ảnh chụp" hay "nhựa".
//
// Trục quy ước: y hướng lên, nhân vật nhìn về -Z (giống hướng ngồi của lớp).
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

// Mức chi tiết hình học. Trang đã tự dò cấu hình máy trong main.js; gọi
// setCharacterQuality() TRƯỚC khi dựng nhân vật vì hình học được cache lại.
// Lưới thưa hơn chỉ làm bề mặt hơi gãy góc, không đổi tỉ lệ hay bóng đổ.
let meshDetail = 1;
export function setCharacterQuality(tier) {
  meshDetail = tier === 'low' ? .55 : tier === 'medium' ? .78 : 1;
}
// Luôn giữ tối thiểu 6 cạnh cho một vòng, dưới mức đó khối thành lăng trụ.
const seg = (count, floor = 6) => Math.max(floor, Math.round(count * meshDetail));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smoothstep = (t) => { const x = clamp(t); return x * x * (3 - 2 * x); };

// RNG có hạt giống: mỗi học sinh phải khác nhau nhưng phải khác nhau ổn định,
// nếu không thì mỗi lần tải trang cả lớp lại đổi dáng.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -----------------------------------------------------------------------------
// Texture thủ tục. Da trần và vải trơn dưới ánh sáng đều là hai mặt phẳng lì
// giống hệt nhau; thứ tách chúng ra là cách bề mặt bẻ gãy highlight. Nên mọi
// vật liệu ở đây đều có ít nhất một normal map tần số cao.
// -----------------------------------------------------------------------------
const textureCache = new Map();
function cachedTexture(key, build) {
  if (!textureCache.has(key)) textureCache.set(key, build());
  return textureCache.get(key);
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas;
}

// Chuyển bản đồ độ cao sang normal map bằng Sobel. Viết tay vì three không có
// sẵn, và vì cần lấy mẫu vòng (wrap) để texture lặp không lộ đường nối.
function heightToNormal(heightCanvas, strength) {
  const size = heightCanvas.width;
  const source = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const canvas = makeCanvas(size);
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const at = (x, y) => source[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      image.data[index] = ((-dx / length) * .5 + .5) * 255;
      image.data[index + 1] = ((-dy / length) * .5 + .5) * 255;
      image.data[index + 2] = ((1 / length) * .5 + .5) * 255;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function wrapTexture(canvas, repeat, colorSpace = THREE.NoColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Lỗ chân lông: nhiễu trắng đã làm mượt nhẹ. Biên độ rất thấp — da người ở
// khoảng cách camera này chỉ cần đủ để highlight không phải một vệt bóng nhẵn.
function skinNormalTexture() {
  return cachedTexture('skin-normal', () => {
    const size = 256;
    const height = makeCanvas(size);
    const context = height.getContext('2d');
    const image = context.createImageData(size, size);
    const random = seededRandom(9137);
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (random() - .5) * 96;
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    context.filter = 'blur(0.6px)';
    context.drawImage(height, 0, 0);
    return wrapTexture(heightToNormal(height, 1.1), 9);
  });
}

// Sợi vải: hai chuỗi vạch vuông góc (sợi dọc / sợi ngang) cộng nhiễu bông.
// Đây là thứ làm áo trắng đọc ra "vải cotton" thay vì "nhựa trắng".
function fabricNormalTexture() {
  return cachedTexture('fabric-normal', () => {
    const size = 256;
    const height = makeCanvas(size);
    const context = height.getContext('2d');
    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
    context.lineWidth = 1.6;
    for (let i = 0; i < size; i += 4) {
      context.strokeStyle = 'rgba(255,255,255,.30)';
      context.beginPath(); context.moveTo(i, 0); context.lineTo(i, size); context.stroke();
      context.strokeStyle = 'rgba(0,0,0,.30)';
      context.beginPath(); context.moveTo(i + 2, 0); context.lineTo(i + 2, size); context.stroke();
      context.strokeStyle = 'rgba(255,255,255,.22)';
      context.beginPath(); context.moveTo(0, i + 1); context.lineTo(size, i + 1); context.stroke();
      context.strokeStyle = 'rgba(0,0,0,.22)';
      context.beginPath(); context.moveTo(0, i + 3); context.lineTo(size, i + 3); context.stroke();
    }
    const random = seededRandom(4421);
    for (let i = 0; i < 2600; i++) {
      const alpha = random() * .16;
      context.fillStyle = random() > .5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      context.fillRect(random() * size, random() * size, 1.6, 1.6);
    }
    return wrapTexture(heightToNormal(height, 1.5), 14);
  });
}

// Tóc: vạch dọc mảnh, mật độ không đều. Chạy dọc theo V của UV nên highlight
// kéo thành dải ngang quanh đỉnh đầu đúng như tóc thật bắt sáng.
function hairNormalTexture() {
  return cachedTexture('hair-normal', () => {
    const size = 256;
    const height = makeCanvas(size);
    const context = height.getContext('2d');
    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
    const random = seededRandom(7717);
    for (let i = 0; i < 460; i++) {
      const x = random() * size;
      const width = .6 + random() * 1.9;
      const bright = random() > .5;
      const alpha = .10 + random() * .34;
      context.fillStyle = bright ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      context.fillRect(x, 0, width, size);
    }
    return wrapTexture(heightToNormal(height, 2.1), 5);
  });
}

// Roughness lốm đốm: vùng vải cọ mòn bóng hơn, nếp gấp ăn sáng hơn. Kênh này
// phải độc lập với albedo, nếu dùng lại albedo thì màu và độ bóng dính nhau.
function mottledRoughnessTexture(seed, low, high) {
  return cachedTexture(`rough-${seed}-${low}-${high}`, () => {
    const size = 128;
    const canvas = makeCanvas(size);
    const context = canvas.getContext('2d');
    const random = seededRandom(seed);
    context.fillStyle = `rgb(${Math.round(((low + high) / 2) * 255)},0,0)`;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 160; i++) {
      const value = Math.round((low + random() * (high - low)) * 255);
      const radius = 6 + random() * 26;
      const gradient = context.createRadialGradient(random() * size, random() * size, 0, random() * size, random() * size, radius);
      gradient.addColorStop(0, `rgba(${value},0,0,.55)`);
      gradient.addColorStop(1, `rgba(${value},0,0,0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
    context.filter = 'blur(1.5px)';
    context.drawImage(canvas, 0, 0);
    return wrapTexture(canvas, 6);
  });
}

// -----------------------------------------------------------------------------
// Vật liệu
// -----------------------------------------------------------------------------
// Da: sheen ấm mô phỏng ánh sáng tán xạ dưới da ở rìa khối (đây là thứ khiến da
// không phải cao su), clearcoat rất nhẹ cho lớp dầu tự nhiên, roughness biến
// thiên để highlight bị bẻ gãy chứ không trượt thành một vệt bóng.
function skinMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: .62,
    metalness: 0,
    roughnessMap: mottledRoughnessTexture(31, .48, .72),
    normalMap: skinNormalTexture(),
    normalScale: new THREE.Vector2(.22, .22),
    sheen: .55,
    sheenColor: new THREE.Color(0xff9d7a),
    sheenRoughness: .42,
    clearcoat: .10,
    clearcoatRoughness: .72,
    vertexColors: true
  });
}

// Tóc: anisotropy là điểm mấu chốt — highlight của tóc là một DẢI vuông góc với
// sợi, không phải một chấm tròn. Cộng clearcoat cho lớp bóng ngoài.
function hairMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: .48,
    metalness: .02,
    normalMap: hairNormalTexture(),
    normalScale: new THREE.Vector2(.5, .2),
    anisotropy: .55,
    anisotropyRotation: Math.PI / 2,
    // Bản đầu để clearcoat .45 và cả mái tóc thành một khối vinyl bóng loáng.
    clearcoat: .14,
    clearcoatRoughness: .42,
    sheen: .5,
    sheenColor: new THREE.Color(0x6b5a52),
    side: THREE.DoubleSide,
    vertexColors: true
  });
}

// Vải: sheen mạnh, roughness cao. Sheen của MeshPhysicalMaterial chính là mô
// hình tán xạ sợi vải — bỏ nó đi thì áo trắng biến thành sứ trắng.
function clothMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? .82,
    metalness: 0,
    roughnessMap: mottledRoughnessTexture(options.seed ?? 57, options.roughLow ?? .68, options.roughHigh ?? .92),
    normalMap: fabricNormalTexture(),
    normalScale: new THREE.Vector2(options.weave ?? .55, options.weave ?? .55),
    sheen: options.sheen ?? 1,
    sheenColor: new THREE.Color(options.sheenColor ?? 0xffffff),
    sheenRoughness: options.sheenRoughness ?? .62,
    side: options.side ?? THREE.FrontSide,
    vertexColors: true
  });
}

const namedMaterials = {
  skin: [0xe8b491, 0xdda981, 0xf0c4a2, 0xcf9a72].map(skinMaterial),
  hair: [0x14100f, 0x1d1614, 0x271b16].map(hairMaterial),
  eyeWhite: new THREE.MeshPhysicalMaterial({ color: 0xe9e6e2, roughness: .18, metalness: 0, clearcoat: .9, clearcoatRoughness: .07, vertexColors: true }),
  iris: new THREE.MeshPhysicalMaterial({ color: 0x3b2519, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, vertexColors: true }),
  brow: new THREE.MeshStandardMaterial({ color: 0x1a1310, roughness: .78, metalness: 0, vertexColors: true }),
  lip: new THREE.MeshPhysicalMaterial({ color: 0xb9705f, roughness: .44, metalness: 0, sheen: .4, sheenColor: new THREE.Color(0xffb0a0), clearcoat: .2, vertexColors: true }),
  shirt: clothMaterial(0xf2f5f7, { seed: 11, roughness: .8, weave: .62, sheenColor: 0xf6fbff, side: THREE.DoubleSide }),
  trouser: clothMaterial(0x27304c, { seed: 19, roughness: .86, weave: .5 }),
  skirt: clothMaterial(0x212a48, { seed: 23, roughness: .86, weave: .5, side: THREE.DoubleSide }),
  sock: clothMaterial(0xf3f6f7, { seed: 29, roughness: .9, weave: .7 }),
  shoe: new THREE.MeshPhysicalMaterial({ color: 0x14181d, roughness: .42, metalness: .05, clearcoat: .5, clearcoatRoughness: .38, vertexColors: true }),
  // Khăn quàng đỏ: lụa mỏng, hai mặt, sheen cao để nếp vải bắt sáng.
  scarf: clothMaterial(0xcb1c26, { seed: 37, roughness: .58, weave: .42, sheen: 1, sheenColor: 0xff8e86, sheenRoughness: .38, side: THREE.DoubleSide }),
  // Lụa áo dài: sheen + clearcoat cho ánh lụa trượt dọc tà áo.
  aoDai: new THREE.MeshPhysicalMaterial({
    color: 0xd7688c, roughness: .38, metalness: 0,
    normalMap: fabricNormalTexture(), normalScale: new THREE.Vector2(.3, .3),
    sheen: 1, sheenColor: new THREE.Color(0xffd8e6), sheenRoughness: .34,
    clearcoat: .3, clearcoatRoughness: .42, side: THREE.DoubleSide, vertexColors: true
  }),
  aoDaiTrouser: new THREE.MeshPhysicalMaterial({
    color: 0xf3ece2, roughness: .46, metalness: 0,
    normalMap: fabricNormalTexture(), normalScale: new THREE.Vector2(.34, .34),
    sheen: .9, sheenColor: new THREE.Color(0xfffaf2), sheenRoughness: .44,
    side: THREE.DoubleSide, vertexColors: true
  }),
  aoDaiTrim: new THREE.MeshPhysicalMaterial({ color: 0xd8b271, roughness: .3, metalness: .6, clearcoat: .4, vertexColors: true })
};
Object.entries(namedMaterials).forEach(([key, value]) => {
  if (Array.isArray(value)) value.forEach((m, i) => { m.name = key + i; });
  else value.name = key;
});
export const characterMaterials = namedMaterials;

// -----------------------------------------------------------------------------
// Bộ dựng hình học
// -----------------------------------------------------------------------------

// Lát cắt ngang siêu-elip. n=2 là elip thường; n>2 làm tiết diện đầy hơn về phía
// góc — đúng với lồng ngực và hộp sọ, vốn không phải hình trứng. rzF/rzB tách
// riêng để phần trước và sau của một lát có độ sâu khác nhau (chẩm nhô sau,
// cằm đưa trước) mà vẫn là một đường cong kín liền.
function sectionPoint(section, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rz = cos >= 0 ? (section.rzF ?? section.rz ?? section.rx) : (section.rzB ?? section.rz ?? section.rx);
  const exponent = 2 / (section.n ?? 2);
  const x = section.rx * Math.sign(sin) * Math.pow(Math.abs(sin), exponent);
  const z = rz * Math.sign(cos) * Math.pow(Math.abs(cos), exponent);
  return [x + (section.cx ?? 0), section.y, z + (section.cz ?? 0)];
}

// Loft: xâu các lát cắt ngang thành một ống liền. Đây là xương sống của cả hệ —
// thân người, cổ, đầu, tà áo đều là loft, nên không chỗ nào có đường ghép.
// `ao` của mỗi lát được nướng vào vertex color: hõm cổ, nách, eo tối đi sẵn
// trong hình học nên không cần AO map hay uv2.
function loftGeometry(sections, options = {}) {
  const radial = seg(options.radial ?? 26);
  // Cung hở (phiLength < 2π) dùng cho hai tà áo dài: dựng thẳng đúng khoảng góc
  // cho ra mép cong sạch. Cắt tam giác khỏi một ống kín thì mép bị răng cưa.
  const phiLength = options.phiLength ?? TAU;
  const phiStart = options.phiStart ?? 0;
  const closed = Math.abs(phiLength - TAU) < 1e-6;
  const columns = radial + 1; // lặp đỉnh đầu để UV không nhảy ở đường nối
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const totalY = sections[sections.length - 1].y - sections[0].y || 1;
  sections.forEach((section) => {
    const ao = section.ao ?? 1;
    const v = (section.y - sections[0].y) / totalY;
    for (let i = 0; i < columns; i++) {
      const angle = phiStart + (closed ? (i % radial) / radial : i / radial) * phiLength;
      const [x, y, z] = sectionPoint(section, angle);
      positions.push(x, y, z);
      uvs.push(i / radial * (options.uRepeat ?? 1), v * (options.vRepeat ?? 1));
      colors.push(ao, ao, ao);
    }
  });

  for (let s = 0; s < sections.length - 1; s++) {
    for (let i = 0; i < radial; i++) {
      const a = s * columns + i;
      const b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  // Nắp cực: một đỉnh ở tâm lát đầu/cuối. Dùng cho đỉnh sọ và mũi bàn tay để
  // khối kín mà không có mặt cắt phẳng lộ ra.
  const addPole = (sectionIndex, flip) => {
    const section = sections[sectionIndex];
    const base = sectionIndex * columns;
    const poleIndex = positions.length / 3;
    positions.push(section.cx ?? 0, section.y + (flip ? -1 : 1) * (section.poleHeight ?? 0), section.cz ?? 0);
    uvs.push(.5, flip ? 0 : 1);
    const ao = section.ao ?? 1;
    colors.push(ao, ao, ao);
    for (let i = 0; i < radial; i++) {
      if (flip) indices.push(poleIndex, base + i + 1, base + i);
      else indices.push(poleIndex, base + i, base + i + 1);
    }
  };
  if (options.capTop) addPole(sections.length - 1, false);
  if (options.capBottom) addPole(0, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  // Chỉ cung kín mới cần hàn pháp tuyến ở đường nối.
  geometry.userData.loft = closed ? { radial, columns, sectionCount: sections.length } : null;
  return geometry;
}

// Đỉnh ở đường nối UV bị nhân đôi nên computeVertexNormals cho hai pháp tuyến
// khác nhau và hiện thành một sọc sáng dọc người. Hàn lại bằng cách lấy trung
// bình hai pháp tuyến đó.
function weldSeamNormals(geometry) {
  geometry.computeVertexNormals();
  const info = geometry.userData.loft;
  if (!info) return geometry;
  const normal = geometry.attributes.normal;
  for (let s = 0; s < info.sectionCount; s++) {
    const first = s * info.columns;
    const last = first + info.radial;
    const nx = (normal.getX(first) + normal.getX(last)) * .5;
    const ny = (normal.getY(first) + normal.getY(last)) * .5;
    const nz = (normal.getZ(first) + normal.getZ(last)) * .5;
    const length = Math.hypot(nx, ny, nz) || 1;
    normal.setXYZ(first, nx / length, ny / length, nz / length);
    normal.setXYZ(last, nx / length, ny / length, nz / length);
  }
  normal.needsUpdate = true;
  return geometry;
}

// Ống đi theo đường cong với tiết diện elip đổi dần — dùng cho tay, chân, đuôi
// tóc. Khung được vận chuyển song song (parallel transport) nên ống không bị
// xoắn khi đường cong đổi hướng, và khuỷu tay là chỗ uốn liên tục chứ không
// phải hai ống cắm vào một quả cầu.
// radiusAt(t) -> [rNormal, rBinormal, ao]. Với đường cong chạy ngang (chân mày,
// môi, đường mi) thì rNormal rơi vào trục ĐỘ SÂU còn rBinormal vào trục dọc;
// với đường cong chạy dọc (tay, chân, lọn tóc) thì rNormal là trục ngang. Đặt
// nhầm hai trục này là lý do chân mày từng dày .03 HH và chọc ra khỏi mặt.
function tubeAlong(points, radiusAt, options = {}) {
  const radial = seg(options.radial ?? 14, 5);
  const steps = seg(options.steps ?? 22, 4);
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', options.tension ?? .4);
  const columns = radial + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  let normal = null;
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const point = new THREE.Vector3();

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    curve.getPointAt(t, point);
    curve.getTangentAt(t, tangent).normalize();
    if (!normal) {
      // Khung khởi tạo: chọn trục phụ ít song song với tangent nhất.
      const helper = Math.abs(tangent.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      normal = new THREE.Vector3().crossVectors(helper, tangent).normalize();
    } else {
      // Vận chuyển song song: chiếu pháp tuyến cũ ra khỏi tangent mới.
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    }
    binormal.crossVectors(tangent, normal).normalize();

    const [rx, ry, ao] = radiusAt(t);
    for (let i = 0; i < columns; i++) {
      const angle = (i % radial) / radial * TAU;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.push(
        point.x + normal.x * cos * rx + binormal.x * sin * ry,
        point.y + normal.y * cos * rx + binormal.y * sin * ry,
        point.z + normal.z * cos * rx + binormal.z * sin * ry
      );
      uvs.push(i / radial * (options.uRepeat ?? 1), t * (options.vRepeat ?? 1));
      const shade = ao ?? 1;
      colors.push(shade, shade, shade);
    }
  }

  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < radial; i++) {
      const a = s * columns + i;
      const b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const addPole = (row, flip) => {
    const t = row / steps;
    curve.getPointAt(t, point);
    curve.getTangentAt(t, tangent).normalize();
    const poleIndex = positions.length / 3;
    const tip = point.clone().addScaledVector(tangent, flip ? -.004 : .004);
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(.5, t);
    colors.push(1, 1, 1);
    const base = row * columns;
    for (let i = 0; i < radial; i++) {
      if (flip) indices.push(poleIndex, base + i, base + i + 1);
      else indices.push(poleIndex, base + i + 1, base + i);
    }
  };
  if (options.capStart) addPole(0, true);
  if (options.capEnd) addPole(steps, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.userData.loft = { radial, columns, sectionCount: steps + 1 };
  return weldSeamNormals(geometry);
}

// Điêu khắc bằng cách đẩy đỉnh trong một quả cầu ảnh hưởng hình elip. Đây là
// cách thêm gờ mày / sống mũi / gò má / hốc mắt mà KHÔNG dán thêm khối rời lên
// mặt — bề mặt vẫn liền một mảnh, đó là khác biệt giữa mặt người và mặt rối.
function sculpt(geometry, blobs) {
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (const blob of blobs) {
    const [cx, cy, cz] = blob.center;
    const [rx, ry, rz] = blob.radii;
    const [dx, dy, dz] = blob.dir;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      // Chỉ tác động lên nửa mặt tương ứng khi blob có ràng buộc hướng.
      if (blob.frontOnly && vertex.z > 0) continue;
      if (blob.backOnly && vertex.z < 0) continue;
      const distance = Math.hypot((vertex.x - cx) / rx, (vertex.y - cy) / ry, (vertex.z - cz) / rz);
      if (distance >= 1) continue;
      const falloff = Math.pow(1 - distance * distance, blob.sharpness ?? 2);
      position.setXYZ(i, vertex.x + dx * falloff, vertex.y + dy * falloff, vertex.z + dz * falloff);
    }
  }
  position.needsUpdate = true;
  return geometry;
}

// Nếp vải tần số thấp. Áo phẳng tuyệt đối là dấu hiệu nhựa; vải thật luôn có
// nếp chảy theo trọng lực và dồn ở eo, nách.
function addClothFolds(geometry, { amplitude = .006, frequency = 7, seed = 3, yFalloff = null }) {
  const position = geometry.attributes.position;
  const random = seededRandom(seed);
  const phase = [random() * TAU, random() * TAU, random() * TAU];
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const angle = Math.atan2(vertex.x, vertex.z);
    const weight = yFalloff ? yFalloff(vertex.y) : 1;
    if (weight <= 0) continue;
    const wave =
      Math.sin(angle * frequency + phase[0]) * .6 +
      Math.sin(angle * (frequency * 1.7) + vertex.y * 9 + phase[1]) * .3 +
      Math.sin(vertex.y * 21 + phase[2]) * .25;
    const scale = 1 + wave * amplitude * weight;
    position.setXYZ(i, vertex.x * scale, vertex.y, vertex.z * scale);
  }
  position.needsUpdate = true;
  return geometry;
}

// Gom hình học theo vật liệu rồi hợp nhất: một học sinh từ ~30 draw call xuống
// còn ~6. Cần thiết vì lớp có 12 học sinh và trang phải chạy được trên mobile.
class PartBucket {
  constructor() { this.parts = new Map(); }

  add(geometry, material, matrix) {
    if (matrix) geometry.applyMatrix4(matrix);
    if (!geometry.attributes.normal) weldSeamNormals(geometry);
    if (!geometry.attributes.uv) {
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    }
    if (!geometry.attributes.color) {
      const white = new Float32Array(geometry.attributes.position.count * 3).fill(1);
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(white, 3));
    }
    // mergeGeometries yêu cầu các attribute trùng nhau hoàn toàn.
    for (const key of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(key)) geometry.deleteAttribute(key);
    }
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geometry);
    return this;
  }

  flush(target) {
    this.parts.forEach((geometries, material) => {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      target.add(mesh);
    });
    this.parts.clear();
    return target;
  }
}

const matrixOf = (position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );

// -----------------------------------------------------------------------------
// Đầu người
//
// Lát cắt lấy theo mốc giải phẫu, đơn vị là HH (chiều cao đầu), gốc ở đỉnh sọ,
// y đi xuống rồi được lật lại khi dựng. rzB > rzF ở vùng sọ vì chẩm nhô ra sau;
// từ hàm xuống cằm thì rzB co nhanh hơn rzF nên dưới hàm hụt vào đúng như thật.
// -----------------------------------------------------------------------------
// Số đo lấy theo nhân trắc học người lớn: cao đầu (cằm→đỉnh) 232mm, rộng đầu
// 152mm, dài đầu (trước→sau) 197mm. Quy về HH=1 thì đầu rộng .655 và sâu .849.
// Bản dựng đầu tiên để rộng .86 — đó chính là cái đầu tròn của búp bê.
const HEAD_SECTIONS = [
  { t: .00, rx: .065, rzF: .080, rzB: .090, n: 2.4 },
  { t: .07, rx: .207, rzF: .268, rzB: .306, n: 2.3 },
  { t: .17, rx: .285, rzF: .350, rzB: .404, n: 2.25 },
  { t: .28, rx: .320, rzF: .374, rzB: .434, n: 2.2 },
  { t: .38, rx: .328, rzF: .380, rzB: .442, n: 2.15 },
  { t: .47, rx: .323, rzF: .376, rzB: .425, n: 2.1 },
  { t: .56, rx: .306, rzF: .372, rzB: .395, n: 2.05 },
  { t: .65, rx: .282, rzF: .365, rzB: .359, n: 2.0 },
  { t: .74, rx: .249, rzF: .350, rzB: .314, n: 2.0 },
  { t: .83, rx: .208, rzF: .323, rzB: .261, n: 2.0 },
  { t: .91, rx: .158, rzF: .278, rzB: .203, n: 2.0 },
  { t: .97, rx: .107, rzF: .218, rzB: .143, n: 2.0 },
  { t: 1.00, rx: .066, rzF: .156, rzB: .098, n: 2.0 }
];

// Mốc trên khuôn mặt, đơn vị HH, gốc ở cằm và y hướng lên. Gom lại một chỗ để
// mắt / mày / tai / môi luôn bám theo hộp sọ khi chỉnh tỉ lệ đầu.
const FACE = {
  eyeY: .478,        // đường mắt
  eyeX: .137,        // nửa khoảng đồng tử (63mm / 232mm ≈ .27 HH cả khoảng)
  // Mặt da tại hốc mắt sau khi điêu khắc lõm: đây là nơi đặt mảng khe mi.
  // Nếu chỉnh độ sâu hốc mắt trong buildHeadGeometry thì phải chỉnh số này theo.
  eyeSurfaceZ: .334,
  eyeWidth: .062,    // nửa chiều dài khe mi (khe mi người ~30mm / 232mm)
  eyeUpper: .026,    // nửa chiều cao khe mi phía trên
  eyeLower: .020,
  browY: .566,
  earY: .420,
  earX: .296,
  earZ: -.058,
  mouthY: .196,
  mouthZ: .300
};

// Cổ nối tiếp ngay dưới cằm và loe dần ra thành cơ thang. Cổ và đầu là hai mảnh
// (đầu phải xoay được) nhưng chung một đường sinh nên chỗ giao không thấy mối.
function buildHeadGeometry(headHeight, { chinTuck = 0 } = {}) {
  const sections = HEAD_SECTIONS.map((s) => ({
    y: (1 - s.t) * headHeight,
    rx: s.rx * headHeight,
    rzF: (s.rzF - (s.t > .8 ? chinTuck * (s.t - .8) * 5 : 0)) * headHeight,
    rzB: s.rzB * headHeight,
    n: s.n,
    // Hõm dưới hàm và hai bên thái dương tối sẵn.
    ao: s.t > .86 ? .78 : s.t > .74 ? .9 : 1
  }));
  // Nối thêm hai lát cổ để đáy đầu không phải một mặt cắt phẳng.
  sections.push(
    { y: -.10 * headHeight, rx: .20 * headHeight, rzF: .19 * headHeight, rzB: .20 * headHeight, n: 2, ao: .72 },
    { y: -.26 * headHeight, rx: .21 * headHeight, rzF: .20 * headHeight, rzB: .21 * headHeight, n: 2, ao: .66 }
  );
  sections.reverse();

  const geometry = loftGeometry(sections, { radial: 30, capTop: true, capBottom: true });
  sculpt(geometry, headSculptBlobs(headHeight));
  return weldSeamNormals(geometry);
}

// Danh sách khối điêu khắc của đầu. Vỏ tóc PHẢI chịu đúng bộ biến dạng này,
// nếu không nó bám theo hộp sọ trơn và sẽ treo lơ lửng phía trên hốc mắt cùng
// thái dương đã khoét lõm — đúng những mảng đen từng nổi trên trán.
function headSculptBlobs(headHeight) {
  const H = headHeight;
  return [
    // Gờ mày — hai khối chạy chéo từ giữa trán ra ngoài, đè bóng lên hốc mắt.
    { center: [.118 * H, .565 * H, .318 * H], radii: [.20 * H, .12 * H, .24 * H], dir: [0, 0, .026 * H] },
    { center: [-.118 * H, .565 * H, .318 * H], radii: [.20 * H, .12 * H, .24 * H], dir: [0, 0, .026 * H] },
    // Hốc mắt khoét lõm — làm TRƯỚC khi đặt nhãn cầu, để mắt nằm trong hốc chứ
    // không dán lên mặt. Đây là khác biệt lớn nhất giữa mắt người và mắt búp bê.
    { center: [.137 * H, .478 * H, .320 * H], radii: [.125 * H, .092 * H, .185 * H], dir: [0, 0, -.044 * H], sharpness: 1.4 },
    { center: [-.137 * H, .478 * H, .320 * H], radii: [.125 * H, .092 * H, .185 * H], dir: [0, 0, -.044 * H], sharpness: 1.4 },
    // Sống mũi từ giữa hai mày xuống, chóp mũi, rồi hai cánh mũi.
    { center: [0, .478 * H, .350 * H], radii: [.066 * H, .160 * H, .200 * H], dir: [0, 0, .026 * H], sharpness: 1.6 },
    { center: [0, .335 * H, .366 * H], radii: [.058 * H, .078 * H, .160 * H], dir: [0, -.004 * H, .044 * H], sharpness: 1.5 },
    { center: [.052 * H, .318 * H, .330 * H], radii: [.052 * H, .050 * H, .130 * H], dir: [.007 * H, 0, .014 * H] },
    { center: [-.052 * H, .318 * H, .330 * H], radii: [.052 * H, .050 * H, .130 * H], dir: [-.007 * H, 0, .014 * H] },
    // Gò má
    { center: [.192 * H, .400 * H, .240 * H], radii: [.165 * H, .155 * H, .240 * H], dir: [.010 * H, 0, .015 * H] },
    { center: [-.192 * H, .400 * H, .240 * H], radii: [.165 * H, .155 * H, .240 * H], dir: [-.010 * H, 0, .015 * H] },
    // Nhân trung lõm, môi trên / môi dưới nhô, rãnh dưới môi.
    { center: [0, .238 * H, .318 * H], radii: [.062 * H, .042 * H, .120 * H], dir: [0, 0, -.008 * H] },
    { center: [0, .208 * H, .312 * H], radii: [.098 * H, .034 * H, .125 * H], dir: [0, 0, .013 * H], sharpness: 1.5 },
    { center: [0, .162 * H, .310 * H], radii: [.090 * H, .038 * H, .125 * H], dir: [0, 0, .012 * H], sharpness: 1.5 },
    { center: [0, .124 * H, .296 * H], radii: [.086 * H, .032 * H, .110 * H], dir: [0, 0, -.010 * H] },
    // Cằm nhô nhẹ dưới rãnh — vẫn lùi sau mặt phẳng môi trên, đúng nhìn nghiêng.
    { center: [0, .068 * H, .282 * H], radii: [.110 * H, .070 * H, .150 * H], dir: [0, 0, .012 * H] },
    // Thái dương hụt vào — dấu hiệu đầu người thay vì quả cầu.
    { center: [.312 * H, .555 * H, .090 * H], radii: [.130 * H, .160 * H, .240 * H], dir: [-.015 * H, 0, 0] },
    { center: [-.312 * H, .555 * H, .090 * H], radii: [.130 * H, .160 * H, .240 * H], dir: [.015 * H, 0, 0] },
    // Hõm gáy dưới chẩm, nơi tóc tỉa chuyển vào da.
    { center: [0, .100 * H, -.265 * H], radii: [.220 * H, .170 * H, .200 * H], dir: [0, 0, .018 * H] }
  ];
}

// Tai: vành xoắn + hõm loa tai. Ở khoảng cách camera này tai chỉ cần đúng dáng
// và đúng chỗ (mép trên ngang đuôi mắt, mép dưới ngang chóp mũi).
function buildEarGeometry(headHeight, side) {
  const H = headHeight;
  const bucket = [];
  const helix = tubeAlong(
    [
      [0, -.085 * H, -.02 * H], [0, -.02 * H, .045 * H], [0, .055 * H, .035 * H],
      [0, .080 * H, -.03 * H], [0, .045 * H, -.075 * H], [0, -.035 * H, -.070 * H]
    ],
    (t) => [.019 * H * (1 - t * .35), .026 * H * (1 - t * .3), 1],
    { radial: 8, steps: 16, capStart: true, capEnd: true }
  );
  bucket.push(helix);
  const bowl = loftGeometry([
    { y: -.075 * H, rx: .016 * H, rzF: .030 * H, rzB: .030 * H, n: 2, ao: .68 },
    { y: -.020 * H, rx: .024 * H, rzF: .048 * H, rzB: .046 * H, n: 2, ao: .62 },
    { y: .040 * H, rx: .022 * H, rzF: .046 * H, rzB: .044 * H, n: 2, ao: .66 },
    { y: .072 * H, rx: .012 * H, rzF: .026 * H, rzB: .026 * H, n: 2, ao: .8 }
  ], { radial: 12, capTop: true, capBottom: true });
  bucket.push(bowl);
  const merged = mergeGeometries(bucket.map((g) => weldSeamNormals(g)), false);
  merged.scale(side, 1, 1);
  return merged;
}

// -----------------------------------------------------------------------------
// Tóc
//
// Tóc là vỏ lấy mẫu TRÊN CHÍNH mặt sọ rồi đẩy ra ngoài, nên không bao giờ hở
// da đầu hay lún vào sọ. Đường chân tóc là hàm theo góc: cao ở trán, hạ dần
// qua thái dương, xuống thấp nhất ở gáy. Độ dày giảm về 0 ở mép nên gáy tỉa
// chuyển mượt vào da thay vì kết thúc bằng một mép vỏ cứng.
// -----------------------------------------------------------------------------
function sampleSkull(headHeight, angle, t) {
  // Nội suy tuyến tính giữa hai lát HEAD_SECTIONS gần nhất.
  let index = 0;
  while (index < HEAD_SECTIONS.length - 2 && HEAD_SECTIONS[index + 1].t < t) index++;
  const a = HEAD_SECTIONS[index];
  const b = HEAD_SECTIONS[index + 1];
  const k = (t - a.t) / ((b.t - a.t) || 1);
  const section = {
    y: (1 - t) * headHeight,
    rx: (a.rx + (b.rx - a.rx) * k) * headHeight,
    rzF: (a.rzF + (b.rzF - a.rzF) * k) * headHeight,
    rzB: (a.rzB + (b.rzB - a.rzB) * k) * headHeight,
    n: a.n + (b.n - a.n) * k
  };
  return sectionPoint(section, angle);
}

// Đường chân tóc: cao nhất ở trán, hạ dần qua thái dương, thấp nhất ở gáy.
// t ở đây đo từ đỉnh sọ xuống (t=0 đỉnh, t=1 cằm) nên trán ≈ .30 chứ không phải
// .52 — bản dựng đầu tiên để .52 và tóc phủ thẳng xuống mắt như cái mũ bảo hiểm.
const hairlineCurve = (front, back) => (angle) =>
  front + (back - front) * Math.pow(.5 - .5 * Math.cos(angle), 1.3);


// Lấy một điểm trên mặt sọ rồi đẩy ra ngoài `out` theo phương bán kính. Dùng để
// đặt chân mày, môi, tai — những chi tiết phải NẰM TRÊN da chứ không lơ lửng
// trước mặt hay chìm vào trong.
function surfaceOffset(headHeight, t, angle, out) {
  const [x, y, z] = sampleSkull(headHeight, angle, t);
  const radius = Math.hypot(x, z) || 1;
  const scale = 1 + out / radius;
  return [x * scale, y, z * scale];
}

function buildHairShell(headHeight, hairline, options) {
  const thickness = options.thickness ?? .018;
  const radial = seg(options.radial ?? 42, 12);
  const rows = seg(options.rows ?? 20, 6);
  const columns = radial + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const centerY = .52 * headHeight; // tâm hộp sọ, để phồng đều theo mọi hướng
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    for (let i = 0; i < columns; i++) {
      const angle = (i % radial) / radial * TAU;
      const limit = hairline(angle);
      const t = v * limit;
      const [x, y, z] = sampleSkull(headHeight, angle, t);
      // Dày ở giữa mảng tóc, mỏng dần về 0 ở mép: gáy tỉa fade vào da thay vì
      // kết thúc bằng một mép vỏ cứng.
      const edge = smoothstep((1 - v) * 3.0);
      // Mỏng dần về mép nhưng KHÔNG BAO GIỜ âm: mép tóc vẫn nổi trên da một
      // lớp rất mỏng, đủ để không có chỗ nào hai mặt cắt nhau.
      const grow = 1 + (thickness / headHeight) * (.14 + .86 * edge);
      positions.push(x * grow, centerY + (y - centerY) * grow, z * grow);
      uvs.push(i / radial * 3, v * 2.2);
      // Chân tóc tối hơn ngọn: bóng đổ giữa các mảng tóc.
      const shade = .58 + .42 * (1 - v * .75);
      colors.push(shade, shade, shade);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < radial; i++) {
      const a = r * columns + i;
      const b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.userData.loft = { radial, columns, sectionCount: rows + 1 };
  sculpt(geometry, headSculptBlobs(headHeight));
  return weldSeamNormals(geometry);
}

// Lọn tóc dài: dải dẹt đi theo đường cong, rộng ở gốc và thon dần, có độ dày
// nên nhìn nghiêng vẫn ra khối chứ không phải tấm bìa.
function buildHairLock(points, width, thickness, options = {}) {
  return tubeAlong(points, (t) => {
    const taper = options.taper ? options.taper(t) : (1 - t * .55);
    return [width * taper, thickness * taper, .62 + .38 * (1 - t)];
  }, { radial: options.radial ?? 10, steps: options.steps ?? 20, capStart: true, capEnd: true, uRepeat: 1.4, vRepeat: 2.6 });
}


// Tóc dài buông: KHÔNG dùng một mảng rộng duy nhất — nhìn nghiêng nó đọc ra một
// tấm ván phẳng. Xếp nhiều lọn hẹp chồng lớp, lệch nhau về chiều dài, độ sâu và
// độ loe, để đường bao có nhịp và bắt sáng thành nhiều dải.
function longHairLocks(H, seed) {
  const random = seededRandom(seed);
  const locks = [];
  // Ba lọn sau lưng, dài ngắn khác nhau.
  [-1, 0, 1].forEach((slot, i) => {
    const drift = (random() - .5) * .06;
    const length = .84 + i * .07 + random() * .10;
    locks.push(buildHairLock(
      [
        [slot * .10 * H, .60 * H, (-.40 - i * .02) * H],
        [slot * .13 * H + drift * H, .14 * H, (-.47 - i * .03) * H],
        [slot * .15 * H + drift * H, -.38 * H, (-.43 - i * .04) * H],
        [slot * .14 * H, -length * H, (-.30 - i * .03) * H]
      ],
      (.168 + random() * .030) * H, (.068 + random() * .014) * H,
      { steps: 22, radial: 12, taper: (t) => 1 - t * (.20 + random() * .08) }
    ));
  });
  // Hai lọn phủ vai, ngắn hơn và nhô ra trước một chút.
  [-1, 1].forEach((side) => {
    locks.push(buildHairLock(
      [
        [side * .270 * H, .58 * H, -.20 * H],
        [side * .305 * H, .16 * H, -.26 * H],
        [side * .312 * H, -.34 * H, -.28 * H],
        [side * .288 * H, -.80 * H, -.20 * H]
      ],
      .132 * H, .070 * H, { steps: 20, radial: 12, taper: (t) => 1 - t * .30 }
    ));
  });
  return locks;
}

// -----------------------------------------------------------------------------
// Bàn tay: lòng bàn tay dẹt + bốn ngón cong tự nhiên + ngón cái đối chiếu.
// Ở hàng bàn đầu, cẳng tay học sinh nằm ngay tiền cảnh — một cái que thay cho
// bàn tay là dấu hiệu con rối dễ thấy nhất.
// -----------------------------------------------------------------------------
function buildHandGeometry(scale, curl = .55) {
  const S = scale;
  const parts = [];
  const palm = loftGeometry([
    { y: 0, rx: .042 * S, rzF: .020 * S, rzB: .018 * S, n: 2.6, ao: .82 },
    { y: -.055 * S, rx: .048 * S, rzF: .022 * S, rzB: .020 * S, n: 2.8, ao: .9 },
    { y: -.115 * S, rx: .050 * S, rzF: .021 * S, rzB: .019 * S, n: 2.8 },
    { y: -.165 * S, rx: .046 * S, rzF: .018 * S, rzB: .016 * S, n: 2.6 }
  ], { radial: 16, capTop: true, capBottom: true });
  parts.push(palm);

  // Bốn ngón: dài khác nhau (giữa dài nhất), cong theo cùng một hướng.
  const fingerLengths = [.088, .098, .092, .074];
  fingerLengths.forEach((length, i) => {
    const x = (-.033 + i * .022) * S;
    const bend = curl * (.9 + i * .05);
    const tip = [
      x + (i - 1.5) * .004 * S,
      -.165 * S - Math.cos(bend) * length * S,
      .012 * S + Math.sin(bend) * length * S
    ];
    parts.push(tubeAlong(
      [
        [x, -.150 * S, .004 * S],
        [x, -.165 * S - Math.cos(bend * .45) * length * .42 * S, .008 * S + Math.sin(bend * .45) * length * .42 * S],
        tip
      ],
      (t) => [.0125 * S * (1 - t * .3), .0115 * S * (1 - t * .3), .9],
      { radial: 8, steps: 10, capStart: true, capEnd: true }
    ));
  });

  // Ngón cái mọc từ mô cái, hướng chéo vào trong.
  parts.push(tubeAlong(
    [
      [-.040 * S, -.045 * S, .006 * S],
      [-.062 * S, -.098 * S, .034 * S],
      [-.056 * S, -.142 * S, .062 * S]
    ],
    (t) => [.015 * S * (1 - t * .25), .014 * S * (1 - t * .25), .88],
    { radial: 8, steps: 9, capStart: true, capEnd: true }
  ));

  return mergeGeometries(parts.map((g) => weldSeamNormals(g)), false);
}


// Tấm vải cong bám theo đường sinh của thân: mỗi hàng có bán kính và bề rộng
// góc riêng. Tam giác khăn quàng dựng bằng ống dẹt sẽ là một tấm PHẲNG áp lên
// cái lưng CONG, nên hai mép vênh ra khỏi áo — đây là bản bám đúng mặt lưng.
function curvedPanelGeometry(rows, columns, radiusAt, spanAt, yAt, depth = 1) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const radius = radiusAt(v);
    const span = spanAt(v);
    const y = yAt(v);
    for (let c = 0; c <= columns; c++) {
      const u = c / columns;
      const angle = -span + span * 2 * u;
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius * depth);
      uvs.push(u * 1.4, v * 1.8);
      const shade = .82 + .18 * (1 - v);
      colors.push(shade, shade, shade);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// -----------------------------------------------------------------------------
// Khăn quàng đỏ — giữ nguyên bản sắc nhưng dựng lại cho ôm theo thân mới.
// -----------------------------------------------------------------------------
function addRedScarf(bucket, material, { neckY, neckRadius, shoulderRadius, front = -1 }) {
  // Vành khăn gập quanh cổ áo.
  bucket.add(loftGeometry([
    { y: neckY - .014, rx: neckRadius * 1.10, rzF: neckRadius * 1.05, rzB: neckRadius * 1.08, n: 2.2, ao: .8 },
    { y: neckY + .020, rx: neckRadius * 1.05, rzF: neckRadius * 1.00, rzB: neckRadius * 1.03, n: 2.2, ao: .92 },
    { y: neckY + .042, rx: neckRadius * .99, rzF: neckRadius * .95, rzB: neckRadius * .97, n: 2.2, ao: 1 }
  ], { radial: 22 }), material);

  // Phần vải phủ vai, loe ra tới đầu vai.
  bucket.add(loftGeometry([
    { y: neckY - .082, rx: shoulderRadius * .86, rzF: shoulderRadius * .66, rzB: shoulderRadius * .72, n: 2.5, ao: .76 },
    { y: neckY - .040, rx: shoulderRadius * .70, rzF: shoulderRadius * .56, rzB: shoulderRadius * .60, n: 2.4, ao: .86 },
    { y: neckY - .006, rx: neckRadius * 1.14, rzF: neckRadius * 1.08, rzB: neckRadius * 1.10, n: 2.2, ao: .94 }
  ], { radial: 24 }), material);

  // Nút thắt trước ngực.
  const knot = loftGeometry([
    { y: -.024, rx: .020, rzF: .014, rzB: .012, n: 2.4, ao: .8 },
    { y: 0, rx: .030, rzF: .022, rzB: .016, n: 2.4 },
    { y: .022, rx: .022, rzF: .016, rzB: .013, n: 2.4, ao: .88 }
  ], { radial: 14, capTop: true, capBottom: true });
  bucket.add(knot, material, matrixOf([0, neckY - .026, front * neckRadius * 1.06]));

  // Hai đuôi khăn buông, hơi lệch nhau cho khỏi đối xứng máy móc.
  [-1, 1].forEach((side, i) => {
    const tail = tubeAlong(
      [
        [side * .014, neckY - .04, front * neckRadius * 1.02],
        [side * .036, neckY - .14, front * neckRadius * 1.16],
        [side * .050 + side * i * .006, neckY - .27, front * neckRadius * 1.02]
      ],
      (t) => [.030 * (1 - t * .55), .006, .86 - t * .12],
      { radial: 8, steps: 12, capStart: true, capEnd: true }
    );
    bucket.add(tail, material);
  });

  // Tam giác sau lưng — bám đúng mặt lưng cong, thu hẹp dần xuống mũi tam giác.
  const back = -front;
  const panel = curvedPanelGeometry(
    9, 12,
    (v) => shoulderRadius * (.92 - v * .18) + .012,
    (v) => .80 * (1 - v * .93) + .02,
    (v) => neckY - .05 - v * .34,
    .72
  );
  if (back < 0) panel.rotateY(Math.PI);
  bucket.add(panel, material);
}

// -----------------------------------------------------------------------------
// Học sinh ngồi
//
// Mốc thế giới (phòng học được dựng ở tỉ lệ ~1.5x đời thực, giữ nguyên để không
// phải chỉnh lại bàn ghế và camera):
//   mặt ghế 0.63 · mặt bàn 1.06 · vai 1.50 · cằm 1.606 · đỉnh đầu 1.91
//   => HH = 0.304, thân ngồi 4.4 head-units (người thật ngồi: 4.3–4.5)
// -----------------------------------------------------------------------------
const STUDENT = {
  headHeight: .304,
  seat: .63,
  crown: 1.91,
  shoulderY: 1.50,
  chinY: 1.606
};

const geometryCache = new Map();
const cached = (key, build) => {
  if (!geometryCache.has(key)) geometryCache.set(key, build());
  return geometryCache.get(key);
};

// Thân áo học sinh: một loft liên tục hông → eo → lồng ngực → yếm vai → chân cổ.
// Vai KHÔNG phải quả cầu gắn thêm; nó là lát cắt rộng nhất của chính thân áo,
// đúng như cơ thang chạy từ cổ ra mỏm vai.
function studentTorsoGeometry(girl) {
  const H = STUDENT.headHeight;
  const shoulder = STUDENT.shoulderY;
  const chest = girl ? 1.02 : 1.0;
  const sections = [
    { y: .70, rx: .175 * chest, rzF: .120, rzB: .118, n: 2.5, ao: .8 },
    { y: .80, rx: .166 * chest, rzF: .112, rzB: .112, n: 2.5, ao: .86 },
    { y: .92, rx: .158 * chest, rzF: .108, rzB: .110, n: 2.6, ao: .9 },  // eo
    { y: 1.04, rx: .166 * chest, rzF: .114, rzB: .118, n: 2.6, ao: .94 },
    { y: 1.16, rx: .182 * chest, rzF: .124, rzB: .126, n: 2.7, ao: 1 },
    { y: 1.28, rx: .196 * chest, rzF: girl ? .136 : .128, rzB: .132, n: 2.7, ao: 1 }, // ngực
    { y: 1.38, rx: .206 * chest, rzF: .126, rzB: .130, n: 2.8, ao: 1 },
    { y: shoulder - .062, rx: .218, rzF: .112, rzB: .120, n: 2.55, ao: 1 },  // yếm vai
    { y: shoulder - .018, rx: .226, rzF: .106, rzB: .114, n: 2.5, ao: .99 }, // mỏm vai
    { y: shoulder + .022, rx: .198, rzF: .098, rzB: .106, n: 2.4, ao: .93 },
    { y: shoulder + .050, rx: .146, rzF: .086, rzB: .092, n: 2.3, ao: .84 }, // cơ thang
    { y: shoulder + .072, rx: .104, rzF: .076, rzB: .080, n: 2.2, ao: .74 }, // chân cổ
    { y: shoulder + .090, rx: .086, rzF: .070, rzB: .074, n: 2.15, ao: .68 }
  ];
  const geometry = loftGeometry(sections, { radial: 28, uRepeat: 2.4, vRepeat: 2.2, capBottom: true });
  // Nếp áo: mạnh nhất quanh eo và dưới nách, gần như không có ở yếm vai đã căng.
  addClothFolds(geometry, {
    amplitude: .05, frequency: 6, seed: girl ? 17 : 13,
    yFalloff: (y) => smoothstep((1.34 - y) * 3.4) * smoothstep((y - .68) * 6)
  });
  void H;
  return weldSeamNormals(geometry);
}

// Cổ áo sơ mi: bẻ gập nên có hai lớp. Đây là chi tiết nhỏ nhưng ở view nhìn từ
// sau lưng (camera hero) nó là thứ duy nhất phân biệt "áo" với "ống trắng".
function collarGeometry(neckY, radius) {
  const parts = [];
  // Chân cổ áo: ống đứng ôm sát cổ, chỉ hơn cổ người chừng 12%.
  parts.push(loftGeometry([
    { y: neckY - .004, rx: radius * 1.02, rzF: radius * .98, rzB: radius * 1.00, n: 2.3, ao: .80 },
    { y: neckY + .026, rx: radius * 1.05, rzF: radius * 1.00, rzB: radius * 1.03, n: 2.3, ao: .94 },
    { y: neckY + .048, rx: radius * 1.08, rzF: radius * 1.02, rzB: radius * 1.06, n: 2.3, ao: 1 }
  ], { radial: 22 }));
  // Bâu bẻ ra ngoài: ngắn, đổ xuống, chỉ loe tới 1.26 lần bán kính cổ.
  parts.push(loftGeometry([
    { y: neckY + .046, rx: radius * 1.09, rzF: radius * 1.03, rzB: radius * 1.07, n: 2.3, ao: 1 },
    { y: neckY + .030, rx: radius * 1.20, rzF: radius * 1.10, rzB: radius * 1.18, n: 2.4, ao: .9 },
    { y: neckY + .012, rx: radius * 1.26, rzF: radius * 1.08, rzB: radius * 1.24, n: 2.5, ao: .84 }
  ], { radial: 22 }));
  return mergeGeometries(parts.map((g) => weldSeamNormals(g)), false);
}

// Mảng khe mi: hình hạnh nhân hơi vồng, áp lên mặt da ở hốc mắt. Vành mảng tối
// dần nên mép chìm vào bóng hốc mắt thay vì cắt thành một đường sắc.
function eyePatchGeometry(headHeight, side) {
  const H = headHeight;
  const rings = 4;
  const segments = 22;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  positions.push(0, 0, .007 * H); colors.push(1, 1, 1); uvs.push(.5, .5);
  for (let r = 1; r <= rings; r++) {
    const s = r / rings;
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * TAU;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const halfHeight = sin >= 0 ? FACE.eyeUpper : FACE.eyeLower;
      const x = cos * FACE.eyeWidth * H * s;
      const y = sin * halfHeight * H * s;
      const z = .007 * H * (1 - s * s); // vồng ra trước ở giữa như giác mạc
      positions.push(x, y, z);
      const shade = s > .86 ? .52 : s > .68 ? .82 : 1;
      colors.push(shade, shade, shade);
      uvs.push(.5 + cos * .5 * s, .5 + sin * .5 * s);
    }
  }
  for (let i = 0; i < segments; i++) indices.push(0, 1 + i, 1 + (i + 1) % segments);
  for (let r = 1; r < rings; r++) {
    const a = 1 + (r - 1) * segments;
    const b = 1 + r * segments;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      indices.push(a + i, b + i, a + j, a + j, b + i, b + j);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.rotateY(side * .13); // mắt hơi hướng ra ngoài như hướng nhìn tự nhiên
  return geometry;
}

// Mắt, chân mày, môi, tai — dùng chung cho học sinh và cô giáo để mọi khuôn mặt
// bám cùng một bộ mốc giải phẫu.
function addFaceFeatures(bucket, materials, skin, H) {
  [-1, 1].forEach((side) => {
    bucket.add(buildEarGeometry(H, side), skin, matrixOf([side * FACE.earX * H, FACE.earY * H, FACE.earZ * H]));

    // Mắt là một mảng khe mi ôm sát mặt, KHÔNG phải quả cầu đặt trong hốc.
    // Lý do: hốc mắt chỉ được điêu khắc lõm chứ không khoét thủng, nên nhãn cầu
    // hình cầu luôn đâm xuyên qua da ở giữa trong khi mí bị chôn trong da ở
    // trên dưới — đúng cái nhìn "mắt búp bê" cần loại bỏ.
    const eyeCenter = [side * FACE.eyeX * H, FACE.eyeY * H, FACE.eyeSurfaceZ * H];
    bucket.add(eyePatchGeometry(H, side), materials.eyeWhite, matrixOf(eyeCenter));
    bucket.add(new THREE.SphereGeometry(.052 * H, 16, 10, 0, TAU, 0, Math.PI * .22), materials.iris,
      matrixOf([eyeCenter[0], eyeCenter[1], eyeCenter[2] - .045 * H], [Math.PI / 2, 0, 0]));
    // Đường mi trên — ở khoảng cách camera của trang, đây mới là thứ đọc ra
    // "con mắt"; thiếu nó thì mắt chỉ là một vệt sáng.
    bucket.add(tubeAlong(
      [
        [eyeCenter[0] - side * .060 * H, eyeCenter[1] + .004 * H, eyeCenter[2] - .014 * H],
        [eyeCenter[0], eyeCenter[1] + .029 * H, eyeCenter[2] + .004 * H],
        [eyeCenter[0] + side * .060 * H, eyeCenter[1] + .010 * H, eyeCenter[2] - .016 * H]
      ],
      (t) => [.0040 * H, .009 * H * (1 - Math.abs(t - .5) * .9), .55],
      { radial: 6, steps: 8, capStart: true, capEnd: true }
    ), materials.brow);

    // Chân mày: bám ĐÚNG mặt sọ đã lấy mẫu rồi đẩy ra ngoài một chút.
    const browPath = [.16, .46, .78].map((angle, k) =>
      surfaceOffset(H, .448, side * angle, (.018 - k * .008) * H));
    bucket.add(tubeAlong(browPath, (t) => [.0045 * H, .014 * H * (1 - t * .40), 1],
      { radial: 6, steps: 8, capStart: true, capEnd: true }), materials.brow);
  });

  // Môi: dải rất mỏng nằm sát mặt phẳng da.
  bucket.add(tubeAlong(
    [
      surfaceOffset(H, .806, -.42, .004 * H),
      surfaceOffset(H, .800, 0, .010 * H),
      surfaceOffset(H, .806, .42, .004 * H)
    ],
    (t) => [.0070 * H, .017 * H * (1 - Math.abs(t - .5) * .55), .92],
    { radial: 8, steps: 10, capStart: true, capEnd: true }
  ), materials.lip);
}

function buildStudentHead(bucket, materials, options) {
  const { headHeight, skin, hair, hairStyle, girl, index = 0 } = options;
  const H = headHeight;

  bucket.add(cached(`head-${H.toFixed(3)}`, () => buildHeadGeometry(H)).clone(), skin);
  addFaceFeatures(bucket, materials, skin, H);

  // Tóc
  const hairParts = [];
  if (girl) {
    // Nữ: chân tóc trán thấp hơn nam một chút, gáy phủ kín.
    hairParts.push(buildHairShell(H, hairlineCurve(.25, .80), { thickness: .022, rows: 16 }));
    if (hairStyle === 1) {
      // Đuôi tóc buộc cao.
      hairParts.push(buildHairLock(
        [[0, .74 * H, -.42 * H], [0, .58 * H, -.62 * H], [.02 * H, .28 * H, -.66 * H], [.03 * H, .04 * H, -.56 * H]],
        .150 * H, .128 * H, { steps: 22, radial: 14, taper: (t) => 1 - t * .35 }
      ));
      hairParts.push(buildHairLock(
        [[0, .78 * H, -.40 * H], [0, .80 * H, -.50 * H], [0, .72 * H, -.56 * H]],
        .058 * H, .050 * H, { steps: 10, radial: 10, taper: () => 1 }
      ));
    } else {
      // Tóc dài xoã: nhiều lọn chồng lớp thay vì một tấm phẳng.
      longHairLocks(H, 400 + index * 37).forEach((lock) => hairParts.push(lock));
    }
  } else {
    // Nam: tóc ngắn, chân tóc trán cao, ôm sát gáy rồi mỏng dần (fade).
    hairParts.push(buildHairShell(H, hairlineCurve(.22, .74), { thickness: .020, rows: 16 }));
    if (hairStyle === 2) {
      // Vuốt dựng phía trước.
      hairParts.push(buildHairLock(
        [[0, .82 * H, .22 * H], [0, .90 * H, .30 * H], [0, .88 * H, .38 * H]],
        .13 * H, .05 * H, { steps: 10, radial: 10, taper: (t) => 1 - t * .6 }
      ));
    }
  }
  hairParts.forEach((part) => bucket.add(part, hair));
}

export function buildStudent(index, aim) {
  const random = seededRandom(1000 + index * 977);
  const girl = index % 2 === 1;
  const hairStyle = index % 4;
  const skin = characterMaterials.skin[index % characterMaterials.skin.length];
  const hair = characterMaterials.hair[index % characterMaterials.hair.length];
  const materials = characterMaterials;

  const group = new THREE.Group();
  const H = STUDENT.headHeight;
  const shoulder = STUDENT.shoulderY;

  // --- Hông và chân (phần lớn khuất dưới bàn, nhưng bóng đổ vẫn cần đúng) ---
  const lower = new PartBucket();
  const legMaterial = girl ? materials.skirt : materials.trouser;
  lower.add(loftGeometry([
    { y: .60, rx: .148, rzF: .120, rzB: .122, n: 2.5, ao: .7 },
    { y: .68, rx: .176, rzF: .140, rzB: .146, n: 2.6, ao: .82 },
    { y: .74, rx: .178, rzF: .134, rzB: .140, n: 2.6, ao: .9 }
  ], { radial: 20, capBottom: true }), girl ? materials.skirt : materials.trouser);

  // Đùi nằm ngang dưới mặt bàn rồi gập xuống; đùi và cẳng chân là hai ống nối
  // tiếp cùng đường sinh nên đầu gối là chỗ uốn, không phải khớp cầu.
  [-1, 1].forEach((side) => {
    const thigh = tubeAlong(
      [
        [side * .086, .690, .13],
        [side * .112, .668, -.04],
        [side * .126, .640, -.22],
        [side * .131, .520, -.29]
      ],
      (t) => { const r = .082 - t * .010; return [r, r * .94, .84]; },
      { radial: 12, steps: 14, capStart: true, capEnd: true }
    );
    lower.add(thigh, legMaterial);
    const shin = tubeAlong(
      [
        [side * .131, .530, -.29],
        [side * .134, .360, -.31],
        [side * .138, .180, -.32],
        [side * .140, .085, -.33]
      ],
      (t) => { const r = .070 - t * .018; return [r, r * .95, .88]; },
      { radial: 10, steps: 12, capStart: true, capEnd: true }
    );
    lower.add(shin, girl ? materials.sock : materials.trouser);
    const shoe = loftGeometry([
      { y: .012, rx: .062, rzF: .150, rzB: .075, n: 3, ao: .7 },
      { y: .048, rx: .060, rzF: .140, rzB: .078, n: 3, ao: .86 },
      { y: .082, rx: .050, rzF: .092, rzB: .080, n: 2.6, ao: .94 },
      { y: .112, rx: .044, rzF: .058, rzB: .070, n: 2.4 }
    ], { radial: 16, capTop: true, capBottom: true });
    lower.add(shoe, materials.shoe, matrixOf([side * .142, 0, -.40]));
  });
  if (girl) {
    lower.add(loftGeometry([
      { y: .74, rx: .180, rzF: .142, rzB: .148, n: 2.6, ao: .9 },
      { y: .68, rx: .215, rzF: .186, rzB: .190, n: 2.6, ao: .82 },
      { y: .60, rx: .254, rzF: .238, rzB: .226, n: 2.5, ao: .72 }
    ], { radial: 22 }), materials.skirt);
  }
  lower.flush(group);

  // --- Thân trên (pivot cho hoạt hình) ---
  const torso = new THREE.Group();
  torso.position.set(0, 0, 0);
  group.add(torso);
  const torsoBucket = new PartBucket();
  torsoBucket.add(cached(`student-torso-${girl}`, () => studentTorsoGeometry(girl)).clone(), materials.shirt);
  torsoBucket.add(cached(`student-collar-${girl}`, () => collarGeometry(shoulder + .058, .080)).clone(), materials.shirt);
  // Cổ người, nối liền vào chân cổ của áo.
  torsoBucket.add(loftGeometry([
    { y: shoulder + .010, rx: .072, rzF: .066, rzB: .070, n: 2.2, ao: .66 },
    { y: shoulder + .070, rx: .066, rzF: .060, rzB: .064, n: 2.1, ao: .8 },
    { y: shoulder + .130, rx: .062, rzF: .058, rzB: .060, n: 2.1, ao: .94 }
  ], { radial: 18 }), skin);
  addRedScarf(torsoBucket, materials.scarf, {
    neckY: shoulder + .038, neckRadius: .096, shoulderRadius: .216, front: -1
  });
  torsoBucket.flush(torso);

  // --- Đầu ---
  const head = new THREE.Group();
  head.position.set(0, STUDENT.chinY, 0);
  torso.add(head);
  const headBucket = new PartBucket();
  buildStudentHead(headBucket, materials, { headHeight: H, skin, hair, hairStyle, girl, index });
  headBucket.flush(head);
  // Nhân vật quay lưng lại camera hero nên tóc phải đúng hướng: mặt nhìn -Z.
  head.rotation.y = Math.PI;
  head.children.forEach((child) => { child.castShadow = true; child.receiveShadow = true; });

  // --- Tay: một ống liền vai → khuỷu → cổ tay, khuỷu là chỗ uốn ---
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * .196, shoulder - .028, 0);
    torso.add(arm);
    const bucket = new PartBucket();
    // Điểm gốc nằm SÂU trong thân áo nên chỗ nối vai không bao giờ hở.
    const elbow = [side * .034, -.400, -.070];
    const wrist = [side * -.010, -.372, -.404];
    const sleeveEnd = -.185;
    // Tay áo cộc
    bucket.add(tubeAlong(
      [[side * -.062, .006, .004], [side * .006, -.086, -.004], [side * .026, sleeveEnd, -.024]],
      (t) => [.092 - t * .024, .088 - t * .024, .84 + .16 * t],
      { radial: 16, steps: 12, capStart: true, uRepeat: .55, vRepeat: .45 }
    ), materials.shirt);
    // Cánh tay + cẳng tay là MỘT ống: đây là điểm sửa "khớp cầu" rõ nhất.
    bucket.add(tubeAlong(
      [
        [side * -.014, .012, 0],
        [side * .022, -.180, -.026],
        elbow,
        [side * .014, -.396, -.212],
        wrist
      ],
      (t) => {
        // Cơ delta đầy ở mỏm vai, thon dần tới khuỷu, phình nhẹ ở cẳng tay rồi
        // thắt lại ở cổ tay.
        // Cơ delta đầy ở mỏm vai -> thon ở khuỷu -> phình nhẹ ở cẳng tay ->
        // THẮT LẠI ở cổ tay. Thiếu đoạn thắt cuối thì cẳng tay là một mái chèo.
        const r = .086 - .034 * smoothstep(t * 2.2)
          + .009 * Math.sin(clamp((t - .52) / .28) * Math.PI)
          - .019 * smoothstep((t - .74) / .26);
        return [r, r * .93, .78 + .22 * t];
      },
      { radial: 14, steps: 26, capEnd: false, uRepeat: 1.2, vRepeat: 2 }
    ), skin);
    // Bàn tay đặt trên mặt bàn.
    // Bàn tay người dài ~0.77 lần chiều cao đầu; bản trước để .165 nên trông cụt.
    bucket.add(cached('hand-student', () => buildHandGeometry(1, .48)).clone(), skin,
      matrixOf([wrist[0], wrist[1] + .012, wrist[2] - .030], [-Math.PI * .46, side * .12, 0], [1.32, 1.32, 1.32]));
    bucket.flush(arm);
    return arm;
  });

  // --- Biến thể theo từng bạn: cao thấp, dáng ngồi, độ nghiêng đầu ---
  const height = .95 + random() * .11;
  group.scale.setScalar(height);
  const lean = (random() - .5) * .10;
  torso.rotation.x = -.06 + lean * .5;
  torso.rotation.z = (random() - .5) * .055;
  head.rotation.x = .04 + (random() - .5) * .12;
  head.rotation.z = (random() - .5) * .10;
  head.rotation.y = Math.PI + (random() - .5) * .16;
  arms[0].rotation.z = (random() - .5) * .10;
  arms[1].rotation.z = (random() - .5) * .10;
  arms[0].rotation.x = (random() - .5) * .08;
  arms[1].rotation.x = (random() - .5) * .08;

  // Quay về phía cô giáo: ghế xoay ít, thân trên và đầu xoay bù thêm.
  group.rotation.y = aim * .30;
  torso.rotation.y = aim * .28;
  head.rotation.y += aim * .34;

  markRest(torso, head, arms[0], arms[1]);
  return { group, bones: { spine: torso, head, leftArm: arms[0], rightArm: arms[1] } };
}

// -----------------------------------------------------------------------------
// Cô giáo mặc áo dài
//
// Mốc: đỉnh đầu 2.16 · cằm 1.868 · vai 1.751 · eo 1.30 · gối 0.525 · HH 0.292
//   => 7.4 head-units, đúng tỉ lệ phụ nữ trưởng thành (bản cũ là 6.5).
// -----------------------------------------------------------------------------
const TEACHER = {
  headHeight: .292,
  crown: 2.16,
  chinY: 1.868,
  shoulderY: 1.751,
  waistY: 1.30,
  hipY: 1.12
};

export function markRest(...objects) {
  objects.forEach((object) => { object.userData.restRotation = object.rotation.clone(); });
}

function teacherTorsoGeometry() {
  const T = TEACHER;
  const sections = [
    { y: T.hipY - .02, rx: .176, rzF: .120, rzB: .122, n: 2.55, ao: .84 },
    { y: T.hipY + .06, rx: .170, rzF: .114, rzB: .116, n: 2.5, ao: .88 },
    { y: T.waistY - .06, rx: .150, rzF: .100, rzB: .104, n: 2.6, ao: .92 },
    { y: T.waistY, rx: .143, rzF: .096, rzB: .100, n: 2.6, ao: .95 },   // eo thắt
    { y: T.waistY + .10, rx: .154, rzF: .108, rzB: .106, n: 2.6, ao: 1 },
    { y: T.waistY + .20, rx: .170, rzF: .126, rzB: .114, n: 2.6, ao: 1 }, // ngực
    { y: T.waistY + .30, rx: .178, rzF: .118, rzB: .116, n: 2.7, ao: 1 },
    { y: T.shoulderY - .062, rx: .190, rzF: .104, rzB: .110, n: 2.5, ao: 1 },
    { y: T.shoulderY - .018, rx: .197, rzF: .098, rzB: .106, n: 2.45, ao: .99 }, // mỏm vai
    { y: T.shoulderY + .020, rx: .172, rzF: .092, rzB: .098, n: 2.35, ao: .93 },
    { y: T.shoulderY + .048, rx: .126, rzF: .082, rzB: .088, n: 2.25, ao: .84 }, // cơ thang
    { y: T.shoulderY + .070, rx: .092, rzF: .072, rzB: .076, n: 2.2, ao: .74 },
    { y: T.shoulderY + .088, rx: .078, rzF: .066, rzB: .070, n: 2.15, ao: .68 }
  ];
  const geometry = loftGeometry(sections, { radial: 28, uRepeat: 2.2, vRepeat: 2.6, capBottom: true });
  addClothFolds(geometry, {
    amplitude: .035, frequency: 8, seed: 41,
    yFalloff: (y) => smoothstep((T.shoulderY - .10 - y) * 5) * smoothstep((y - T.hipY + .08) * 6)
  });
  return weldSeamNormals(geometry);
}

export function buildTeacher() {
  const T = TEACHER;
  const H = T.headHeight;
  const materials = characterMaterials;
  const skin = materials.skin[1];
  const hair = materials.hair[0];

  const root = new THREE.Group();
  const lower = new PartBucket();

  // Quần lụa ống rộng: một ống liền từ hông xuống mắt cá, loe dần.
  [-1, 1].forEach((side) => {
    lower.add(tubeAlong(
      [
        [side * .088, T.hipY + .02, 0],
        [side * .100, T.hipY - .30, .006],
        [side * .108, .525, .012],
        [side * .112, .240, .020],
        [side * .114, .060, .026]
      ],
      (t) => {
        const r = .116 + t * .040 - .026 * smoothstep((t - .55) * 2.4);
        return [r, r * .96, .82 + .18 * (1 - t)];
      },
      { radial: 16, steps: 24, capEnd: true, uRepeat: 1.4, vRepeat: 3.4 }
    ), materials.aoDaiTrouser);
    const shoe = loftGeometry([
      { y: .006, rx: .052, rzF: .128, rzB: .062, n: 3, ao: .72 },
      { y: .038, rx: .050, rzF: .118, rzB: .066, n: 3, ao: .88 },
      { y: .070, rx: .042, rzF: .074, rzB: .068, n: 2.5 }
    ], { radial: 14, capTop: true, capBottom: true });
    lower.add(shoe, new THREE.MeshPhysicalMaterial({ color: 0xe6d9cb, roughness: .38, metalness: .06, clearcoat: .5, vertexColors: true }),
      matrixOf([side * .112, 0, .028]));
  });

  // Hai tà áo dài: cung trước và cung sau, xẻ hở hai bên hông. Mỗi tà là một
  // loft dựng THẲNG trên khoảng góc của nó, nên mép tà là đường cong sạch. Bản
  // đầu cắt tam giác khỏi một ống kín và mép rách lởm chởm như vải bị xé.
  // Lát trên cùng của tà trùng bán kính với thân áo ở cùng độ cao nên áo dài
  // đọc ra một tấm liền từ cổ xuống gấu, không có đường ngang ở eo.
  const panelSections = [
    { y: T.hipY + .02, rx: .176, rzF: .120, rzB: .122, n: 2.6, ao: .96 },
    { y: 1.06, rx: .181, rzF: .126, rzB: .128, n: 2.6, ao: .94 },
    { y: .98, rx: .188, rzF: .134, rzB: .136, n: 2.6, ao: .92 },
    { y: .90, rx: .195, rzF: .143, rzB: .145, n: 2.55, ao: .90 },
    { y: .82, rx: .202, rzF: .152, rzB: .154, n: 2.5, ao: .88 },
    { y: .74, rx: .210, rzF: .162, rzB: .164, n: 2.5, ao: .86 },
    { y: .66, rx: .218, rzF: .172, rzB: .174, n: 2.5, ao: .84 },
    { y: .58, rx: .226, rzF: .182, rzB: .184, n: 2.45, ao: .82 },
    { y: .50, rx: .234, rzF: .192, rzB: .194, n: 2.4, ao: .8 }
  ];
  [0, Math.PI].forEach((center, i) => {
    const halfSpan = Math.PI * .43;
    const panel = loftGeometry(panelSections, {
      radial: 26, uRepeat: 1.6, vRepeat: 3.2,
      phiStart: center - halfSpan, phiLength: halfSpan * 2
    });
    addClothFolds(panel, { amplitude: .022, frequency: 4, seed: i ? 61 : 59 });
    lower.add(weldSeamNormals(panel), materials.aoDai);
  });
  lower.flush(root);

  // --- Thân áo (pivot) ---
  const torso = new THREE.Group();
  root.add(torso);
  const torsoBucket = new PartBucket();
  torsoBucket.add(teacherTorsoGeometry(), materials.aoDai);
  // Cổ đứng áo dài + viền chỉ vàng. Mép trên phải nằm DƯỚI cằm (1.868) — bản
  // đầu để tới 1.901 nên cổ áo nuốt mất hàm và nhân vật thành không có cổ.
  torsoBucket.add(loftGeometry([
    { y: T.shoulderY + .028, rx: .080, rzF: .072, rzB: .076, n: 2.2, ao: .82 },
    { y: T.shoulderY + .062, rx: .076, rzF: .069, rzB: .073, n: 2.2, ao: .94 },
    { y: T.shoulderY + .092, rx: .074, rzF: .067, rzB: .071, n: 2.2, ao: 1 }
  ], { radial: 20 }), materials.aoDai);
  torsoBucket.add(new THREE.TorusGeometry(.075, .0050, 8, 26), materials.aoDaiTrim,
    matrixOf([0, T.shoulderY + .094, 0], [Math.PI / 2, 0, 0]));
  // Cổ người: nghiêng nhẹ về trước như cổ thật, không phải ống thẳng đứng.
  torsoBucket.add(loftGeometry([
    { y: T.shoulderY + .010, rx: .064, rzF: .058, rzB: .062, n: 2.1, ao: .62, cz: -.004 },
    { y: T.shoulderY + .070, rx: .058, rzF: .053, rzB: .056, n: 2.1, ao: .80, cz: .004 },
    { y: T.shoulderY + .130, rx: .055, rzF: .051, rzB: .053, n: 2.1, ao: .95, cz: .012 }
  ], { radial: 18 }), skin);

  // Hàng nút chạy chéo từ cổ xuống sườn — dấu nhận dạng của áo dài.
  const placket = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, T.shoulderY + .06, .098),
    new THREE.Vector3(-.052, T.shoulderY - .03, .112),
    new THREE.Vector3(-.104, T.shoulderY - .13, .090),
    new THREE.Vector3(-.148, T.shoulderY - .24, .022),
    new THREE.Vector3(-.162, T.shoulderY - .35, -.020)
  ]);
  torsoBucket.add(new THREE.TubeGeometry(placket, 28, .0062, 6, false), materials.aoDaiTrim);
  [.16, .44, .72].forEach((u) => {
    const point = placket.getPoint(u);
    torsoBucket.add(new THREE.SphereGeometry(.0125, 10, 8), materials.aoDaiTrim, matrixOf([point.x, point.y, point.z]));
  });
  torsoBucket.flush(torso);

  // --- Đầu ---
  const head = new THREE.Group();
  head.position.set(0, T.chinY, 0);
  torso.add(head);
  const headBucket = new PartBucket();
  headBucket.add(buildHeadGeometry(H, { chinTuck: .02 }), skin);
  addFaceFeatures(headBucket, materials, skin, H);

  // Tóc dài rẽ ngôi, xoã sau lưng — theo đúng ảnh tham chiếu.
  headBucket.add(buildHairShell(H, hairlineCurve(.25, .80), { thickness: .024, rows: 16 }), hair);
  longHairLocks(H, 91).forEach((lock) => headBucket.add(lock, hair));
  headBucket.flush(head);

  // --- Tay: trái đưa lên chỉ vào học liệu, phải thả tự nhiên ---
  const arms = {};
  [-1, 1].forEach((side) => {
    const raised = side > 0;
    const arm = new THREE.Group();
    arm.position.set(side * .172, T.shoulderY - .030, 0);
    torso.add(arm);
    const bucket = new PartBucket();
    const elbow = raised ? [side * .200, -.060, .060] : [side * .046, -.250, .028];
    const wrist = raised ? [side * .372, .142, .096] : [side * .020, -.492, .076];
    // Tay áo dài ôm suốt tới cổ tay -> cả ống là vải, chỉ bàn tay là da.
    bucket.add(tubeAlong(
      [[side * -.020, .036, 0], [side * .010, -.086, .006], elbow, [side * (raised ? .300 : .034), (raised ? .044 : -.376), (raised ? .080 : .052)], wrist],
      (t) => {
        const r = .080 - .030 * smoothstep(t * 2.1) + .008 * Math.sin(clamp((t - .5) / .4) * Math.PI);
        return [r, r * .94, .8 + .2 * t];
      },
      { radial: 14, steps: 26, capStart: true, uRepeat: 1.2, vRepeat: 2.6 }
    ), materials.aoDai);
    // Bàn tay
    const direction = new THREE.Vector3(...wrist).sub(new THREE.Vector3(...elbow)).normalize();
    const handRotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction)
    );
    bucket.add(cached('hand-teacher', () => buildHandGeometry(1.02, raised ? .22 : .42)).clone(), skin,
      matrixOf(wrist, [handRotation.x, handRotation.y, handRotation.z], [1.28, 1.28, 1.28]));
    bucket.flush(arm);
    if (raised) arms.left = arm; else arms.right = arm;
  });

  markRest(torso, head, arms.left, arms.right);
  root.userData.bones = { spine: torso, head, leftArm: arms.left, rightArm: arms.right };
  return root;
}

export const teacherAnchor = new THREE.Vector3(-2.75, 0, -4.15);
export const studentMetrics = STUDENT;
export const teacherMetrics = TEACHER;
