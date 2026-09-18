import { Component, MarkdownView, TFile, debounce, moment } from "obsidian";
import { collectComments } from "../comments/parser";
import {
  addComment,
  removeComment,
  setCommentArchived,
  updateCommentBody,
} from "../comments/store";
import type NoteCommentsPlugin from "../main";
import { renderCommentsPanel } from "./panel";

const SIZER_SELECTOR = ".markdown-preview-sizer";
const FOOTER_SELECTOR = ":scope > .mod-footer";
const FOOTER_ATTR = "data-nc-footer";

/** Rodapé de comentários de uma MarkdownView em modo de leitura. */
export class CommentsFooter extends Component {
  private readonly el: HTMLElement;
  private lastText: string | null = null;
  private lastPath: string | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private bodies: Component | null = null;

  constructor(
    private readonly plugin: NoteCommentsPlugin,
    private readonly view: MarkdownView
  ) {
    super();
    this.el = createDiv({
      cls: "nc-container nc-footer",
      attr: { [FOOTER_ATTR]: "" },
    });
  }

  /** Garante que o elemento está no fim da visão de leitura (idempotente). */
  mount(): void {
    const root = this.view.previewMode.containerEl;
    const sizer = root.querySelector<HTMLElement>(SIZER_SELECTOR);
    const host =
      sizer?.querySelector<HTMLElement>(FOOTER_SELECTOR) ?? sizer ?? root;

    if (this.el.parentElement !== host) host.appendChild(this.el);

    for (const stray of Array.from(
      host.querySelectorAll(`[${FOOTER_ATTR}]`)
    )) {
      if (stray !== this.el) stray.remove();
    }
  }

  /** Re-renderiza só quando o texto mudou (ou `force`), preservando o rascunho. */
  update(text: string, file: TFile, force: boolean): void {
    if (
      !force &&
      text === this.lastText &&
      file.path === this.lastPath &&
      this.el.isConnected
    ) {
      return;
    }
    this.lastText = text;
    this.lastPath = file.path;

    const draft = this.textarea?.value ?? "";
    if (this.bodies) this.removeChild(this.bodies);
    this.bodies = this.addChild(new Component());
    this.el.empty();

    const { app, settings } = this.plugin;
    this.textarea = renderCommentsPanel(this.el, {
      app,
      settings,
      comments: collectComments(text),
      sourcePath: file.path,
      component: this.bodies,
      onSubmit: (body) =>
        addComment(app, file, {
          author: settings.userName,
          date: moment().format(),
          body,
          archived: false,
        }),
      onDelete: (c) => removeComment(app, file, c),
      onToggleArchive: (c, archived) =>
        setCommentArchived(app, file, c, archived),
      onEdit: (c, body) => updateCommentBody(app, file, c, body),
    });
    this.textarea.value = draft;
  }

  setHidden(hidden: boolean): void {
    this.el.toggleClass("nc-hidden", hidden);
  }

  onunload(): void {
    this.el.remove();
  }
}

/** Descobre MarkdownViews, mantém um rodapé por view e reage a eventos. */
export class FooterManager extends Component {
  private readonly footers = new Map<MarkdownView, CommentsFooter>();

  /** Refresh debounced de todas as views (barato: pula views sem mudança). */
  readonly scheduleRefresh = debounce(() => this.refreshAll(), 100, true);

  constructor(private readonly plugin: NoteCommentsPlugin) {
    super();
  }

  onload(): void {
    const { workspace, metadataCache } = this.plugin.app;
    this.registerEvent(workspace.on("layout-change", () => this.scheduleRefresh()));
    this.registerEvent(
      workspace.on("active-leaf-change", () => this.scheduleRefresh())
    );
    this.registerEvent(workspace.on("file-open", () => this.scheduleRefresh()));
    this.registerEvent(
      metadataCache.on("changed", () => this.scheduleRefresh())
    );
    this.register(() => this.scheduleRefresh.cancel());
  }

  onunload(): void {
    for (const footer of this.footers.values()) this.removeChild(footer);
    this.footers.clear();
  }

  refreshAll(force = false): void {
    const live = new Set<MarkdownView>();

    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) return;
      live.add(view);
      this.refreshView(view, force);
    });

    for (const [view, footer] of this.footers) {
      if (live.has(view)) continue;
      this.removeChild(footer);
      this.footers.delete(view);
    }
  }

  private refreshView(view: MarkdownView, force: boolean): void {
    const file = view.file;
    if (!file || file.extension !== "md" || view.getMode() !== "preview") {
      this.footers.get(view)?.setHidden(true);
      return;
    }

    let footer = this.footers.get(view);
    if (!footer) {
      footer = this.addChild(new CommentsFooter(this.plugin, view));
      this.footers.set(view, footer);
    }
    footer.mount();
    footer.setHidden(false);
    footer.update(view.data, file, force);
  }
}
