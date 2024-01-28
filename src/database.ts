import { Vault } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import * as zlib from 'zlib';
import { promisify } from 'util';
import API from './api';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);


interface Entry {
	embedId: string;
	file: string;
	update: number;
}


interface Database {
	embeddings: Map<string, { embed: Array<number>, content: string }>;
	metadata: Map<string, Array<Entry>>;
}

export class VectorDatabase { // FIX: Really simple database, not efficent, slow :c
	data: Database
	path: string;
	vault: Vault;
	api: API;
	model: string;

	constructor(plugin: Vault, api: API, model: string) {
		this.vault = plugin;
		this.api = api;
		this.model = model;

		this.loadDatabase().then((res) => {
			this.data = res;
		});

	}

	async loadDatabase(): Promise<Database> {
		try {
			const file = await this.vault.adapter.read(".embeds")
			const buffer = Buffer.from(file, 'base64');
			const decompressed = await gunzip(buffer);

			const parsed = JSON.parse(decompressed.toString(), (_, value) => {
				if (typeof value === 'object' && value !== null) {
					if (value.dataType === 'Map') {
						return new Map(value.value);
					}
				}
				return value;
			}) as Database;


			// Make sure is valid database
			const hasEmbeddings = parsed.embeddings instanceof Map &&
				Array.from(parsed.embeddings.values()).every(val =>
					Array.isArray(val.embed) &&
					val.embed.every(e => typeof e === 'number') &&
					typeof val.content === 'string');

			const hasMetadata = parsed.metadata instanceof Map &&
				Array.from(parsed.metadata.values()).every(arr =>
					Array.isArray(arr) && arr.every(entry =>
						typeof entry === 'object' &&
						entry !== null &&
						typeof entry.embedId === 'string' &&
						typeof entry.file === 'string' &&
						typeof entry.update === 'number'));

			if (!hasEmbeddings || !hasMetadata)
				throw new Error("Invalid structure");

			return parsed;
		}
		catch (error) {
			console.error("Error parsing JSON or invalid structure:", error);
		}

		return {
			embeddings: new Map<string, { embed: [], content: "" }>(), metadata: new Map<string, Array<Entry>>()
		};
	}

	async writeDatabase() {
		const jsonString = JSON.stringify(this.data, (_, value) => {
			if (value instanceof Map) {
				return {
					dataType: 'Map',
					value: Array.from(value.entries()), // or with spread: value: [...value]
				};
			} else {
				return value;
			}
		});

		const compressed = await gzip(jsonString);

		await this.vault.adapter.write(".embeds", compressed.toString('base64'));

	}


	async add(content: Array<string>, metadata: Array<{ file: string, update: number }>) {
		const res = (await this.api.getEmbeddings(this.model, content)).data;

		for (let i = 0, len = content.length; i < len; i++) {
			const id = uuidv4();
			this.data.embeddings.set(id, {
				embed: res[i].embedding,
				content: content[i],
			});

			if (this.data.metadata.get(metadata[i].file) === undefined)
				this.data.metadata.set(metadata[i].file, []);

			this.data.metadata.get(metadata[i].file)?.push({
				embedId: id,
				file: metadata[i].file,
				update: metadata[i].update,
			});
		}
		this.writeDatabase();
	}

	async query(content: string, nearestN: number) {
		const query = (await this.api.getEmbeddings(this.model, content)).data[0].embedding;
		const results: Array<{ id: string, body: string, score: number }> = [];

		for (const [id, entry] of this.data.embeddings) {
			const score = this.cosinesim(query, entry.embed);
			const body = entry.content;
			results.push({ id, body, score });
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, nearestN);
	}

	async removeFile(file: string) {
		const entry = this.data.metadata.get(file);
		entry?.forEach((x) => this.data.embeddings.delete(x.embedId))

		this.data.metadata.delete(file);
		this.writeDatabase();
	}

	cosinesim(A: Array<number>, B: Array<number>) {
		let dotproduct = 0;
		let mA = 0, mB = 0;

		for (let i = 0; i < A.length; i++) {
			dotproduct += A[i] * B[i];
			mA += A[i] * A[i];
			mB += B[i] * B[i];
		}

		mA = Math.sqrt(mA);
		mB = Math.sqrt(mB);
		return dotproduct / (mA * mB);

	}

}