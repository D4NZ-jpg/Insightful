import { ItemView, WorkspaceLeaf, App } from "obsidian";
import { VectorDatabase } from "./database";

export const VIEW_TYPE_INSIGHT = "insight-view";

export class InsightView extends ItemView {
	app: App;
	resultsContainer: HTMLDivElement;

	constructor(leaf: WorkspaceLeaf, app: App) {
		super(leaf);
		this.app = app;

	}

	getViewType() {
		return VIEW_TYPE_INSIGHT;
	}

	getDisplayText() {
		return "Insights";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h3", { text: "Insights" });

		const searchButton = document.createElement('button');
		searchButton.textContent = 'Search';
		searchButton.addEventListener('click', async () => {
			const file = this.app.workspace.getActiveFile();
			if (!file) return;


			const content = await this.app.vault.read(file);
			const res = await VectorDatabase.query(content, 10);

			this.displayResults(res);
		});

		// Search button
		container.appendChild(searchButton);
		container.appendChild(document.createElement('br'))

		// Create a separate container for results
		this.resultsContainer = document.createElement('div');
		this.resultsContainer.addClass('results-container');
		container.appendChild(this.resultsContainer);
	}

	displayResults(results: Array<{ id: string, body: string, score: number }>) {
		this.resultsContainer.empty();

		results.forEach(result => {
			const resultEl = document.createElement('div');
			resultEl.textContent = `${Math.round(result.score * 100)}% | ${result.body}`
			this.resultsContainer.appendChild(resultEl);
			this.resultsContainer.appendChild(document.createElement('br'))
		});
	}

}
