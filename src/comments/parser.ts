import { moment } from "obsidian";

// ---------------------------------------------------------------------------
// Formato salvo no markdown
//
// ```comments
// @ Ana | 2026-09-16T14:32:10-03:00
// Corpo do comentário, pode ter várias linhas e markdown.
//
// @ Yuri | 2026-09-15T09:10:00-03:00 | arquivado
// Outro comentário (arquivado: aparece riscado e muted).
// ```
// ---------------------------------------------------------------------------

export const LANG = "comments";

/** Terceiro campo opcional do cabeçalho que marca o comentário como arquivado. */
export const ARCHIVED_FLAG = "arquivado";

export interface Comment {
  author: string;
  date: string; // ISO 8601
  body: string;
  archived: boolean;
}

export interface CommentsBlock {
  /** Índice da linha do fence de abertura. */
  lineStart: number;
  /** Índice da linha do fence de fechamento, ou lines.length se não fechado. */
  lineEnd: number;
  /** Linhas estritamente entre os fences, unidas por "\n". */
  body: string;
}

// ---- Cabeçalho -------------------------------------------------------------

const ISO = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})`;

/**
 * `@ Autor | 2026-09-16T14:32:10-03:00` — autor sem `|`, data ISO 8601 estrita,
 * seguido opcionalmente de `| arquivado`.
 */
export const HEADER_RE = new RegExp(
  String.raw`^@[ \t]*([^\s|][^|\r\n]*?)[ \t]*\|[ \t]*(${ISO})(?:[ \t]*\|[ \t]*(${ARCHIVED_FLAG}))?[ \t]*\r?$`
);

export function isValidIsoDate(s: string): boolean {
  return moment(s, moment.ISO_8601, true).isValid();
}

export function parseHeader(
  line: string
): { author: string; date: string; archived: boolean } | null {
  const m = HEADER_RE.exec(line);
  if (!m) return null;
  const author = m[1] ?? "";
  const date = m[2] ?? "";
  if (!author || !isValidIsoDate(date)) return null;
  return { author, date, archived: m[3] === ARCHIVED_FLAG };
}

export function isSameComment(line: string, c: Comment): boolean {
  const h = parseHeader(line);
  return !!h && h.author === c.author && h.date === c.date;
}

// ---- Comentários dentro de um bloco ---------------------------------------

export function parseComments(src: string): Comment[] {
  const comments: Comment[] = [];
  let current: Comment | null = null;

  for (const line of src.split("\n")) {
    const h = parseHeader(line);
    if (h) {
      if (current) comments.push(current);
      current = {
        author: h.author,
        date: h.date,
        body: "",
        archived: h.archived,
      };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) comments.push(current);

  for (const c of comments) c.body = c.body.trim();
  return comments;
}

function dateValue(c: Comment): number {
  return moment(c.date, moment.ISO_8601, true).valueOf();
}

/** Mais novo primeiro. */
export function sortNewestFirst(list: Comment[]): Comment[] {
  return [...list].sort((a, b) => dateValue(b) - dateValue(a));
}

/** Linha de cabeçalho, sem quebra de linha final. */
export function serializeHeader(c: Comment): string {
  const flag = c.archived ? ` | ${ARCHIVED_FLAG}` : "";
  return `@ ${c.author} | ${c.date}${flag}`;
}

export function serialize(c: Comment): string {
  return `${serializeHeader(c)}\n${c.body}\n`;
}

// ---- Blocos ```comments no texto completo ----------------------------------

const OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?$/;

interface OpenFence {
  ch: string;
  len: number;
  start: number;
  isComments: boolean;
}

/**
 * Varre o texto respeitando fences (``` ou ~~~, 3 ou mais caracteres) e
 * devolve todos os blocos cuja linguagem é `comments`. Fences dentro de
 * outros fences são ignorados. Bloco sem fechamento vai até o fim do arquivo.
 */
export function findCommentsBlocks(text: string): CommentsBlock[] {
  const lines = text.split("\n");
  const out: CommentsBlock[] = [];
  let open: OpenFence | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (open) {
      const m = CLOSE_RE.exec(line);
      const fence = m?.[1] ?? "";
      if (m && fence.charAt(0) === open.ch && fence.length >= open.len) {
        if (open.isComments) {
          out.push({
            lineStart: open.start,
            lineEnd: i,
            body: lines.slice(open.start + 1, i).join("\n"),
          });
        }
        open = null;
      }
      continue;
    }

    const m = OPEN_RE.exec(line);
    if (!m) continue;
    const fence = m[1] ?? "";
    const info = (m[2] ?? "").trim();
    // CommonMark: info string de fence com crase não pode conter crase.
    if (fence.charAt(0) === "`" && info.includes("`")) continue;
    const lang = info.split(/\s+/)[0] ?? "";
    open = {
      ch: fence.charAt(0),
      len: fence.length,
      start: i,
      isComments: lang === LANG,
    };
  }

  if (open?.isComments) {
    out.push({
      lineStart: open.start,
      lineEnd: lines.length,
      body: lines.slice(open.start + 1).join("\n"),
    });
  }
  return out;
}

/** Todos os comentários de todos os blocos da nota, mais novo primeiro. */
export function collectComments(text: string): Comment[] {
  return sortNewestFirst(
    findCommentsBlocks(text).flatMap((b) => parseComments(b.body))
  );
}
