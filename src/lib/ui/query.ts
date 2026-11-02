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
  // Commas stay readable: ?fold=converter,fees rather than converter%2Cfees.
  const query = params.toString().replace(/%2C/g, ',');
  const url = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
}
