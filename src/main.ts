import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface InsighfulSettings {
	host: string;
	api_key: string;
	embedding_model: string;
}

const DEFAULT_SETTINGS: InsighfulSettings = {
	host: 'https://api.openai.com',
	api_key: '',
	embedding_model: 'text-embedding-3-small'
}

export default class Insightful extends Plugin {
	settings: InsighfulSettings;

	async onload() {
		await this.loadSettings();

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

		// Embedding model
		new Setting(containerEl)
			.setName('Embedding model')
			.setDesc('Embedding model to be used')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.embedding_model)
				.onChange(async (value) => {
					this.plugin.settings.embedding_model = value.trim().toLowerCase();
					await this.plugin.saveSettings();
				}));


		// Embedding model
		new Setting(containerEl)
			.setName('API Key')
			.setDesc('API Key to use (if needed)')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.api_key)
				.onChange(async (value) => {
					this.plugin.settings.api_key = value.trim();
					await this.plugin.saveSettings();
				}));
	}
}
