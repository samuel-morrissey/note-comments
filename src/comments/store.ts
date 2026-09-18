import { App, TFile } from "obsidian";
import {
  Comment,
  LANG,
  findCommentsBlocks,
  isSameComment,
  parseHeader,
  serialize,
  serializeHeader,
} from "./parser";

/**
 * Grava o comentário no último bloco `comments` da nota. Se a nota não tiver
 * bloco, acrescenta um no fim (sem título).
 */
export async function addComment(
  app: App,
  file: TFile,
  c: Comment
): Promise<void> {
  await app.vault.process(file, (data) => {
    const blocks = findCommentsBlocks(data);
    const last = blocks[blocks.length - 1];

    if (!last) {
      const base = data.trimEnd();
      const fence = "```";
      return `${base}${base ? "\n\n" : ""}${fence}${LANG}\n${serialize(c)}${fence}\n`;
    }

    const lines = data.split("\n");
    lines.splice(last.lineStart + 1, 0, serialize(c));
    return lines.join("\n");
  });
}

/**
 * Remove a primeira ocorrência do comentário (autor + data) em qualquer bloco
 * `comments`, apagando o cabeçalho e o corpo até o próximo cabeçalho válido
 * ou até o fechamento do bloco.
 */
export async function removeComment(
  app: App,
  file: TFile,
  c: Comment
): Promise<void> {
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");

    for (const b of findCommentsBlocks(data)) {
      for (let i = b.lineStart + 1; i < b.lineEnd; i++) {
        if (!isSameComment(lines[i] ?? "", c)) continue;
        let end = i + 1;
        while (end < b.lineEnd && !parseHeader(lines[end] ?? "")) end++;
        lines.splice(i, end - i);
        return lines.join("\n");
      }
    }
    return data;
  });
}

/**
 * Substitui só o corpo do comentário (autor + data), na primeira ocorrência em
 * qualquer bloco. O cabeçalho fica intacto (data e flag de arquivado não
 * mudam) e as linhas em branco no fim do corpo antigo são preservadas para
 * manter o espaçamento entre comentários.
 */
export async function updateCommentBody(
  app: App,
  file: TFile,
  c: Comment,
  body: string
): Promise<void> {
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");

    for (const b of findCommentsBlocks(data)) {
      for (let i = b.lineStart + 1; i < b.lineEnd; i++) {
        if (!isSameComment(lines[i] ?? "", c)) continue;
        let end = i + 1;
        while (end < b.lineEnd && !parseHeader(lines[end] ?? "")) end++;

        let blank = 0;
        while (end - 1 - blank > i && (lines[end - 1 - blank] ?? "").trim() === "") {
          blank++;
        }

        lines.splice(
          i + 1,
          end - (i + 1),
          ...body.split("\n"),
          ...Array<string>(blank).fill("")
        );
        return lines.join("\n");
      }
    }
    return data;
  });
}

/**
 * Marca ou desmarca o comentário (autor + data) como arquivado, reescrevendo
 * apenas a linha do cabeçalho na primeira ocorrência em qualquer bloco.
 */
export async function setCommentArchived(
  app: App,
  file: TFile,
  c: Comment,
  archived: boolean
): Promise<void> {
  await app.vault.process(file, (data) => {
    const lines = data.split("\n");

    for (const b of findCommentsBlocks(data)) {
      for (let i = b.lineStart + 1; i < b.lineEnd; i++) {
        if (!isSameComment(lines[i] ?? "", c)) continue;
        lines[i] = serializeHeader({ ...c, archived });
        return lines.join("\n");
      }
    }
    return data;
  });
}
