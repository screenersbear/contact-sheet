// A small PDF writer: JPEGs and short lines of text placed on landscape
// sheets. JPEGs go in exactly as they are, so nothing is re-compressed and
// a long notebook never needs one big canvas.
//
// Everything is measured in points from the sheet's bottom-left corner.
export const SHEET_W = 792; // US Letter, landscape
export const SHEET_H = 612;

const enc = new TextEncoder();
const n2 = (v) => Number(v).toFixed(2);

// sheets: [{ images: [{ jpeg, pxW, pxH, x, y, w, h, outline }], text: [{ x, y, size, str }] }]
// A jpeg (a Uint8Array) used on several sheets is stored once.
export function makePdf(sheets) {
  const parts = [];
  const offsets = [];
  let size = 0;
  const put = (v) => {
    const bytes = typeof v === 'string' ? enc.encode(v) : v;
    parts.push(bytes);
    size += bytes.length;
  };
  const obj = (id, write) => {
    offsets[id] = size;
    put(`${id} 0 obj\n`);
    write();
    put('\nendobj\n');
  };

  // 1 catalog, 2 page list, 3 font, then images, then each page and its content.
  let next = 4;
  const images = new Map();
  for (const sheet of sheets) {
    for (const im of sheet.images) {
      if (!images.has(im.jpeg)) images.set(im.jpeg, { id: next++, pxW: im.pxW, pxH: im.pxH });
    }
  }
  const pageIds = sheets.map(() => {
    const id = next;
    next += 2;
    return id;
  });

  put('%PDF-1.4\n');
  put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // marks the file as binary
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Count ${sheets.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`));
  obj(3, () => put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  for (const [jpeg, im] of images) {
    obj(im.id, () => {
      put(`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      put(jpeg);
      put('\nendstream');
    });
  }

  sheets.forEach((sheet, i) => {
    const pageId = pageIds[i];
    let draw = '';
    for (const im of sheet.images) {
      const name = `Im${images.get(im.jpeg).id}`;
      draw += `q ${n2(im.w)} 0 0 ${n2(im.h)} ${n2(im.x)} ${n2(im.y)} cm /${name} Do Q\n`;
      // A hairline shows where a page ends, even a white one on white paper.
      if (im.outline) draw += `q 0.82 G 0.25 w ${n2(im.x)} ${n2(im.y)} ${n2(im.w)} ${n2(im.h)} re S Q\n`;
    }
    for (const t of sheet.text || []) {
      const safe = String(t.str).replace(/[\\()]/g, '\\$&');
      draw += `q 0.19 0.24 0.27 rg BT /F1 ${n2(t.size)} Tf ${n2(t.x)} ${n2(t.y)} Td (${safe}) Tj ET Q\n`;
    }
    const used = [...new Set(sheet.images.map((im) => images.get(im.jpeg).id))];
    obj(pageId, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SHEET_W} ${SHEET_H}] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 3 0 R >> /XObject << ${used.map((id) => `/Im${id} ${id} 0 R`).join(' ')} >> >> >>`));
    const stream = enc.encode(draw);
    obj(pageId + 1, () => {
      put(`<< /Length ${stream.length} >>\nstream\n`);
      put(stream);
      put('\nendstream');
    });
  });

  const xref = size;
  let table = `xref\n0 ${next}\n0000000000 65535 f \n`;
  for (let id = 1; id < next; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  put(table);
  put(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
