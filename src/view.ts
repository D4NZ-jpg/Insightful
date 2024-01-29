import { ItemView, WorkspaceLeaf, App, TFile } from "obsidian";
import { VectorDatabase, QueryResult } from "./database";


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
			await VectorDatabase.updateAll();

			const file = this.app.workspace.getActiveFile();
			if (!file) return;


			const content = await this.app.vault.read(file);
			const res = await VectorDatabase.query(content, 10, file.path);

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

	displayResults(results: Array<QueryResult>) {
		this.resultsContainer.empty();

		results.forEach(result => {
			// Create the card container
			const card = document.createElement('div');
			card.addClass('card');

			// Create the data div and set its content
			const dataDiv = document.createElement('div');
			dataDiv.addClass('data');
			dataDiv.textContent = `${Math.round(result.score * 100)}% | ${result.path}`;

			const quoteDiv = document.createElement('div');
			quoteDiv.addClass('quote');
			quoteDiv.textContent = result.body;

			// Append the data and quote divs to the card
			card.appendChild(dataDiv);
			card.appendChild(quoteDiv);

			card.addEventListener('click', async () => {
				const leaf = this.app.workspace.getLeaf('tab');
				const file = this.app.vault.getAbstractFileByPath(result.path);
				if (file instanceof TFile)
					leaf.openFile(file);
			});

			this.resultsContainer.appendChild(card);
		});
	}

}
