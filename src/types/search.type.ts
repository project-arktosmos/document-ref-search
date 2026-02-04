export interface SearchResult {
	id: string;
	matchIndex: number;
	matchText: string;
	contextBefore: string;
	contextAfter: string;
	position: number;
}

export interface SearchOptions {
	query: string;
	caseSensitive: boolean;
	contextLength: number;
	wholeWord: boolean;
}
