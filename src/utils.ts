import { marked, Token } from 'marked';

export function splitMD(content: string, maxLen: number): Array<string> {
	const splits: Array<string> = [];

	content = removeYML(content);
	const AST = marked.lexer(content);


	let current = "";

	for (const idx in AST) {
		const node = AST[idx];

		if (node.type == "heading" && current != "") {
			splits.push(current);
			current = "";
		}

		current += getText(node);

		// Check if passed maxLen, if so, split
		while (current.split(' ').length > maxLen) {
			const chunks = splitIntoChunks(current, maxLen);

			// Push all chunks except the last one
			splits.push(...chunks.slice(0, -1));

			// Update current to be the last chunk
			current = chunks[chunks.length - 1];
		}
	}
	if (current != "") splits.push(current);

	return splits;
}

function getText(node: Token): string {
	switch (node.type) {
		case 'text':
			return node.text;
		case 'heading':
			return node.text + '\n';
		case 'paragraph':
			if (node.tokens === undefined) return "";
			return node.tokens.map(item => getText(item)).join('\n');
		case 'list':
			if (node.items === undefined) return "";
			return node.items.map((item: Token) => getText(item)).join('\n');
		case 'list_item':
			return node.text;
		default:
			return '';
	}
}

function removeYML(message: string) {
	try {
		const YAMLFrontMatter = /---\s*[\s\S]*?\s*---/g;
		const newMessage = message.replace(YAMLFrontMatter, "");
		return newMessage;
	} catch (err) {
		throw new Error("Error removing YML from message" + err);
	}
}

function splitIntoChunks(content: string, maxLen: number): string[] {
	const words = content.split(' ');
	const chunks: Array<string> = [];
	let currentChunk: Array<string> = [];

	for (const word of words)
		if (currentChunk.length + 1 > maxLen) {
			chunks.push(currentChunk.join(' '));
			currentChunk = [word];
		} else
			currentChunk.push(word);

	if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
	return chunks;
}
