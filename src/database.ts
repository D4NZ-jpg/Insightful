import { Vault } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import * as zlib from 'zlib';
import { promisify } from 'util';
import API from './api';
import { splitMD } from './utils';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);


interface Entry {
	embedId: string;
	file: string;
	update: number;
}

interface Database {
	embeddings: Map<string, { embed: Array<number>, content: string, path: string }>;
	metadata: Map<string, Array<Entry>>;
}

export interface QueryResult {
	id: string;
	body: string;
	path: string;
	score: number;
}

export class VectorDatabase { // FIX: Really simple database, not efficent, slow :c
	static data: Database
	static model: string;
	static vault: Vault;
	static api: API;
	static maxLen: number;
	path: string;



	constructor(plugin: Vault, api: API, model: string, maxLen: number) {
		VectorDatabase.vault = plugin;
		VectorDatabase.api = api;
		VectorDatabase.model = model;
		VectorDatabase.maxLen = maxLen;

		this.loadDatabase().then((res) => {
			VectorDatabase.data = res;
		});

	}

	async loadDatabase(): Promise<Database> {
		try {
			const file = await VectorDatabase.vault.adapter.read(".embeds")
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
					typeof val.content === 'string' &&
					typeof val.path === 'string');

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
			embeddings: new Map<string, { embed: [], content: string, path: string }>(), metadata: new Map<string, Array<Entry>>()
		};
	}

	async writeDatabase() {
		const jsonString = JSON.stringify(VectorDatabase.data, (_, value) => {
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

		await VectorDatabase.vault.adapter.write(".embeds", compressed.toString('base64'));

	}


	async add(content: Array<string>, metadata: Array<{ file: string, update: number }>) {
		const res = (await VectorDatabase.api.getEmbeddings(VectorDatabase.model, content)).data;

		for (let i = 0, len = content.length; i < len; i++) {
			const id = uuidv4();
			VectorDatabase.data.embeddings.set(id, {
				embed: res[i].embedding,
				content: content[i],
				path: metadata[i].file,
			});

			if (VectorDatabase.data.metadata.get(metadata[i].file) === undefined)
				VectorDatabase.data.metadata.set(metadata[i].file, []);

			VectorDatabase.data.metadata.get(metadata[i].file)?.push({
				embedId: id,
				file: metadata[i].file,
				update: metadata[i].update,
			});
		}
		this.writeDatabase();
	}

	static async query(content: string, nearestN: number, exclude: string) {
		const query = (await this.api.getEmbeddings(this.model, content)).data[0].embedding;
		const results: Array<QueryResult> = [];

		for (const [id, entry] of VectorDatabase.data.embeddings) {
			if (exclude && entry.path == exclude) continue;

			const score = this.cosinesim(query, entry.embed);
			const body = entry.content;
			const path = entry.path;
			results.push({ id, body, path, score });
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, nearestN);
	}

	async removeFile(file: string) {
		const entry = VectorDatabase.data.metadata.get(file);
		entry?.forEach((x) => VectorDatabase.data.embeddings.delete(x.embedId))

		VectorDatabase.data.metadata.delete(file);
		this.writeDatabase();
	}

	async updateAll() {
		const files = VectorDatabase.vault.getMarkdownFiles();
		const strings: Array<string> = [];
		const metadata: Array<{ file: string, update: number }> = [];

		for (const idx in files) {
			const file = files[idx];

			const res = VectorDatabase.data.metadata.get(file.path);
			if (res) {
				if (res[0].update == file.stat.mtime) continue;
				else this.removeFile(file.path);
			}

			const content = await VectorDatabase.vault.read(file);
			const splits = splitMD(content, VectorDatabase.maxLen);
			strings.push(...splits);

			for (let i = 0; i < splits.length; i += 1)
				metadata.push({
					file: file.path,
					update: file.stat.mtime,
				});
		}

		this.add(strings, metadata);
	}

	static cosinesim(A: Array<number>, B: Array<number>) {
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
