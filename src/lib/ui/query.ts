/**
 * The address's query string as app state (folded sections, the converter's amount). Changes replace the
 * current history entry and keep the other parameters and the #taxes hash.
 */
export function readQuery(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function writeQuery(change: (params: URLSearchParams) => void): void {
  const params = readQuery();
  change(params);
  // Commas and colons stay readable: ?fold=converter,fees&rates=USD:4.9, not converter%2Cfees and USD%3A4.9.
  const query = readable(params);
  const url = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
}

/** The query string with commas and colons left as they are (both are fine in a query). */
export function readable(params: URLSearchParams): string {
  return params.toString().replace(/%2C/gi, ',').replace(/%3A/gi, ':');
}
