/**
 * Plays a captured tab stream back to the speakers so the tab isn't muted
 * while Armed. Returns a function that ends the capture.
 */
export function startPassthrough(
  stream: MediaStream,
  makeContext: () => AudioContext = () => new AudioContext(),
): () => Promise<void> {
  const ctx = makeContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);
  return async () => {
    for (const track of stream.getTracks()) track.stop();
    await ctx.close();
  };
}
