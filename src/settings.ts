import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteCommentsPlugin from "./main";

export interface CommentsSettings {
  userName: string;
  dateFormat: string;
}

export const DEFAULT_SETTINGS: CommentsSettings = {
  userName: "Anônimo",
  dateFormat: "DD/MM/YYYY HH:mm",
};

export class CommentsSettingTab extends PluginSettingTab {
  plugin: NoteCommentsPlugin;

  constructor(app: App, plugin: NoteCommentsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Seu nome")
      .setDesc("Nome gravado como autor dos comentários.")
      .addText((t) =>
        t
          .setPlaceholder("Ex.: Ana")
          .setValue(this.plugin.settings.userName)
          .onChange(async (v) => {
            this.plugin.settings.userName =
              v.trim() || DEFAULT_SETTINGS.userName;
            await this.plugin.saveSettings();
            this.plugin.footers.refreshAll(true);
          })
      );

    new Setting(containerEl)
      .setName("Formato de data")
      .setDesc(
        "Formato do moment.js usado na exibição (o arquivo guarda ISO)."
      )
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.dateFormat)
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (v) => {
            this.plugin.settings.dateFormat = v || DEFAULT_SETTINGS.dateFormat;
            await this.plugin.saveSettings();
            this.plugin.footers.refreshAll(true);
          })
      );
  }
}
