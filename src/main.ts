import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface InsighfulSettings {
	host: string;
}

const DEFAULT_SETTINGS: InsighfulSettings = {
	host: 'https://api.openai.com'
}

export default class Insightful extends Plugin {
	settings: InsighfulSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: Insightful;

	constructor(app: App, plugin: Insightful) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Host settings
		new Setting(containerEl)
			.setName('Host')
			.setDesc('Base url for to use with the API')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.host)
				.onChange(async (value) => {
					this.plugin.settings.host = value.trim();
					await this.plugin.saveSettings();
				}));
	}
}
