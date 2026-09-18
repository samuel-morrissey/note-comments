import { Notice, Plugin } from "obsidian";
import { LANG, findCommentsBlocks } from "../comments/parser";

export function registerAddBlockCommand(plugin: Plugin): void {
  plugin.addCommand({
    id: "add-comments-block",
    name: "Adicionar seção de comentários à nota",
    editorCallback: (editor) => {
      const text = editor.getValue();
      if (findCommentsBlocks(text).length > 0) {
        new Notice("Esta nota já tem uma seção de comentários.");
        return;
      }
      const fence = "```";
      editor.setValue(
        `${text.trimEnd()}\n\n## Comentários\n\n${fence}${LANG}\n${fence}\n`
      );
      new Notice("Seção de comentários adicionada.");
    },
  });
}
