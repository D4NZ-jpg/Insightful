import { request } from "obsidian";

interface Embedding {
	index: number;
	object: string;
	embedding: Array<number>;
}

interface APIResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	data: Array<Embedding>;
}

interface EmbeddingRequest {
	model: string;
	input: string | Array<string>;
}

export default class APIWrapper {
	private apiKey: string;
	private baseUrl: string;

	constructor(apiKey: string, baseUrl: string) {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl;
	}

	async makeRequest(endpoint: string, data: EmbeddingRequest, method: string): Promise<APIResponse> {
		const url = `${this.baseUrl}/${endpoint}`;

		try {

			const req = {
				url: url,
				method: method,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			};

			const response = JSON.parse(await request(req));

			return await response as APIResponse;

		} catch (error) {
			console.error('API request error:', error);
			throw error;
		}
	}

	async getEmbeddings(model: string, inputText: string | Array<string>): Promise<APIResponse> {
		const data: EmbeddingRequest = {
			model: model,
			input: inputText
		};
		return await this.makeRequest('embeddings', data, 'POST');
	}
}
