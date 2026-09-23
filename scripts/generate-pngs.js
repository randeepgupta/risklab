import fs from 'fs';
import zlib from 'zlib';

function createSolidPNG(width, height, r, g, b, a = 255) {
  // Create raw RGBA image data with scanline filter bytes (0x00 = None)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Calculate distance from center for subtle shield/circle graphic
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.42;

      if (dist < radius) {
        // Emerald core & accent
        const innerDist = Math.sqrt(dx * dx + (dy + height * 0.05) * (dy + height * 0.05));
        if (innerDist < radius * 0.45 && Math.abs(dx) < radius * 0.25) {
          rawData[pixelOffset] = 16;     // R
          rawData[pixelOffset + 1] = 185; // G (Emerald #10b981)
          rawData[pixelOffset + 2] = 129; // B
          rawData[pixelOffset + 3] = 255;
        } else {
          rawData[pixelOffset] = 30;     // #1e293b
          rawData[pixelOffset + 1] = 41;
          rawData[pixelOffset + 2] = 59;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        // Deep background #0b0f19
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = a;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // Color type 6 = RGBA
  ihdr[10] = 0; // Compression (0 = deflate)
  ihdr[11] = 0; // Filter (0 = adaptive)
  ihdr[12] = 0; // Interlace (0 = none)

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuf, data]);

    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcData), 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Simple CRC32 table & function
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

fs.writeFileSync('public/pwa-192x192.png', createSolidPNG(192, 192, 11, 15, 25));
fs.writeFileSync('public/pwa-512x512.png', createSolidPNG(512, 512, 11, 15, 25));
fs.writeFileSync('public/pwa-maskable-512x512.png', createSolidPNG(512, 512, 11, 15, 25));
fs.writeFileSync('public/apple-touch-icon.png', createSolidPNG(180, 180, 11, 15, 25));
console.log('Successfully generated PNG icons for PWA.');
