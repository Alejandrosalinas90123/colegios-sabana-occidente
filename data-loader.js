/* Network and decoding boundary: no UI state or ranking logic lives here. */
const SchoolData = (() => {
  async function load() {
    if (!('DecompressionStream' in globalThis)) {
      throw new Error(
        'Para abrir la base usa una versión actual de Chrome, Edge, Firefox o Safari.'
      );
    }
    const response = await fetch('data.json.gz?v=2', { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      throw new Error('No se pudo descargar la base. Revisa tu conexión y vuelve a intentarlo.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Some hosts decompress responses automatically; never decompress them twice.
    const isGzip = bytes[0] === 31 && bytes[1] === 139;
    const source = new Blob([bytes]).stream();
    const stream = isGzip ? source.pipeThrough(new DecompressionStream('gzip')) : source;
    const data = JSON.parse(await new Response(stream).text());
    if (data.version !== 2 || data.records?.length !== 72686 || data.places?.length !== 1116) {
      throw new Error('La base no pasó el control de integridad. Vuelve a cargarla.');
    }
    data.records = data.records.map((row) => ({
      id: row[0],
      year: row[1],
      n: row[2],
      scores: row.slice(3, 8),
      nature: row[8],
      session: row[9],
      calendar: row[10],
      sourceRow: row[11],
    }));
    return data;
  }
  return { load };
})();
