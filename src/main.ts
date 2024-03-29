import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import API from './api';
import { VectorDatabase } from './database';
import { InsightView, VIEW_TYPE_INSIGHT } from './view'

interface InsighfulSettings {
	host: string;
	api_key: string;
	embedding_model: string;
	max_length: number;
}

const DEFAULT_SETTINGS: InsighfulSettings = {
	host: 'https://api.openai.com',
	api_key: '',
	embedding_model: 'text-embedding-3-small',
	max_length: 256
}


export default class Insightful extends Plugin {
	settings: InsighfulSettings;
	db: VectorDatabase; // Vector database

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// API
		const api = new API(this.settings.api_key, this.settings.host);

		// Load database when ready
		if (!this.app.workspace.layoutReady)
			this.app.workspace.onLayoutReady(async () => this.db = new VectorDatabase(this.app.vault, api, this.settings.embedding_model, this.settings.max_length));
		else
			this.db = new VectorDatabase(this.app.vault, api, this.settings.embedding_model, this.settings.max_length);

		// Register view
		this.registerView(
			VIEW_TYPE_INSIGHT,
			(leaf) => new InsightView(leaf, this.app)
		);

		// Commands
		this.addCommand({ // Open view
			id: "open-insight-view",
			name: "Open Insights",
			callback: () => this.activateView(),
		});

		this.addCommand({ // Update database
			id: "update-database",
			name: "Update insights",
			callback: () => VectorDatabase.updateAll()
		});
	}

	onunload() {
		VectorDatabase.writeDatabase();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_INSIGHT);

		if (leaves.length > 0)
			leaf = leaves[0];
		else {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_INSIGHT, active: true });
		}

		workspace.revealLeaf(leaf);
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
