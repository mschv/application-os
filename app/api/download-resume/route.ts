// API route — generate resume as .docx (Cornell format)

import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";

const FONT = "Times New Roman";
const SIZE_BODY = 21; // half-points = 10.5pt
const SIZE_NAME = 36; // half-points = 18pt
const NUMBERING_REF = "resume-bullets";

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(
        new TextRun({ text: text.slice(lastIndex, match.index), font: FONT, size: SIZE_BODY })
      );
    }
    const matched = match[0];
    if (matched.startsWith("**")) {
      runs.push(
        new TextRun({ text: matched.slice(2, -2), bold: true, font: FONT, size: SIZE_BODY })
      );
    } else {
      runs.push(
        new TextRun({ text: matched.slice(1, -1), italics: true, font: FONT, size: SIZE_BODY })
      );
    }
    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), font: FONT, size: SIZE_BODY }));
  }

  return runs.length
    ? runs
    : [new TextRun({ text: "", font: FONT, size: SIZE_BODY })];
}

function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, font: FONT, size: SIZE_BODY }),
    ],
    border: {
      bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 4 },
    },
    spacing: { before: 120, after: 60 },
  });
}

function jobHeaderParagraph(company: string, role: string, date: string): Paragraph {
  const children: TextRun[] = [
    new TextRun({ text: company, bold: true, font: FONT, size: SIZE_BODY }),
  ];
  if (role) {
    children.push(new TextRun({ text: " | ", font: FONT, size: SIZE_BODY }));
    children.push(new TextRun({ text: role, italics: true, font: FONT, size: SIZE_BODY }));
  }
  if (date) {
    children.push(new TextRun({ text: "\t", font: FONT, size: SIZE_BODY }));
    children.push(new TextRun({ text: date, font: FONT, size: SIZE_BODY }));
  }
  return new Paragraph({
    children,
    tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
    spacing: { after: 0 },
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    children: parseInline(text),
    numbering: { reference: NUMBERING_REF, level: 0 },
    spacing: { after: 0, line: 240 },
  });
}

function spacer(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "", font: FONT, size: 10 })],
    spacing: { after: 0 },
  });
}

function bodyMixed(text: string): Paragraph {
  return new Paragraph({
    children: parseInline(text),
    spacing: { after: 0 },
  });
}

function parseResumeBody(resumeText: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const line of resumeText.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push(spacer());
      continue;
    }

    if (/^#{1,2}\s/.test(trimmed)) {
      paragraphs.push(sectionHeader(trimmed.replace(/^#+\s*/, "")));
      continue;
    }

    if (trimmed.startsWith("- ")) {
      paragraphs.push(bulletParagraph(trimmed.slice(2)));
      continue;
    }

    if (trimmed.startsWith("**") && (trimmed.includes("|") || trimmed.includes("\t"))) {
      const sep = trimmed.includes("|") ? "|" : "\t";
      const parts = trimmed.split(sep).map((p) => p.trim());
      const company = parts[0].replace(/\*\*/g, "").trim();
      const role = (parts[1] ?? "").replace(/\*/g, "").trim();
      const date = (parts[2] ?? "").replace(/\*/g, "").trim();
      paragraphs.push(jobHeaderParagraph(company, role, date));
      continue;
    }

    paragraphs.push(bodyMixed(trimmed));
  }

  return paragraphs;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      resumeText: string;
      candidateName: string;
      email: string;
      phone: string;
      location: string;
      linkedin: string;
      portfolio: string;
    };

    const { resumeText, candidateName, email, phone, location, linkedin, portfolio } = body;

    const contactText = [email, phone, location, linkedin, portfolio]
      .filter(Boolean)
      .join(" ● ");

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: NUMBERING_REF,
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "•",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 360, hanging: 360 },
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 720, right: 900, bottom: 720, left: 900 },
            },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: candidateName, bold: true, font: FONT, size: SIZE_NAME }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: contactText, font: FONT, size: SIZE_BODY }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
            }),
            ...parseResumeBody(resumeText),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="resume.docx"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `download-resume: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
