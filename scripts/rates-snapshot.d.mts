// Types for the TypeScript tests that run these checks on the committed snapshots (src/lib/currency/rates-data.test.ts).
type Rates = Record<string, number>;

export interface Snapshot {
  date: string;
  rates: Rates;
  history?: { date: string; rates: Rates }[];
}

export declare const SOURCES_FACTOR: number;
export declare const MOVE_FACTOR: number;
export declare function notPositive(rates: Rates): string[];
export declare function sourcesApart(bnr?: Rates, market?: Rates): string[];
export declare function movedFrom(rates: Rates, saved: Snapshot | null | undefined): string[];
export declare function historyMoves(history?: { date: string; rates: Rates }[]): string[];
export declare function holdBack(problems: string[]): void;
export declare function readSnapshot(file: URL): Promise<Snapshot | null>;
export declare function writeSnapshot(file: URL, snapshot: Snapshot): Promise<void>;
export declare function exists(file: URL): Promise<boolean>;
export declare function notUpdated(what: string, err: Error, kept?: boolean): void;
export declare function isMain(meta: { main?: boolean; url: string }): boolean;
