// Minimal Word (.docx) writer with no dependencies: a document is a ZIP (stored, uncompressed) of a few XML parts.
// blocks: [{style:'Title'|'Heading1'|'Heading2'|'Normal'|'Meta', text}]
const xml = value => String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const [name, content] of files) {
    const data = typeof content === 'string' ? enc.encode(content) : content, path = enc.encode(name), crc = crc32(data);
    // Version 20, flag bit 11 (UTF-8 names), method 0 (stored), fixed DOS time 1980-01-01.
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(path.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...common, ...path]);
    parts.push(local, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...path]));
    offset += local.length + data.length;
  }
  const size = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(size), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0; for (const part of all) { out.set(part, at); at += part.length; }
  return out;
}
function paragraph({ style = 'Normal', text = '' }) {
  const runs = String(text).split('\n').map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('');
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs}</w:p>`;
}
const style = (id, name, size, { bold = false, color = '202B38', after = 120, before = 0 } = {}) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="${before}" w:after="${after}"/>${id.startsWith('Heading') ? `<w:outlineLvl w:val="${Number(id.slice(-1)) - 1}"/>` : ''}</w:pPr><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
export function buildDocx(blocks, { title = 'Knowledge Review' } = {}) {
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style('Title', 'Title', 40, { bold: true, color: '30694F', after: 240 })}${style('Heading1', 'heading 1', 30, { bold: true, color: '30694F', before: 360, after: 160 })}${style('Heading2', 'heading 2', 25, { bold: true, before: 240, after: 80 })}${style('Meta', 'Meta', 18, { color: '6C7784', after: 160 })}</w:styles>`;
  const body = blocks.map(paragraph).join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1304" w:bottom="1440" w:left="1304" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['word/styles.xml', styles],
    ['word/document.xml', document],
  ]);
}
export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
