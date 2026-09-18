import { MarkdownRenderChild, Plugin } from "obsidian";
import { LANG } from "../comments/parser";
import type { FooterManager } from "./footer";

/**
 * O bloco ```comments não renderiza a UI. Na leitura ele fica oculto (a UI
 * consolidada vai para o rodapé); em Live Preview mostra o código cru.
 */
export function registerCommentsCodeBlock(
  plugin: Plugin,
  footers: FooterManager
): void {
  plugin.registerMarkdownCodeBlockProcessor(LANG, (src, el, ctx) => {
    el.addClass("nc-block");
    ctx.addChild(
      new CommentsBlockChild(el, src, () => footers.scheduleRefresh())
    );
  });
}

class CommentsBlockChild extends MarkdownRenderChild {
  constructor(
    el: HTMLElement,
    private readonly src: string,
    private readonly onReading: () => void
  ) {
    super(el);
  }

  onload(): void {
    const el = this.containerEl;

    // Decide pelo lugar onde o elemento está, nunca pela view ativa.
    if (el.closest(".markdown-source-view")) {
      renderRaw(el, this.src);
      return;
    }
    if (el.closest(".markdown-preview-view")) {
      el.addClass("nc-hidden");
      this.onReading();
      return;
    }

    // Ainda não anexado: renderiza cru e deixa o CSS esconder na leitura
    // (.markdown-preview-view .nc-block).
    renderRaw(el, this.src);
    this.onReading();
  }
}

function renderRaw(el: HTMLElement, src: string): void {
  el.createEl("pre").createEl("code", { text: src });
}
