// API route — generate cover letter as .docx (Cornell letterhead template)

import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const FONT = "Times New Roman";
const SIZE_BODY = 22; // half-points = 11pt
const SIZE_NAME = 28; // half-points = 14pt

const LETTERHEAD_NAME = "Maria Susana Chang Vegas";
const LETTERHEAD_CONTACT =
  "Ithaca, NY | +1 (607) 379-3864 | marisu.chang@gmail.com | linkedin.com/in/mariasusanachangv";
const LETTERHEAD_EMAIL = "marisu.chang@gmail.com";

function formatDate(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function para(
  text: string,
  opts: { bold?: boolean; centered?: boolean; size?: number; spaceAfter?: number } = {}
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        font: FONT,
        size: opts.size ?? SIZE_BODY,
      }),
    ],
    alignment: opts.centered ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: 240, after: opts.spaceAfter ?? 0 },
  });
}

function blank(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "", font: FONT, size: SIZE_BODY })],
    spacing: { line: 240, after: 0 },
  });
}

function rule(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "", font: FONT, size: SIZE_BODY })],
    border: {
      bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    spacing: { line: 240, after: 0 },
  });
}

const SKIP_PREFIX = /^(dear|sincerely|best regards|warm regards|yours|regards)/i;

function parseCoverLetter(text: string): { salutation: string; paragraphs: string[] } {
  const chunks = text.split(/\n\n+/).map((c) => c.trim()).filter(Boolean);

  let salutation = "Dear Hiring Manager,";
  const paragraphs: string[] = [];

  for (const chunk of chunks) {
    if (SKIP_PREFIX.test(chunk)) {
      if (/^dear/i.test(chunk)) {
        const line = chunk.split("\n")[0].trim();
        salutation = line.endsWith(",") ? line : line + ",";
      }
      continue;
    }
    paragraphs.push(chunk);
  }

  return { salutation, paragraphs };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      coverLetterText: string;
      company: string;
      role: string;
    };

    const { coverLetterText, company } = body;
    const { salutation, paragraphs } = parseCoverLetter(coverLetterText);

    const children: Paragraph[] = [
      // Letterhead
      para(LETTERHEAD_NAME, { bold: true, centered: true, size: SIZE_NAME }),
      para(LETTERHEAD_CONTACT, { centered: true }),
      rule(),
      blank(),
      // Date
      para(formatDate(new Date())),
      blank(),
      // Recipient block
      para("Hiring Manager"),
      ...(company && company !== "Unknown" ? [para(company)] : []),
      blank(),
      // Salutation
      para(salutation),
      blank(),
      // Body paragraphs
      ...paragraphs.map((p) => para(p, { spaceAfter: 240 })),
      blank(),
      // Closing
      para("Sincerely,"),
      blank(),
      blank(),
      blank(),
      para(LETTERHEAD_NAME),
      para(LETTERHEAD_EMAIL),
    ];

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8Array = new Uint8Array(buffer);
    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="cover-letter.docx"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `download-cover-letter: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
