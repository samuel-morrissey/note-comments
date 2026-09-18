import { Plugin } from "obsidian";
import { registerAddBlockCommand } from "./commands/add-block";
import {
  CommentsSettingTab,
  CommentsSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import { registerCommentsCodeBlock } from "./ui/code-block";
import { FooterManager } from "./ui/footer";

export default class NoteCommentsPlugin extends Plugin {
  settings: CommentsSettings = { ...DEFAULT_SETTINGS };
  footers!: FooterManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.footers = this.addChild(new FooterManager(this));

    registerCommentsCodeBlock(this, this.footers);
    // Gatilho extra: dispara sempre que a leitura renderiza alguma seção.
    this.registerMarkdownPostProcessor(() => {
      this.footers.scheduleRefresh();
    });

    registerAddBlockCommand(this);
    this.addSettingTab(new CommentsSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.footers.refreshAll());
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<CommentsSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
