function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxLength: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

export function buildPdf(pages: string[][]) {
  const objects: string[] = [];

  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  const contentObjectIds = pages.map((_, index) => 5 + index * 2);

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((lines, index) => {
    const textCommands = ["BT", "/F1 18 Tf", "48 760 Td"];
    const wrappedLines = lines.flatMap((line) => wrapText(line, 82));

    wrappedLines.forEach((line, lineIndex) => {
      const escapedLine = escapePdfText(line);

      if (lineIndex === 0) {
        textCommands.push(`(${escapedLine}) Tj`);
      } else {
        textCommands.push("0 -24 Td");
        textCommands.push(`(${escapedLine}) Tj`);
      }
    });

    textCommands.push("ET");

    const contentStream = textCommands.join("\n");
    const contentObject = `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`;

    objects[index * 2 + 3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`;
    objects[index * 2 + 4] = contentObject;
  });

  const header = "%PDF-1.4\n";
  const bodyParts: string[] = [];
  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, "utf8");

  objects.forEach((object, index) => {
    const objectText = `${index + 1} 0 obj\n${object}\nendobj\n`;
    offsets.push(currentOffset);
    bodyParts.push(objectText);
    currentOffset += Buffer.byteLength(objectText, "utf8");
  });

  const xrefOffset = currentOffset;
  const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];

  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${offsets[index].toString().padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    `${xrefOffset}`,
    "%%EOF",
  ].join("\n");

  return Buffer.from(`${header}${bodyParts.join("")}${xrefLines.join("\n")}\n${trailer}`, "utf8");
}
