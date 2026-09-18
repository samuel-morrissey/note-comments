import {
  App,
  Component,
  IconName,
  MarkdownRenderer,
  moment,
  setIcon,
} from "obsidian";
import { Comment } from "../comments/parser";
import { CommentsSettings } from "../settings";

export interface PanelOptions {
  app: App;
  settings: CommentsSettings;
  comments: Comment[];
  sourcePath: string;
  /** Component carregado que passa a ser dono dos corpos renderizados. */
  component: Component;
  onSubmit: (body: string) => Promise<void>;
  onDelete: (c: Comment) => Promise<void>;
  onToggleArchive: (c: Comment, archived: boolean) => Promise<void>;
  onEdit: (c: Comment, body: string) => Promise<void>;
}

/**
 * Enter envia, Shift+Enter quebra linha, Ctrl/Cmd+Enter também envia e
 * Escape cancela (quando houver o que cancelar).
 */
function bindComposerKeys(
  textarea: HTMLTextAreaElement,
  handlers: { submit: () => void; cancel?: () => void }
): void {
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlers.submit();
      return;
    }
    if (e.key === "Escape" && handlers.cancel) {
      e.preventDefault();
      handlers.cancel();
    }
  });
}

function iconButton(
  parent: HTMLElement,
  icon: IconName,
  label: string,
  cls: string
): HTMLButtonElement {
  // O Obsidian mostra `aria-label` como tooltip nos botões.
  const btn = parent.createEl("button", {
    cls: `nc-icon-btn clickable-icon ${cls}`,
    attr: { "aria-label": label },
  });
  setIcon(btn, icon);
  return btn;
}

/**
 * Monta o painel de comentários (contagem, formulário e lista) dentro de
 * `host`. Devolve o textarea para que o chamador possa preservar o rascunho.
 */
export function renderCommentsPanel(
  host: HTMLElement,
  o: PanelOptions
): HTMLTextAreaElement {
  const { app, settings, comments, sourcePath, component } = o;

  // Cabeçalho
  const header = host.createDiv({ cls: "nc-header" });
  const archivedCount = comments.filter((c) => c.archived).length;
  let headerText =
    comments.length === 1 ? "1 comentário" : `${comments.length} comentários`;
  if (archivedCount > 0) {
    headerText +=
      archivedCount === 1
        ? " · 1 arquivado"
        : ` · ${archivedCount} arquivados`;
  }
  header.createSpan({ text: headerText });

  // Formulário
  const form = host.createDiv({ cls: "nc-form" });
  const textarea = form.createEl("textarea", {
    cls: "nc-textarea",
    attr: {
      rows: "3",
      placeholder: `Escreva um comentário como ${settings.userName}… (Shift+Enter quebra linha)`,
    },
  });
  const actions = form.createDiv({ cls: "nc-actions" });
  const submit = actions.createEl("button", {
    text: "Comentar",
    cls: "mod-cta",
  });

  const send = async () => {
    const body = textarea.value.trim();
    if (!body) return;
    // Limpa antes de gravar para o refresh não restaurar o texto enviado.
    textarea.value = "";
    await o.onSubmit(body);
  };

  submit.onclick = () => void send();
  bindComposerKeys(textarea, { submit: () => void send() });

  // Lista
  const list = host.createDiv({ cls: "nc-list" });
  if (comments.length === 0) {
    list.createDiv({ cls: "nc-empty", text: "Nenhum comentário ainda." });
  }

  for (const c of comments) {
    const mine = c.author === settings.userName;
    const item = list.createDiv({ cls: "nc-item" });
    if (c.archived) item.addClass("nc-archived");
    const head = item.createDiv({ cls: "nc-item-header" });

    head.createSpan({ cls: "nc-author", text: c.author });

    const m = moment(c.date, moment.ISO_8601, true);
    head.createSpan({
      cls: "nc-date",
      text: m.isValid() ? m.format(settings.dateFormat) : c.date,
      attr: { title: m.isValid() ? m.fromNow() : "" },
    });

    const body = item.createDiv({ cls: "nc-body" });
    const renderBody = () => {
      body.empty();
      void MarkdownRenderer.render(app, c.body, body, sourcePath, component);
    };
    renderBody();

    const itemActions = head.createSpan({ cls: "nc-item-actions" });

    if (mine) {
      const edit = iconButton(itemActions, "pencil", "Editar", "nc-edit");
      edit.onclick = () => startEdit(item, body, c, renderBody, o);
    }

    const archive = iconButton(
      itemActions,
      c.archived ? "archive-restore" : "archive",
      c.archived ? "Desarquivar" : "Arquivar",
      "nc-archive"
    );
    archive.onclick = () => void o.onToggleArchive(c, !c.archived);

    if (mine) {
      const del = iconButton(itemActions, "trash-2", "Excluir", "nc-delete");
      del.onclick = () => void o.onDelete(c);
    }
  }

  return textarea;
}

/** Troca o corpo renderizado por um textarea com Salvar/Cancelar. */
function startEdit(
  item: HTMLElement,
  body: HTMLElement,
  c: Comment,
  renderBody: () => void,
  o: PanelOptions
): void {
  if (item.hasClass("nc-editing")) return;
  item.addClass("nc-editing");
  body.empty();

  const rows = Math.max(3, c.body.split("\n").length);
  const textarea = body.createEl("textarea", {
    cls: "nc-textarea",
    attr: { rows: String(rows) },
  });
  textarea.value = c.body;

  const actions = body.createDiv({ cls: "nc-actions" });
  const cancelBtn = actions.createEl("button", { text: "Cancelar" });
  const saveBtn = actions.createEl("button", {
    text: "Salvar",
    cls: "mod-cta",
  });

  const cancel = () => {
    item.removeClass("nc-editing");
    renderBody();
  };

  const save = async () => {
    const next = textarea.value.trim();
    if (!next || next === c.body) {
      cancel();
      return;
    }
    saveBtn.disabled = true;
    await o.onEdit(c, next);
    // O refresh via metadataCache re-renderiza o painel; se não vier (texto
    // idêntico após normalização), volta ao modo de leitura manualmente.
    if (item.isConnected) cancel();
  };

  cancelBtn.onclick = cancel;
  saveBtn.onclick = () => void save();
  bindComposerKeys(textarea, { submit: () => void save(), cancel });

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}
